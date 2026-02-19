// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ContextSnapshot.sol";

interface IERC8004IdentityRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

contract ContextSnapshotFactory {
    IERC8004IdentityRegistry public immutable agentRegistry;
    address[] public snapshots;

    event SnapshotCreated(address indexed snapshot, string topic, address indexed creator);

    constructor(address _agentRegistry) {
        agentRegistry = IERC8004IdentityRegistry(_agentRegistry);
    }

    modifier onlyRegisteredAgent() {
        require(agentRegistry.balanceOf(msg.sender) > 0, "Not a registered ERC-8004 agent");
        _;
    }

    function createSnapshot(string calldata topic) external onlyRegisteredAgent returns (address) {
        ContextSnapshot snapshot = new ContextSnapshot(topic, msg.sender);
        snapshots.push(address(snapshot));
        emit SnapshotCreated(address(snapshot), topic, msg.sender);
        return address(snapshot);
    }

    function getSnapshots() external view returns (address[] memory) {
        return snapshots;
    }
}
