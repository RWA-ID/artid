// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode, string memory label, address owner,
        address resolver, uint64 ttl, uint32 fuses, uint64 expiry
    ) external returns (bytes32);
    function setSubnodeOwner(
        bytes32 parentNode, string memory label, address owner,
        uint32 fuses, uint64 expiry
    ) external returns (bytes32);
    function extendExpiry(
        bytes32 parentNode, bytes32 labelhash, uint64 expiry
    ) external returns (uint64);
    function getData(uint256 id) external view returns (address, uint32, uint64);
    function ownerOf(uint256 id) external view returns (address);
}

interface IPublicResolver {
    function setContenthash(bytes32 node, bytes calldata hash) external;
}

interface IETHRegistrarController {
    struct Price { uint256 base; uint256 premium; }
    function rentPrice(string calldata name, uint256 duration) external view returns (Price memory);
    function renew(string calldata name, uint256 duration) external payable;
}

/**
 * @title ArtIDRegistrar
 *
 * @notice Mints museum-passport subnames under artid.eth. Every subname's expiry
 *         IS the parent's expiry — there is no separate per-subname clock.
 *         A registrant may optionally include a donation of N years which the
 *         contract uses to renew artid.eth itself at the live ENS DAO rate. The
 *         renewal extends every existing subname's expiry too — donations are
 *         a contribution to the shared museum's lifetime, not a personal subscription.
 *
 *         No platform per-year fee. No platform per-mint fee. 100% of the
 *         donation flows to ENS via ETHRegistrarController.renew(). The platform
 *         takes nothing here; artist fees are handled upstream by ArtIDForwarder.
 *
 *         Donations are optional. donateYears = 0 mints a subname pinned to the
 *         current parent expiry without extending it.
 */
