// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IArtIDRegistrar {
    function donationPrice(uint64 _years) external view returns (uint256);
    function register(
        string calldata _label,
        uint64  _donateYears,
        address _owner,
        address _nftContract,
        uint256 _tokenId,
        bytes calldata _contenthash
    ) external payable returns (bytes32);
}

interface IOwnable     { function owner() external view returns (address); }
interface IAccessCtrl  { function hasRole(bytes32 role, address account) external view returns (bool); }

/**
 * @title ArtIDForwarder
 *
 * @notice Single entry point for collectors. Splits payment between (optional)
 *         artist treasury and the ArtIDRegistrar's ENS donation flow.
 *
 *         Pricing: registrar.donationPrice(years) for the ENS contribution
 *         (zero if years = 0) + the artist's configured per-mint fee. The
 *         platform takes nothing here.
 *
 *         Artist onboarding is on-chain (no off-chain signer). Artists call
 *         setArtistTerms(collection, treasury, fee); we verify they control
 *         the collection via Ownable.owner() or AccessControl.hasRole.
 */
contract ArtIDForwarder is Ownable, ReentrancyGuard {

    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);
    IArtIDRegistrar public immutable REGISTRAR;

    struct ArtistTerms {
        address payable treasury;
        uint96  fee;
        bool    active;
    }
    mapping(address => ArtistTerms) public artistTerms;
    uint256 public maxArtistFee = 0.05 ether;

    /// @notice Per-mint platform fee. Paid to platformTreasury on every register().
    uint256 public platformFee;
    address payable public platformTreasury;

    event ArtistTermsSet(address indexed collection, address indexed treasury, uint256 fee);
    event ArtistTermsCleared(address indexed collection);
    event ArtistPaid(address indexed collection, address indexed treasury, uint256 amount);
    event PlatformPaid(address indexed treasury, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformTreasuryUpdated(address oldTreasury, address newTreasury);
    event MaxArtistFeeUpdated(uint256 oldMax, uint256 newMax);

    error ArtistFeeTooHigh();
    error InsufficientPayment(uint256 required, uint256 provided);
    error NotCollectionOwner();
    error TransferFailed();
    error ZeroAddress();

    constructor(
        address _registrar,
        address payable _platformTreasury,
        uint256 _platformFee,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_registrar == address(0) || _platformTreasury == address(0)) revert ZeroAddress();
        REGISTRAR = IArtIDRegistrar(_registrar);
        platformTreasury = _platformTreasury;
        platformFee = _platformFee;
    }

    // ─── Artist onboarding ─────────────────────────────────

    function setArtistTerms(address _collection, address payable _treasury, uint256 _fee) external {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_fee > maxArtistFee) revert ArtistFeeTooHigh();
        if (!_isCollectionAdmin(_collection, msg.sender)) revert NotCollectionOwner();
        artistTerms[_collection] = ArtistTerms({ treasury: _treasury, fee: uint96(_fee), active: true });
        emit ArtistTermsSet(_collection, _treasury, _fee);
    }

    function clearArtistTerms(address _collection) external {
        if (msg.sender != owner() && !_isCollectionAdmin(_collection, msg.sender)) revert NotCollectionOwner();
        delete artistTerms[_collection];
        emit ArtistTermsCleared(_collection);
    }

    function _isCollectionAdmin(address _collection, address _who) internal view returns (bool) {
        try IOwnable(_collection).owner() returns (address o) { if (o == _who) return true; } catch {}
        try IAccessCtrl(_collection).hasRole(DEFAULT_ADMIN_ROLE, _who) returns (bool h) { if (h) return true; } catch {}
        return false;
    }

    function getArtistTerms(address _collection)
        external view returns (address treasury, uint256 fee, bool active)
    {
        ArtistTerms storage t = artistTerms[_collection];
        return (t.treasury, t.fee, t.active);
    }

    /// @notice Total required ETH = ENS donation + platform fee + artist fee (if active).
    function totalCost(address _nftContract, uint64 _donateYears) public view returns (uint256) {
        uint256 base = REGISTRAR.donationPrice(_donateYears) + platformFee;
        ArtistTerms storage t = artistTerms[_nftContract];
        return t.active ? base + t.fee : base;
    }

    // ─── Registration ──────────────────────────────────────

    function register(
        string calldata _label,
        uint64  _donateYears,
        address _nftContract,
        uint256 _tokenId,
        bytes calldata _contenthash
    )
        external payable nonReentrant returns (bytes32 node)
    {
        uint256 donation = REGISTRAR.donationPrice(_donateYears);
        uint256 fee = platformFee;
        ArtistTerms memory t = artistTerms[_nftContract];
        uint256 artistFee = t.active ? uint256(t.fee) : 0;
        uint256 required = donation + fee + artistFee;
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        if (fee > 0) {
            (bool ok, ) = platformTreasury.call{value: fee}("");
            if (!ok) revert TransferFailed();
            emit PlatformPaid(platformTreasury, fee);
        }

        if (artistFee > 0) {
            (bool ok, ) = t.treasury.call{value: artistFee}("");
            if (!ok) revert TransferFailed();
            emit ArtistPaid(_nftContract, t.treasury, artistFee);
        }

        node = REGISTRAR.register{value: donation}(
            _label, _donateYears, msg.sender, _nftContract, _tokenId, _contenthash
        );

        uint256 spent = donation + fee + artistFee;
        if (msg.value > spent) {
            (bool ok, ) = msg.sender.call{value: msg.value - spent}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ─── Admin ─────────────────────────────────────────────

    function setMaxArtistFee(uint256 _max) external onlyOwner {
        emit MaxArtistFeeUpdated(maxArtistFee, _max);
        maxArtistFee = _max;
    }

    function setPlatformFee(uint256 _fee) external onlyOwner {
        emit PlatformFeeUpdated(platformFee, _fee);
        platformFee = _fee;
    }

    function setPlatformTreasury(address payable _t) external onlyOwner {
        if (_t == address(0)) revert ZeroAddress();
        emit PlatformTreasuryUpdated(platformTreasury, _t);
        platformTreasury = _t;
    }

    function rescueETH(address payable _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        (bool ok, ) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }
}
