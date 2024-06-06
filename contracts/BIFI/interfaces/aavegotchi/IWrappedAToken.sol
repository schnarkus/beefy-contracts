// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.9.0;

interface IWrappedAToken {
    function enterWithUnderlying(uint256 assets) external returns (uint256 shares);
}
