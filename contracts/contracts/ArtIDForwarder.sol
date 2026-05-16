// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IArtIDRegistrar {
    function priceFor(uint64 _years) external view returns (uint256);
    function register(
        string calldata _label,
        uint64 _years,
        address _owner,
        address _nftContract,
        uint256 _tokenId,
        bytes calldata _contenthash
    ) external payable returns (bytes32);
}

interface IOwnable {
    function owner() external view returns (address);
}

interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title ArtIDForwarder
 * @notice Single entry point for museum-passport mints. Splits revenue with
 *         the NFT collection's artist when terms are registered.
 *
 *         Artists self-onboard by calling setArtistTerms(collection, treasury, fee).
 *         The forwarder verifies on-chain that msg.sender controls the collection
 *         via Ownable.owner() or AccessControl.hasRole(DEFAULT_ADMIN_ROLE, msg.sender).
 *         No off-chain signer. No EIP-712 grants. Terms can be updated or cleared
 *         by the same authorization check at any time.
 */
contract ArtIDForwarder is Ownable, ReentrancyGuard {

    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);

    IArtIDRegistrar public immutable REGISTRAR;

    struct ArtistTerms {
        address payable treasury;
        uint96  fee;     // packed with treasury; 0.05 ETH << 2^96 — safe
        bool    active;
    }

    /// @notice Collection => artist payout terms. Reading a zero/inactive entry means no artist split.
    mapping(address => ArtistTerms) public artistTerms;

    /// @notice Hard ceiling on the per-mint artist fee. Owner-adjustable.
    uint256 public maxArtistFee = 0.05 ether;

    event ArtistTermsSet(address indexed collection, address indexed treasury, uint256 fee);
    event ArtistTermsCleared(address indexed collection);
    event ArtistPaid(address indexed collection, address indexed treasury, uint256 amount);
    event MaxArtistFeeUpdated(uint256 oldMax, uint256 newMax);

    error ArtistFeeTooHigh();
    error InsufficientPayment(uint256 required, uint256 provided);
    error NotCollectionOwner();
    error TransferFailed();
    error ZeroAddress();

    constructor(address _registrar, address _initialOwner) Ownable(_initialOwner) {
        if (_registrar == address(0)) revert ZeroAddress();
        REGISTRAR = IArtIDRegistrar(_registrar);
    }

    // ─── Artist onboarding (on-chain, no signatures) ──────────────────

    /**
     * @notice Register or update payout terms for an NFT collection.
     * @dev    Caller must control the collection via Ownable or AccessControl admin role.
     */
    function setArtistTerms(
        address _collection,
        address payable _treasury,
        uint256 _fee
    ) external {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_fee > maxArtistFee) revert ArtistFeeTooHigh();
        if (!_isCollectionAdmin(_collection, msg.sender)) revert NotCollectionOwner();

        artistTerms[_collection] = ArtistTerms({
            treasury: _treasury,
            fee:      uint96(_fee),
            active:   true
        });
        emit ArtistTermsSet(_collection, _treasury, _fee);
    }

    /**
     * @notice Remove payout terms for a collection. Same auth as set.
     *         Owner can also clear (emergency removal of bad terms).
     */
    function clearArtistTerms(address _collection) external {
        if (msg.sender != owner() && !_isCollectionAdmin(_collection, msg.sender)) {
            revert NotCollectionOwner();
        }
        delete artistTerms[_collection];
        emit ArtistTermsCleared(_collection);
    }

    function _isCollectionAdmin(address _collection, address _who) internal view returns (bool) {
        try IOwnable(_collection).owner() returns (address o) {
            if (o == _who) return true;
        } catch {}
        try IAccessControl(_collection).hasRole(DEFAULT_ADMIN_ROLE, _who) returns (bool h) {
            if (h) return true;
        } catch {}
        return false;
    }

    /// @notice Convenience read for the widget / dashboard.
    function getArtistTerms(address _collection)
        external
        view
        returns (address treasury, uint256 fee, bool active)
    {
        ArtistTerms storage t = artistTerms[_collection];
        return (t.treasury, t.fee, t.active);
    }

    /// @notice Total required ETH to mint, including any active artist fee.
    function totalCost(address _nftContract, uint64 _years) public view returns (uint256) {
        uint256 base = REGISTRAR.priceFor(_years);
        ArtistTerms storage t = artistTerms[_nftContract];
        if (!t.active) return base;
        return base + t.fee;
    }

    // ─── Registration ─────────────────────────────────────────────────

    /**
     * @notice Mint a museum-passport subdomain. If the NFT's collection has
     *         registered artist terms, the artist fee is peeled off first and
     *         sent directly to the artist treasury; the remainder funds the
     *         registrar call. Excess ETH is refunded to msg.sender.
     */
    function register(
        string calldata _label,
        uint64  _years,
        address _nftContract,
        uint256 _tokenId,
        bytes calldata _contenthash
    )
        external
        payable
        nonReentrant
        returns (bytes32 node)
    {
        uint256 registrationCost = REGISTRAR.priceFor(_years);
        ArtistTerms memory t = artistTerms[_nftContract];
        uint256 fee = t.active ? uint256(t.fee) : 0;
        uint256 totalRequired = registrationCost + fee;
        if (msg.value < totalRequired) revert InsufficientPayment(totalRequired, msg.value);

        if (fee > 0) {
            (bool ok, ) = t.treasury.call{value: fee}("");
            if (!ok) revert TransferFailed();
            emit ArtistPaid(_nftContract, t.treasury, fee);
        }

        node = REGISTRAR.register{value: registrationCost}(
            _label,
            _years,
            msg.sender,
            _nftContract,
            _tokenId,
            _contenthash
        );

        uint256 spent = registrationCost + fee;
        if (msg.value > spent) {
            (bool ok, ) = msg.sender.call{value: msg.value - spent}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────

    function setMaxArtistFee(uint256 _max) external onlyOwner {
        emit MaxArtistFeeUpdated(maxArtistFee, _max);
        maxArtistFee = _max;
    }

    function rescueETH(address payable _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        (bool ok, ) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }
}
