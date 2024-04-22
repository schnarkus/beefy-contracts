// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../../interfaces/common/ITraderJoeRouter.sol";

library BeefyBalancerStructs {
    enum RouterType {
        BALANCER,
        UNISWAP_V2,
        UNISWAP_V3,
        TRADER_JOE
    }
    struct BatchSwapStruct {
        bytes32 poolId;
        uint256 assetInIndex;
        uint256 assetOutIndex;
    }

    struct Reward {
        RouterType routerType;
        address router;
        mapping(uint => BatchSwapStruct) swapInfo;
        address[] assets;
        bytes routeToNative; // backup route in case there is no Balancer liquidity for reward
        ITraderJoeRouter.Path joePath;
        uint minAmount; // minimum amount to be swapped to native
    }

    struct Input {
        address input;
        bool isComposable;
        bool isBeets;
    }
}
