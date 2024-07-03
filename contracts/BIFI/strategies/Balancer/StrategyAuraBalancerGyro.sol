// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/curve/IRewardsGauge.sol";
import "../../interfaces/aura/IAuraBooster.sol";
import "../../interfaces/aura/IAuraRewardPool.sol";
import "../../interfaces/beefy/IBeefySwapper.sol";
import "../../interfaces/beethovenx/IBalancerVault.sol";
import "../Common/StratFeeManagerInitializable.sol";
import "./BalancerActionsLib.sol";
import "./BeefyBalancerStructs.sol";

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);

    function getTokenRates() external view returns (uint256, uint256);
}

interface IMinter {
    function mint(address gauge) external;
}

interface IAaveWrapper {
    function deposit(uint256 amount, address reciever) external;

    function convertToAssets(uint256 amount) external returns (uint256);
}

contract StrategyAuraBalancerGyro is StratFeeManagerInitializable {
    using SafeERC20 for IERC20;

    // Tokens used
    address public want;
    address public output;
    address public native;
    address public lp0;
    address public lp1;
    address public constant usdc = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address public constant staticAaveUSDC = 0x7CFaDFD5645B50bE87d546f42699d863648251ad;

    // Third party contracts
    address public rewardPool;
    uint256 public pid;
    address public rewardsGauge;
    address public constant balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public constant booster = 0x98Ef32edd24e2c92525E59afc4475C1242a30184;

    // Gauge details
    bool public isAura;
    bool public balSwapOn;

    // Balancer Router set up
    IBalancerVault.SwapKind public swapKind;
    IBalancerVault.FundManagement public funds;

    // Swap details
    bool public useAave;
    uint256 public aaveIndex;
    BeefyBalancerStructs.BatchSwapStruct[] public lp0ToLp1Route;
    address[] public lp0ToLp1Assets;

    // Our needed reward token information
    address[] public rewards;

    // Some needed state variables
    bool public harvestOnDeposit;
    uint256 public lastHarvest;
    uint256 public totalLocked;
    uint256 public constant DURATION = 1 hours;

    event StratHarvest(address indexed harvester, uint256 indexed wantHarvested, uint256 indexed tvl);
    event Deposit(uint256 indexed tvl);
    event Withdraw(uint256 indexed tvl);
    event ChargedFees(uint256 indexed callFees, uint256 indexed beefyFees, uint256 indexed strategistFees);

    function initialize(
        address _want,
        bool _isAura,
        uint256 _pid,
        address _rewardsGauge,
        bool _balSwapOn,
        bool _useAave,
        uint256 _aaveIndex,
        address _native,
        address _output,
        address[] memory _lp0ToLp1Assets,
        BeefyBalancerStructs.BatchSwapStruct[] memory _lp0ToLp1Route,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);

        want = _want;
        isAura = _isAura;
        useAave = _useAave;
        aaveIndex = _aaveIndex;

        output = _output;
        native = _native;
        lp0 = _lp0ToLp1Assets[0];
        lp1 = _lp0ToLp1Assets[_lp0ToLp1Assets.length - 1];
        setRoute(_lp0ToLp1Route, _lp0ToLp1Assets);

        if (isAura) {
            pid = _pid;
            (, , , rewardPool, , ) = IAuraBooster(booster).poolInfo(pid);
            rewardsGauge = address(0);
            balSwapOn = false;
        } else {
            pid = 0;
            rewardPool = address(0);
            rewardsGauge = _rewardsGauge;
            setBalSwapOn(_balSwapOn);
        }

        swapKind = IBalancerVault.SwapKind.GIVEN_IN;
        funds = IBalancerVault.FundManagement(address(this), false, payable(address(this)), false);

        setHarvestOnDeposit(true);
        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            if (isAura) {
                IAuraBooster(booster).deposit(pid, wantBal, true);
            } else {
                IRewardsGauge(rewardsGauge).deposit(wantBal);
            }
            emit Deposit(balanceOf());
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            if (isAura) {
                IAuraRewardPool(rewardPool).withdrawAndUnwrap(_amount - wantBal, false);
            } else {
                IRewardsGauge(rewardsGauge).withdraw(_amount - wantBal);
            }
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        if (tx.origin != owner() && !paused()) {
            uint256 withdrawalFeeAmount = (wantBal * withdrawalFee) / WITHDRAWAL_MAX;
            wantBal = wantBal - withdrawalFeeAmount;
        }

        IERC20(want).safeTransfer(vault, wantBal);

        emit Withdraw(balanceOf());
    }

    function beforeDeposit() external override {
        if (harvestOnDeposit) {
            require(msg.sender == vault, "!vault");
            _harvest(tx.origin);
        }
    }

    function harvest() external virtual {
        _harvest(tx.origin);
    }

    function harvest(address callFeeRecipient) external virtual {
        _harvest(callFeeRecipient);
    }

    // compounds earnings and charges performance fee
    function _harvest(address callFeeRecipient) internal whenNotPaused {
        uint256 before = balanceOfWant();
        if (isAura) {
            IAuraRewardPool(rewardPool).getReward();
        } else {
            if (balSwapOn) {
                IMinter minter = IMinter(IRewardsGauge(rewardsGauge).bal_pseudo_minter());
                minter.mint(rewardsGauge);
            }
            IRewardsGauge(rewardsGauge).claim_rewards();
        }

        swapRewardsToNative();
        uint256 nativeBal = IERC20(native).balanceOf(address(this));

        if (nativeBal > 0) {
            chargeFees(callFeeRecipient);
            addLiquidity();
            uint256 wantHarvested = balanceOfWant() - before;
            totalLocked = wantHarvested + lockedProfit();
            deposit();

            lastHarvest = block.timestamp;
            emit StratHarvest(msg.sender, wantHarvested, balanceOf());
        }
    }

    function swapRewardsToNative() internal {
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        if (outputBal > 0) IBeefySwapper(unirouter).swap(output, native, outputBal);

        // convert additional rewards
        if (rewards.length != 0) {
            for (uint i; i < rewards.length; i++) {
                address reward = rewards[i];
                uint256 toNative = IERC20(reward).balanceOf(address(this));
                if (toNative > 0) IBeefySwapper(unirouter).swap(reward, native, toNative);
            }
        }
    }

    // performance fees
    function chargeFees(address callFeeRecipient) internal {
        IFeeConfig.FeeCategory memory fees = getFees();
        uint256 nativeBal = (IERC20(native).balanceOf(address(this)) * fees.total) / DIVISOR;

        uint256 callFeeAmount = (nativeBal * fees.call) / DIVISOR;
        IERC20(native).safeTransfer(callFeeRecipient, callFeeAmount);

        uint256 beefyFeeAmount = (nativeBal * fees.beefy) / DIVISOR;
        IERC20(native).safeTransfer(beefyFeeRecipient, beefyFeeAmount);

        uint256 strategistFeeAmount = (nativeBal * fees.strategist) / DIVISOR;
        IERC20(native).safeTransfer(strategist, strategistFeeAmount);

        emit ChargedFees(callFeeAmount, beefyFeeAmount, strategistFeeAmount);
    }

    // adds liquidity to AMM and gets more LP tokens
    function addLiquidity() internal {
        uint256 nativeBal = IERC20(native).balanceOf(address(this));
        if (useAave && nativeBal > 0) {
            IBeefySwapper(unirouter).swap(native, usdc, nativeBal);
            IAaveWrapper(staticAaveUSDC).deposit(IERC20(usdc).balanceOf(address(this)), address(this));
            nativeBal = IERC20(staticAaveUSDC).balanceOf(address(this));
        }

        address swapToken = useAave ? staticAaveUSDC : native;

        bytes32 poolId = IBalancerPool(want).getPoolId();
        (address[] memory lpTokens, , ) = IBalancerVault(balancerVault).getPoolTokens(poolId);

        if (lpTokens[0] != swapToken) {
            IBeefySwapper(unirouter).swap(swapToken, lp0, nativeBal);
        }

        if (nativeBal > 0) {
            uint256 lp0Bal = IERC20(lpTokens[0]).balanceOf(address(this));
            (uint256 lp0Amt, uint256 lp1Amt) = _calcSwapAmount(lp0Bal);

            IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                lp0ToLp1Route,
                lp1Amt
            );
            BalancerActionsLib.balancerSwap(balancerVault, swapKind, _swaps, lp0ToLp1Assets, funds, int256(lp1Amt));

            BalancerActionsLib.multiJoin(
                balancerVault,
                want,
                poolId,
                lpTokens[0],
                lpTokens[1],
                lp0Amt,
                IERC20(lpTokens[1]).balanceOf(address(this))
            );
        }
    }

    function _calcSwapAmount(uint256 _bal) private returns (uint256 lp0Amt, uint256 lp1Amt) {
        lp0Amt = _bal / 2;
        lp1Amt = _bal - lp0Amt;

        (uint256 rate0, uint256 rate1) = IBalancerPool(want).getTokenRates();

        (, uint256[] memory balances, ) = IBalancerVault(balancerVault).getPoolTokens(IBalancerPool(want).getPoolId());
        uint256 supply = IERC20(want).totalSupply();

        uint256 amountA;
        uint256 amountB;
        if (aaveIndex == 0) {
            amountA = (IAaveWrapper(staticAaveUSDC).convertToAssets(balances[0]) * 1e18) / supply;
            amountB = (balances[1] * 1e18) / supply;
        } else if (aaveIndex == 1) {
            amountA = (balances[0] * 1e18) / supply;
            amountB = (IAaveWrapper(staticAaveUSDC).convertToAssets(balances[1]) * 1e18) / supply;
        } else {
            amountA = (balances[0] * 1e18) / supply;
            amountB = (balances[1] * 1e18) / supply;
        }

        uint256 ratio = rate0 * 1e18 / rate1 * amountB / amountA;
        lp0Amt = _bal * 1e18 / (ratio + 1e18);
        lp1Amt = _bal - lp0Amt;

        return (lp0Amt, lp1Amt);
    }

    function lockedProfit() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastHarvest;
        uint256 remaining = elapsed < DURATION ? DURATION - elapsed : 0;
        return (totalLocked * remaining) / DURATION;
    }

    // calculate the total underlaying 'want' held by the strat
    function balanceOf() public view returns (uint256) {
        return balanceOfWant() + balanceOfPool() - lockedProfit();
    }

    // calculates how much 'want' this contract holds
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // calculates how much 'want' the strategy has working in the farm
    function balanceOfPool() public view returns (uint256) {
        if (isAura) {
            return IAuraRewardPool(rewardPool).balanceOf(address(this));
        } else {
            return IRewardsGauge(rewardsGauge).balanceOf(address(this));
        }
    }

    // returns rewards unharvested
    function rewardsAvailable() public view returns (uint256) {
        if (isAura) {
            return IAuraRewardPool(rewardPool).earned(address(this));
        } else {
            return IRewardsGauge(rewardsGauge).claimable_reward(address(this), output);
        }
    }

    function callReward() public pure returns (uint256) {
        return 0;
    }

    function addReward(address _reward) external onlyOwner {
        IERC20(_reward).safeApprove(unirouter, type(uint).max);
        rewards.push(_reward);
    }

    function removeLastReward() external onlyManager {
        address reward = rewards[rewards.length - 1];
        IERC20(reward).safeApprove(unirouter, 0);
        rewards.pop();
    }

    function setRoute(
        BeefyBalancerStructs.BatchSwapStruct[] memory _lp0ToLp1Route,
        address[] memory _lp0ToLp1Assets
    ) public onlyOwner {
        delete lp0ToLp1Route;
        delete lp0ToLp1Assets;

        for (uint k = 0; k < _lp0ToLp1Route.length; k++) {
            lp0ToLp1Route.push(_lp0ToLp1Route[k]);
        }
        lp0ToLp1Assets = _lp0ToLp1Assets;
    }

    function setBalSwapOn(bool _balSwapOn) public onlyOwner {
        balSwapOn = _balSwapOn;
    }

    function setHarvestOnDeposit(bool _harvestOnDeposit) public onlyOwner {
        harvestOnDeposit = _harvestOnDeposit;

        if (harvestOnDeposit) {
            setWithdrawalFee(0);
        } else {
            setWithdrawalFee(10);
        }
    }

    // called as part of strat migration. Sends all the available funds back to the vault
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        if (isAura) {
            IAuraRewardPool(rewardPool).withdrawAndUnwrap(balanceOfPool(), false);
        } else {
            IRewardsGauge(rewardsGauge).withdraw(balanceOfPool());
        }

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems
    function panic() public onlyManager {
        pause();
        if (isAura) {
            IAuraRewardPool(rewardPool).withdrawAndUnwrap(balanceOfPool(), false);
        } else {
            IRewardsGauge(rewardsGauge).withdraw(balanceOfPool());
        }
    }

    function pause() public onlyManager {
        _pause();

        _removeAllowances();
    }

    function unpause() external onlyManager {
        _unpause();

        _giveAllowances();

        deposit();
    }

    function _giveAllowances() internal {
        if (isAura) {
            IERC20(want).safeApprove(booster, type(uint).max);
        } else {
            IERC20(want).safeApprove(rewardsGauge, type(uint).max);
        }

        IERC20(output).safeApprove(unirouter, type(uint).max);
        IERC20(native).safeApprove(unirouter, type(uint).max);

        if (useAave) {
            IERC20(usdc).safeApprove(staticAaveUSDC, type(uint).max);
            IERC20(staticAaveUSDC).safeApprove(balancerVault, type(uint).max);
        }

        IERC20(lp0).safeApprove(balancerVault, 0);
        IERC20(lp0).safeApprove(balancerVault, type(uint).max);

        IERC20(lp1).safeApprove(balancerVault, 0);
        IERC20(lp1).safeApprove(balancerVault, type(uint).max);

        if (rewards.length != 0) {
            for (uint i; i < rewards.length; i++) {
                IERC20(rewards[i]).safeApprove(unirouter, 0);
            }
        }
    }

    function _removeAllowances() internal {
        if (isAura) {
            IERC20(want).safeApprove(booster, 0);
        } else {
            IERC20(want).safeApprove(rewardsGauge, 0);
        }

        IERC20(output).safeApprove(unirouter, 0);
        IERC20(native).safeApprove(unirouter, 0);

        if (useAave) {
            IERC20(usdc).safeApprove(staticAaveUSDC, 0);
            IERC20(staticAaveUSDC).safeApprove(balancerVault, 0);
        }

        IERC20(lp0).safeApprove(balancerVault, 0);
        IERC20(lp1).safeApprove(balancerVault, 0);

        if (rewards.length != 0) {
            for (uint i; i < rewards.length; i++) {
                IERC20(rewards[i]).safeApprove(unirouter, type(uint).max);
            }
        }
    }
}
