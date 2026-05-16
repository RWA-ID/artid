// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string memory label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setSubnodeOwner(
        bytes32 parentNode,
        string memory label,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function extendExpiry(
        bytes32 parentNode,
        bytes32 labelhash,
        uint64 expiry
    ) external returns (uint64);

    function isWrapped(bytes32 node) external view returns (bool);
    function ownerOf(uint256 id) external view returns (address);
}

interface IPublicResolver {
    function setContenthash(bytes32 node, bytes calldata hash) external;
    function contenthash(bytes32 node) external view returns (bytes memory);
}

/**
 * @title ArtIDRegistrar
 * @notice Registers subdomains of artid.eth as museum-passport ENS subnames.
 *         Subnames are minted with PARENT_CANNOT_CONTROL + CANNOT_UNWRAP +
 *         CAN_EXTEND_EXPIRY fuses burned — the holder owns them outright,
 *         and the parent (this registrar) cannot revoke or modify them after mint.
 *         Renewals use NameWrapper.extendExpiry, which remains callable by both
 *         the parent operator (this registrar, on user's behalf) and the holder.
 *
 * @dev    Prerequisite: artid.eth must be wrapped AND have CANNOT_UNWRAP burned
 *         before subnames with PCC can be minted. The deploy script documents this.
 */
