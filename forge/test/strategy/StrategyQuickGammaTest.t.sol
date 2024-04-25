// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "../../../contracts/BIFI/strategies/Gamma/StrategyQuickGamma.sol";
import "./BaseStrategyTest.t.sol";

contract StrategyQuickGammaTest is BaseStrategyTest {
    StrategyQuickGamma strategy;

    function createStrategy(address _impl) internal override returns (address) {
        if (_impl == a0) strategy = new StrategyQuickGamma();
        else strategy = StrategyQuickGamma(_impl);
        return address(strategy);
    }

    function test_harvestRatio() external {
        _depositIntoVault(user, wantAmount);
        uint vaultBalance = vault.balance();
        console.log("Vault balance before harvest", vaultBalance);
        assertGe(vaultBalance, wantAmount, "Vault balance < wantAmount");

        skip(1 days);
        console.log("Harvesting vault");
        vm.prank(strategy.keeper());
        strategy.setFastQuote(true);
        strategy.harvest();
        console.log("Vault balance", strategy.balanceOfPool());
        assertGt(vault.balance(), vaultBalance, "Harvested 0");
        assertEq(IERC20(strategy.native()).balanceOf(address(strategy)), 0, "native balance != 0");
        assertEq(IERC20(strategy.lpToken0()).balanceOf(address(strategy)), 0, "lp0 balance != 0");
        assertEq(IERC20(strategy.lpToken1()).balanceOf(address(strategy)), 0, "lp1 balance != 0");
    }

    function test_harvestRatioFastQuote() external {
        _depositIntoVault(user, wantAmount);
        uint vaultBalance = vault.balance();
        console.log("Vault balance before harvest", vaultBalance);
        assertGe(vaultBalance, wantAmount, "Vault balance < wantAmount");

        skip(1 days);
        console.log("Harvesting vault");
        vm.prank(strategy.keeper());
        strategy.setFastQuote(true);
        strategy.harvest();
        console.log("Vault balance", strategy.balanceOfPool());
        assertGt(vault.balance(), vaultBalance, "Harvested 0");
        assertEq(IERC20(strategy.native()).balanceOf(address(strategy)), 0, "native balance != 0");
        assertEq(IERC20(strategy.lpToken0()).balanceOf(address(strategy)), 0, "lp0 balance != 0");
        assertEq(IERC20(strategy.lpToken1()).balanceOf(address(strategy)), 0, "lp1 balance != 0");
    }
}
