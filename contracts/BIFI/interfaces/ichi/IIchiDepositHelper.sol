// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IIchiDepositHelper {
    function forwardDepositToICHIVault(
        address vault,
        address vaultDeployer,
        address token,
        uint256 amount,
        uint256 minimumProceeds,
        address to
    ) external returns (uint256 vaultTokens);
}