contract ArtIDRegistrar is Ownable, Pausable, ReentrancyGuard {

    // ─── Fuse constants (from @ensdomains/ens-contracts/wrapper/INameWrapper.sol) ───
    uint32 public constant CANNOT_UNWRAP          = 1;
    uint32 public constant PARENT_CANNOT_CONTROL  = 1 << 16; // 65536
    uint32 public constant CAN_EXTEND_EXPIRY      = 1 << 18; // 262144

    /// @notice Fuses burned on every subname mint. Locks the subname to the holder.
    uint32 public constant SUBNODE_FUSES = PARENT_CANNOT_CONTROL | CANNOT_UNWRAP | CAN_EXTEND_EXPIRY;

    bytes32 public immutable PARENT_NODE;
    INameWrapper public immutable NAME_WRAPPER;
    address public immutable PUBLIC_RESOLVER;

    uint64 public constant MIN_YEARS = 1;
    uint64 public constant MAX_YEARS = 10;
    uint64 public constant SECONDS_PER_YEAR = 365 days;

    uint256 public platformFee;
    uint256 public pricePerYear;
    address payable public treasury;

    mapping(address => bool) public authorizedForwarders;

    struct Record {
        address registrant;
        uint64  registeredAt;
        uint64  expiry;
        bytes32 nftContractAndTokenId;
    }
    mapping(bytes32 => Record) public records;

    event Registered(
        string  label,
        bytes32 indexed node,
        address indexed owner,
        address indexed nftContract,
        uint256 tokenId,
        uint64  expiry,
        uint256 paid
    );
    event Renewed(string label, bytes32 indexed node, uint64 newExpiry, uint256 paid);
    event ContenthashSet(bytes32 indexed node, bytes contenthash);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event PricePerYearUpdated(uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event ForwarderAuthorized(address forwarder, bool authorized);
    event Withdrawal(address to, uint256 amount);

    error InvalidLabel();
    error LabelTooLong();
    error YearsOutOfRange();
    error InsufficientPayment(uint256 required, uint256 provided);
    error LabelAlreadyRegistered();
    error LabelNotRegistered();
    error NotForwarderOrSelf();
    error ZeroAddress();
    error TransferFailed();

    constructor(
        bytes32 _parentNode,
        address _nameWrapper,
        address _publicResolver,
        address payable _treasury,
        uint256 _platformFee,
        uint256 _pricePerYear,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_nameWrapper == address(0) || _publicResolver == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }
        PARENT_NODE     = _parentNode;
        NAME_WRAPPER    = INameWrapper(_nameWrapper);
        PUBLIC_RESOLVER = _publicResolver;
        treasury        = _treasury;
        platformFee     = _platformFee;
        pricePerYear    = _pricePerYear;
    }

    function priceFor(uint64 _years) public view returns (uint256) {
        return platformFee + (pricePerYear * _years);
    }

    function isAvailable(string calldata _label) external view returns (bool) {
        bytes32 labelhash = keccak256(bytes(_label));
        Record storage r = records[labelhash];
        return r.expiry == 0 || r.expiry < block.timestamp;
    }

    /**
     * @notice Register a new subdomain.
     *         Mints with the registrar as initial owner so it can set contenthash,
     *         then transfers to `_owner` with PARENT_CANNOT_CONTROL burned.
     *         After this tx, the parent (registrar) can no longer modify the subname,
     *         only the holder can — except for `extendExpiry`, which we leave open
     *         via CAN_EXTEND_EXPIRY so the registrar can process renewals.
     */
    function register(
        string calldata _label,
        uint64 _years,
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
        if (msg.sender != _owner && !authorizedForwarders[msg.sender]) {
            revert NotForwarderOrSelf();
        }
        if (_owner == address(0)) revert ZeroAddress();
        if (_years < MIN_YEARS || _years > MAX_YEARS) revert YearsOutOfRange();

        _validateLabel(_label);

        bytes32 labelhash = keccak256(bytes(_label));
        Record storage existing = records[labelhash];
        if (existing.expiry != 0 && existing.expiry >= block.timestamp) {
            revert LabelAlreadyRegistered();
        }

        uint256 required = priceFor(_years);
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        uint64 expiry = uint64(block.timestamp) + (_years * SECONDS_PER_YEAR);

        // Step 1: mint subnode with registrar as temporary owner, no fuses yet,
        // so we can call setContenthash on the resolver.
        node = NAME_WRAPPER.setSubnodeRecord(
            PARENT_NODE,
            _label,
            address(this),
            PUBLIC_RESOLVER,
            0,
            0,
            expiry
        );

        // Step 2: pin the IPFS contenthash on the public resolver while we still
        // own the node.
        IPublicResolver(PUBLIC_RESOLVER).setContenthash(node, _contenthash);
        emit ContenthashSet(node, _contenthash);

        // Step 3: transfer to user AND burn fuses in the same call. Once PCC is
        // burned, this registrar can no longer modify the subname.
        NAME_WRAPPER.setSubnodeOwner(PARENT_NODE, _label, _owner, SUBNODE_FUSES, expiry);

        records[labelhash] = Record({
            registrant: _owner,
            registeredAt: uint64(block.timestamp),
            expiry: expiry,
            nftContractAndTokenId: keccak256(abi.encode(_nftContract, _tokenId))
        });

        _payTreasury(msg.value);

        emit Registered(_label, node, _owner, _nftContract, _tokenId, expiry, msg.value);
    }

    /**
     * @notice Extend an existing registration. Anyone can renew anyone's name
     *         (standard ENS pattern). Uses NameWrapper.extendExpiry, which is
     *         callable by the parent operator even after PCC is burned, and by
     *         the holder themselves thanks to CAN_EXTEND_EXPIRY.
     */
    function renew(string calldata _label, uint64 _years)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        if (_years < MIN_YEARS || _years > MAX_YEARS) revert YearsOutOfRange();
        bytes32 labelhash = keccak256(bytes(_label));
        Record storage r = records[labelhash];
        if (r.expiry == 0) revert LabelNotRegistered();

        uint256 required = pricePerYear * _years;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        uint64 newExpiry = r.expiry + (_years * SECONDS_PER_YEAR);
        r.expiry = newExpiry;

        NAME_WRAPPER.extendExpiry(PARENT_NODE, labelhash, newExpiry);

        _payTreasury(msg.value);

        bytes32 node = keccak256(abi.encodePacked(PARENT_NODE, labelhash));
        emit Renewed(_label, node, newExpiry, msg.value);
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        emit PlatformFeeUpdated(platformFee, _fee);
        platformFee = _fee;
    }

    function setPricePerYear(uint256 _price) external onlyOwner {
        emit PricePerYearUpdated(pricePerYear, _price);
        pricePerYear = _price;
    }

    function setTreasury(address payable _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    function setForwarder(address _forwarder, bool _authorized) external onlyOwner {
        authorizedForwarders[_forwarder] = _authorized;
        emit ForwarderAuthorized(_forwarder, _authorized);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address payable _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        (bool ok, ) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(_to, _amount);
    }

    function _payTreasury(uint256 _amount) internal {
        if (_amount == 0) return;
        (bool ok, ) = treasury.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }

    function _validateLabel(string calldata _label) internal pure {
        bytes calldata b = bytes(_label);
        uint256 len = b.length;
        if (len == 0 || len > 32) revert LabelTooLong();
        if (b[0] == 0x2d || b[len - 1] == 0x2d) revert InvalidLabel();
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool isLower = (c >= 0x61 && c <= 0x7a);
            bool isDigit = (c >= 0x30 && c <= 0x39);
            bool isHyphen = (c == 0x2d);
            if (!isLower && !isDigit && !isHyphen) revert InvalidLabel();
        }
    }
}
