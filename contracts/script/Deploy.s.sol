// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ContextSnapshotFactory.sol";

contract DeployScript is Script {
    address constant ERC8004_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        vm.startBroadcast();
        ContextSnapshotFactory factory = new ContextSnapshotFactory(ERC8004_REGISTRY);
        console.log("ContextSnapshotFactory deployed at:", address(factory));
        vm.stopBroadcast();
    }
}
