// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockNameWrapper {
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => uint64) public expiries;
    mapping(bytes32 => uint32) public fuses;

    event SubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry);
    event SubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry);
    event ExpiryExtended(bytes32 parentNode, bytes32 labelhash, uint64 expiry);

    function setSubnodeRecord(
        bytes32 parentNode,
        string memory label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 _fuses,
        uint64 expiry
    ) external returns (bytes32 node) {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        owners[node] = owner;
        expiries[node] = expiry;
        fuses[node] = _fuses;
        emit SubnodeRecord(parentNode, label, owner, resolver, ttl, _fuses, expiry);
    }

    function setSubnodeOwner(
        bytes32 parentNode,
        string memory label,
        address owner,
        uint32 _fuses,
        uint64 expiry
    ) external returns (bytes32 node) {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        owners[node] = owner;
        expiries[node] = expiry;
        fuses[node] = _fuses;
        emit SubnodeOwner(parentNode, label, owner, _fuses, expiry);
    }

    function extendExpiry(bytes32 parentNode, bytes32 labelhash, uint64 expiry) external returns (uint64) {
        bytes32 node = keccak256(abi.encodePacked(parentNode, labelhash));
        expiries[node] = expiry;
        emit ExpiryExtended(parentNode, labelhash, expiry);
        return expiry;
    }

    function isWrapped(bytes32) external pure returns (bool) { return true; }
    function ownerOf(uint256 id) external view returns (address) { return owners[bytes32(id)]; }
}

contract MockPublicResolver {
    mapping(bytes32 => bytes) public hashes;

    function setContenthash(bytes32 node, bytes calldata hash) external {
        hashes[node] = hash;
    }

    function contenthash(bytes32 node) external view returns (bytes memory) {
        return hashes[node];
    }
}

contract RejectingRecipient {
    fallback() external payable { revert("nope"); }
    receive() external payable { revert("nope"); }
}

/// @notice Mock Ownable NFT collection — its owner() return value drives ArtIDForwarder auth checks.
contract MockOwnableCollection {
    address public owner;
    constructor(address _owner) { owner = _owner; }
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not-owner");
        owner = newOwner;
    }
}

/// @notice Mock AccessControl collection — returns true for hasRole only for the given admin.
contract MockAccessControlCollection {
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);
    address public admin;
    constructor(address _admin) { admin = _admin; }
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return role == DEFAULT_ADMIN_ROLE && account == admin;
    }
    // Intentionally no `owner()` so the forwarder's Ownable try-call reverts and falls through.
}

/// @notice Collection that exposes neither owner() nor hasRole() — auth must fail.
contract MockOpaqueCollection {}
