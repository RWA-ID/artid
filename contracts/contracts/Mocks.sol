// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockNameWrapper {
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => uint64)  public expiries;
    mapping(bytes32 => uint32)  public fuses;

    event SubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry);
    event SubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry);
    event ExpiryExtended(bytes32 parentNode, bytes32 labelhash, uint64 expiry);

    function setParentExpiry(bytes32 node, uint64 expiry) external { expiries[node] = expiry; }

    function setSubnodeRecord(bytes32 parentNode, string memory label, address owner, address resolver, uint64 ttl, uint32 _fuses, uint64 expiry)
        external returns (bytes32 node)
    {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        owners[node] = owner; expiries[node] = expiry; fuses[node] = _fuses;
        emit SubnodeRecord(parentNode, label, owner, resolver, ttl, _fuses, expiry);
    }

    function setSubnodeOwner(bytes32 parentNode, string memory label, address owner, uint32 _fuses, uint64 expiry)
        external returns (bytes32 node)
    {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        owners[node] = owner; expiries[node] = expiry; fuses[node] = _fuses;
        emit SubnodeOwner(parentNode, label, owner, _fuses, expiry);
    }

    function extendExpiry(bytes32 parentNode, bytes32 labelhash, uint64 expiry) external returns (uint64) {
        bytes32 node = keccak256(abi.encodePacked(parentNode, labelhash));
        expiries[node] = expiry;
        emit ExpiryExtended(parentNode, labelhash, expiry);
        return expiry;
    }

    function ownerOf(uint256 id) external view returns (address) { return owners[bytes32(id)]; }
    function getData(uint256 id) external view returns (address, uint32, uint64) {
        return (owners[bytes32(id)], fuses[bytes32(id)], expiries[bytes32(id)]);
    }
}

contract MockPublicResolver {
    mapping(bytes32 => bytes) public hashes;
    function setContenthash(bytes32 node, bytes calldata hash) external { hashes[node] = hash; }
    function contenthash(bytes32 node) external view returns (bytes memory) { return hashes[node]; }
}

/// @notice Simulates ETHRegistrarController. price = pricePerSecond * duration.
contract MockController {
    uint256 public pricePerSecond;
    MockNameWrapper public wrapper;
    bytes32 public parentNode;

    event Renewed(string name, uint256 duration, uint256 paid);

    constructor(MockNameWrapper _wrapper, bytes32 _parentNode, uint256 _pricePerSecond) {
        wrapper = _wrapper; parentNode = _parentNode; pricePerSecond = _pricePerSecond;
    }

    struct Price { uint256 base; uint256 premium; }
    function rentPrice(string calldata, uint256 duration) external view returns (Price memory) {
        return Price({ base: pricePerSecond * duration, premium: 0 });
    }

    function renew(string calldata name, uint256 duration) external payable {
        uint256 required = pricePerSecond * duration;
        require(msg.value >= required, "underpaid");
        // Bump parent expiry on the wrapper
        uint64 current = wrapper.expiries(parentNode);
        wrapper.setParentExpiry(parentNode, current + uint64(duration));
        emit Renewed(name, duration, msg.value);
    }
}

contract RejectingRecipient {
    fallback() external payable { revert("nope"); }
    receive() external payable { revert("nope"); }
}

contract MockOwnableCollection {
    address public owner;
    constructor(address _owner) { owner = _owner; }
}

contract MockAccessControlCollection {
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);
    address public admin;
    constructor(address _admin) { admin = _admin; }
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return role == DEFAULT_ADMIN_ROLE && account == admin;
    }
}

contract MockOpaqueCollection {}