contract ArtIDRegistrar is Ownable, Pausable, ReentrancyGuard, ERC1155Holder {

    // ─── Fuse constants ─────────────────────────────────────
    uint32 public constant CANNOT_UNWRAP         = 1;
    uint32 public constant PARENT_CANNOT_CONTROL = 1 << 16;  // 65536
    uint32 public constant CAN_EXTEND_EXPIRY     = 1 << 18;  // 262144
    uint32 public constant SUBNODE_FUSES = PARENT_CANNOT_CONTROL | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY;

    uint64 public constant MAX_DONATE_YEARS = 10;
    uint64 public constant SECONDS_PER_YEAR = 365 days;

    // ─── Immutables ─────────────────────────────────────────
    bytes32 public immutable PARENT_NODE;
    string  public PARENT_LABEL;                  // e.g. "artid"
    INameWrapper public immutable NAME_WRAPPER;
    address public immutable PUBLIC_RESOLVER;
    IETHRegistrarController public immutable CONTROLLER;

    // ─── State ──────────────────────────────────────────────
    mapping(address => bool) public authorizedForwarders;

    struct Subname {
        bytes32 labelhash;
        address registrant;
        uint64  registeredAt;
        bytes32 nftRef;
    }
    bytes32[] public subnameNodes;                          // index → node (enumeration)
    mapping(bytes32 => uint256) public subnameIndex1;       // node → 1-based index (0 = absent)
    mapping(bytes32 => Subname) public subnames;

    /// @notice Cap on subnames synced per tx to bound gas.
    uint256 public maxSyncPerTx = 100;

    // ─── Events ─────────────────────────────────────────────
    event Registered(string label, bytes32 indexed node, address indexed owner, address indexed nftContract, uint256 tokenId, uint64 sharedExpiry, uint256 donated);
    event ParentExtended(uint64 donateYears, uint256 paid, uint64 newSharedExpiry);
    event SubnameSynced(bytes32 indexed node, uint64 newExpiry);
    event ContenthashSet(bytes32 indexed node, bytes contenthash);
    event ForwarderAuthorized(address forwarder, bool authorized);
    event MaxSyncPerTxUpdated(uint256 oldMax, uint256 newMax);

    // ─── Errors ─────────────────────────────────────────────
    error InvalidLabel();
    error LabelTooLong();
    error YearsOutOfRange();
    error InsufficientPayment(uint256 required, uint256 provided);
    error LabelAlreadyRegistered();
    error NotForwarderOrSelf();
    error ZeroAddress();
    error TransferFailed();

    constructor(
        bytes32 _parentNode,
        string memory _parentLabel,
        address _nameWrapper,
        address _publicResolver,
        address _controller,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_nameWrapper == address(0) || _publicResolver == address(0) || _controller == address(0)) revert ZeroAddress();
        PARENT_NODE     = _parentNode;
        PARENT_LABEL    = _parentLabel;
        NAME_WRAPPER    = INameWrapper(_nameWrapper);
        PUBLIC_RESOLVER = _publicResolver;
        CONTROLLER      = IETHRegistrarController(_controller);
    }

    // ─── Views ──────────────────────────────────────────────

    /// @notice Live ENS DAO rent for `_years` more years of artid.eth.
    function donationPrice(uint64 _years) public view returns (uint256) {
        if (_years == 0) return 0;
        IETHRegistrarController.Price memory p = CONTROLLER.rentPrice(PARENT_LABEL, uint256(_years) * SECONDS_PER_YEAR);
        return p.base + p.premium;
    }

    function parentExpiry() public view returns (uint64) {
        (, , uint64 e) = NAME_WRAPPER.getData(uint256(PARENT_NODE));
        return e;
    }

    function isAvailable(string calldata _label) external view returns (bool) {
        bytes32 lh = keccak256(bytes(_label));
        bytes32 node = _nodeOf(lh);
        if (subnameIndex1[node] != 0) return false;
        try NAME_WRAPPER.ownerOf(uint256(node)) returns (address o) { return o == address(0); }
        catch { return true; }
    }

    function totalSubnames() external view returns (uint256) { return subnameNodes.length; }

    // ─── Registration ───────────────────────────────────────

    /**
     * @notice Mint a museum-passport subname.
     * @param _label       Subdomain label (a-z, 0-9, -; no leading/trailing hyphen; max 32)
     * @param _donateYears 0–10. If > 0, the registrar pays the ENS DAO to extend artid.eth
     *                     and every existing subname inherits the new expiry.
     * @param _owner       Wallet that receives the wrapped subname token.
     * @param _nftContract NFT contract this passport represents (for event indexing).
     * @param _tokenId     Token id this passport represents.
     * @param _contenthash IPFS contenthash (EIP-1577) — what subname.artid.eth resolves to.
     */
    function register(
        string calldata _label,
        uint64  _donateYears,
        address _owner,
        address _nftContract,
        uint256 _tokenId,
        bytes calldata _contenthash
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (bytes32 node)
    {
        if (msg.sender != _owner && !authorizedForwarders[msg.sender]) revert NotForwarderOrSelf();
        if (_owner == address(0)) revert ZeroAddress();
        if (_donateYears > MAX_DONATE_YEARS) revert YearsOutOfRange();
        _validateLabel(_label);

        bytes32 lh = keccak256(bytes(_label));
        node = _nodeOf(lh);
        if (subnameIndex1[node] != 0) revert LabelAlreadyRegistered();

        // 1. Optional donation → renew parent via ENS DAO
        uint256 required = donationPrice(_donateYears);
        if (msg.value < required) revert InsufficientPayment(required, msg.value);
        if (required > 0) {
            CONTROLLER.renew{value: required}(PARENT_LABEL, uint256(_donateYears) * SECONDS_PER_YEAR);
        }

        // 2. Read current parent expiry (post-renewal if we just did one).
        uint64 sharedExpiry = parentExpiry();

        // 3. Mint subname (registrar holds it briefly to set contenthash, then hands to user with fuses burned).
        NAME_WRAPPER.setSubnodeRecord(PARENT_NODE, _label, address(this), PUBLIC_RESOLVER, 0, 0, sharedExpiry);
        IPublicResolver(PUBLIC_RESOLVER).setContenthash(node, _contenthash);
        emit ContenthashSet(node, _contenthash);
        NAME_WRAPPER.setSubnodeOwner(PARENT_NODE, _label, _owner, SUBNODE_FUSES, sharedExpiry);

        // 4. Track for batch sync.
        subnameNodes.push(node);
        subnameIndex1[node] = subnameNodes.length;
        subnames[node] = Subname({
            labelhash:    lh,
            registrant:   _owner,
            registeredAt: uint64(block.timestamp),
            nftRef:       keccak256(abi.encode(_nftContract, _tokenId))
        });

        // 5. If we extended the parent, push the new expiry into existing subnames (bounded).
        //    Skip the just-added one (already at target).
        if (required > 0) {
            _syncToTarget(sharedExpiry, true);
            emit ParentExtended(_donateYears, required, sharedExpiry);
        }

        emit Registered(_label, node, _owner, _nftContract, _tokenId, sharedExpiry, required);

        // 6. Refund any overpayment.
        if (msg.value > required) {
            (bool ok, ) = msg.sender.call{value: msg.value - required}("");
            if (!ok) revert TransferFailed();
        }
    }

    /**
     * @notice Pure donation. Anyone can call this to extend artid.eth's lifetime
     *         and (via the inline sync) every existing subname's expiry too.
     *         No subname is minted.
     */
    function donate(uint64 _years) external payable whenNotPaused nonReentrant {
        if (_years == 0 || _years > MAX_DONATE_YEARS) revert YearsOutOfRange();
        uint256 required = donationPrice(_years);
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        CONTROLLER.renew{value: required}(PARENT_LABEL, uint256(_years) * SECONDS_PER_YEAR);
        uint64 newExpiry = parentExpiry();
        _syncToTarget(newExpiry, false);
        emit ParentExtended(_years, required, newExpiry);

        if (msg.value > required) {
            (bool ok, ) = msg.sender.call{value: msg.value - required}("");
            if (!ok) revert TransferFailed();
        }
    }

    /**
     * @notice Paginated sync — for if we ever exceed maxSyncPerTx and need to
     *         catch a tail of subnames up to the current parent expiry.
     */
    function syncRange(uint256 _start, uint256 _count) external whenNotPaused {
        uint64 target = parentExpiry();
        uint256 end = _start + _count;
        if (end > subnameNodes.length) end = subnameNodes.length;
        for (uint256 i = _start; i < end; i++) {
            bytes32 nNode = subnameNodes[i];
            bytes32 nLh = subnames[nNode].labelhash;
            try NAME_WRAPPER.extendExpiry(PARENT_NODE, nLh, target) returns (uint64) {
                emit SubnameSynced(nNode, target);
            } catch {}
        }
    }

    // ─── Internal ───────────────────────────────────────────

    function _syncToTarget(uint64 _target, bool _skipLast) internal {
        uint256 n = subnameNodes.length;
        uint256 toSync = _skipLast ? (n == 0 ? 0 : n - 1) : n;
        if (toSync > maxSyncPerTx) toSync = maxSyncPerTx;
        for (uint256 i = 0; i < toSync; i++) {
            bytes32 nNode = subnameNodes[i];
            bytes32 nLh = subnames[nNode].labelhash;
            try NAME_WRAPPER.extendExpiry(PARENT_NODE, nLh, _target) returns (uint64) {
                emit SubnameSynced(nNode, _target);
            } catch {}
        }
    }

    function _nodeOf(bytes32 _lh) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(PARENT_NODE, _lh));
    }

    function _validateLabel(string calldata _label) internal pure {
        bytes calldata b = bytes(_label);
        uint256 len = b.length;
        if (len == 0 || len > 32) revert LabelTooLong();
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidLabel();
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool isLower  = (c >= 0x61 && c <= 0x7a);
            bool isDigit  = (c >= 0x30 && c <= 0x39);
            bool isHyphen = (c == 0x2d);
            if (!isLower && !isDigit && !isHyphen) revert InvalidLabel();
        }
    }

    // ─── Admin ──────────────────────────────────────────────

    function setForwarder(address _f, bool _authorized) external onlyOwner {
        authorizedForwarders[_f] = _authorized;
        emit ForwarderAuthorized(_f, _authorized);
    }

    function setMaxSyncPerTx(uint256 _max) external onlyOwner {
        emit MaxSyncPerTxUpdated(maxSyncPerTx, _max);
        maxSyncPerTx = _max;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Sweep any stuck ETH (the contract should not normally hold any).
    function rescueETH(address payable _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        (bool ok, ) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {}
}
