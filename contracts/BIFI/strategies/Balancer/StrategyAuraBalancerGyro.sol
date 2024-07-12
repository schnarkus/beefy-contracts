// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/beethovenx/IBalancerVault.sol";
import "../../interfaces/aura/IAuraRewardPool.sol";
import "../../interfaces/aura/IAuraBooster.sol";
import "../../interfaces/curve/IRewardsGauge.sol";
import "../Common/StratFeeManagerInitializable.sol";
import "./BalancerActionsLib.sol";
import "./BeefyBalancerStructs.sol";
import "../../utils/UniV3Actions.sol";

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);

    function getTokenRates() external view returns (uint256, uint256);
}

interface IMinter {
    function mint(address gauge) external;
}

contract StrategyAuraBalancerGyro is StratFeeManagerInitializable {
    using SafeERC20 for IERC20;

    // Tokens used
    address public want;
    address public output;
    address public native;
    address public lp0;
    address public lp1;

    // Third party contracts
    address public booster;
    address public rewardPool;
    address public uniswapRouter;
    uint256 public pid;
    address public rewardsGauge;

    // Balancer Router set up
    IBalancerVault.SwapKind public swapKind;
    IBalancerVault.FundManagement public funds;

    // Swap details
    BeefyBalancerStructs.BatchSwapStruct[] public nativeToLp0Route;
    BeefyBalancerStructs.BatchSwapStruct[] public lp0ToLp1Route;
    BeefyBalancerStructs.BatchSwapStruct[] public outputToNativeRoute;
    address[] public nativeToLp0Assets;
    address[] public lp0ToLp1Assets;
    address[] public outputToNativeAssets;

    // Our needed reward token information
    mapping(address => BeefyBalancerStructs.Reward) public rewards;
    address[] public rewardTokens;

    // Some needed state variables
    bool public harvestOnDeposit;
    uint256 public lastHarvest;
    uint256 public totalLocked;
    uint256 public constant DURATION = 1 hours;

    bool public isAura;
    bool public balSwapOn;

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
        BeefyBalancerStructs.BatchSwapStruct[] memory _nativeToLp0Route,
        BeefyBalancerStructs.BatchSwapStruct[] memory _lp0ToLp1Route,
        BeefyBalancerStructs.BatchSwapStruct[] memory _outputToNativeRoute,
        address[] memory _nativeToLp0Assets,
        address[] memory _lp0ToLp1Assets,
        address[] memory _outputToNativeAssets,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);

        want = _want;
        isAura = _isAura;
        booster = address(0x98Ef32edd24e2c92525E59afc4475C1242a30184);
        output = _outputToNativeAssets[0];
        native = _nativeToLp0Assets[0];
        lp0 = _lp0ToLp1Assets[0];
        lp1 = _lp0ToLp1Assets[_lp0ToLp1Assets.length - 1];
        uniswapRouter = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);

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

        setRoutes(
            _outputToNativeRoute,
            _nativeToLp0Route,
            _lp0ToLp1Route,
            _outputToNativeAssets,
            _nativeToLp0Assets,
            _lp0ToLp1Assets
        );
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
        if (outputBal > 0) {
            IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                outputToNativeRoute,
                outputBal
            );
            BalancerActionsLib.balancerSwap(
                unirouter,
                swapKind,
                _swaps,
                outputToNativeAssets,
                funds,
                int256(outputBal)
            );
        }

        // extras
        for (uint i; i < rewardTokens.length; ++i) {
            uint bal = IERC20(rewardTokens[i]).balanceOf(address(this));
            if (bal >= rewards[rewardTokens[i]].minAmount) {
                if (rewards[rewardTokens[i]].assets[0] != address(0)) {
                    BeefyBalancerStructs.BatchSwapStruct[] memory swapInfo = new BeefyBalancerStructs.BatchSwapStruct[](
                        rewards[rewardTokens[i]].assets.length - 1
                    );
                    for (uint j; j < rewards[rewardTokens[i]].assets.length - 1; ++j) {
                        swapInfo[j] = rewards[rewardTokens[i]].swapInfo[j];
                    }
                    IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                        swapInfo,
                        bal
                    );
                    BalancerActionsLib.balancerSwap(
                        unirouter,
                        swapKind,
                        _swaps,
                        rewards[rewardTokens[i]].assets,
                        funds,
                        int256(bal)
                    );
                } else {
                    UniV3Actions.swapV3WithDeadline(uniswapRouter, rewards[rewardTokens[i]].routeToNative, bal);
                }
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
        bytes32 poolId = IBalancerPool(want).getPoolId();
        (address[] memory lpTokens, , ) = IBalancerVault(unirouter).getPoolTokens(poolId);

        if (lpTokens[0] != native) {
            IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                nativeToLp0Route,
                nativeBal
            );
            BalancerActionsLib.balancerSwap(unirouter, swapKind, _swaps, nativeToLp0Assets, funds, int256(nativeBal));
        }

        if (nativeBal > 0) {
            uint256 lp0Bal = IERC20(lpTokens[0]).balanceOf(address(this));
            (uint256 lp0Amt, uint256 lp1Amt) = _calcSwapAmount(lp0Bal);

            IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                lp0ToLp1Route,
                lp1Amt
            );
            BalancerActionsLib.balancerSwap(unirouter, swapKind, _swaps, lp0ToLp1Assets, funds, int256(lp1Amt));

            BalancerActionsLib.multiJoin(
                unirouter,
                want,
                poolId,
                lpTokens[0],
                lpTokens[1],
                lp0Amt,
                IERC20(lpTokens[1]).balanceOf(address(this))
            );
        }
    }

    function _calcSwapAmount(uint256 _bal) private view returns (uint256 lp0Amt, uint256 lp1Amt) {
        lp0Amt = _bal / 2;
        lp1Amt = _bal - lp0Amt;

        (uint256 rate0, uint256 rate1) = IBalancerPool(want).getTokenRates();

        (, uint256[] memory balances, ) = IBalancerVault(unirouter).getPoolTokens(IBalancerPool(want).getPoolId());
        uint256 supply = IERC20(want).totalSupply();

        uint256 amountA = (balances[0] * 1e18) / supply;
        uint256 amountB = (balances[1] * 1e18) / supply;

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

    // native reward amount for calling harvest
    function callReward() public pure returns (uint256) {
        return 0; // multiple swap providers with no easy way to estimate native output
    }

    function addRewardToken(
        address _token,
        BeefyBalancerStructs.BatchSwapStruct[] memory _swapInfo,
        address[] memory _assets,
        bytes calldata _routeToNative,
        uint _minAmount
    ) external onlyOwner {
        require(_token != want, "!want");
        require(_token != native, "!native");
        if (_assets[0] != address(0)) {
            IERC20(_token).safeApprove(unirouter, 0);
            IERC20(_token).safeApprove(unirouter, type(uint).max);
        } else {
            IERC20(_token).safeApprove(uniswapRouter, 0);
            IERC20(_token).safeApprove(uniswapRouter, type(uint).max);
        }

        rewards[_token].assets = _assets;
        rewards[_token].routeToNative = _routeToNative;
        rewards[_token].minAmount = _minAmount;

        for (uint i; i < _swapInfo.length; ++i) {
            rewards[_token].swapInfo[i].poolId = _swapInfo[i].poolId;
            rewards[_token].swapInfo[i].assetInIndex = _swapInfo[i].assetInIndex;
            rewards[_token].swapInfo[i].assetOutIndex = _swapInfo[i].assetOutIndex;
        }
        rewardTokens.push(_token);
    }

    function resetRewardTokens() external onlyManager {
        for (uint i; i < rewardTokens.length; ++i) {
            delete rewards[rewardTokens[i]];
        }

        delete rewardTokens;
    }

    function setRoutes(
        BeefyBalancerStructs.BatchSwapStruct[] memory _outputToNativeRoute,
        BeefyBalancerStructs.BatchSwapStruct[] memory _nativeToLp0Route,
        BeefyBalancerStructs.BatchSwapStruct[] memory _lp0ToLp1Route,
        address[] memory _outputToNativeAssets,
        address[] memory _nativeToLp0Assets,
        address[] memory _lp0ToLp1Assets
    ) public onlyOwner {
        delete outputToNativeRoute;
        delete nativeToLp0Route;
        delete lp0ToLp1Route;
        delete outputToNativeAssets;
        delete nativeToLp0Assets;
        delete lp0ToLp1Assets;

        for (uint i = 0; i < _outputToNativeRoute.length; i++) {
            outputToNativeRoute.push(_outputToNativeRoute[i]);
        }
        outputToNativeAssets = _outputToNativeAssets;

        for (uint j = 0; j < _nativeToLp0Route.length; j++) {
            nativeToLp0Route.push(_nativeToLp0Route[j]);
        }
        nativeToLp0Assets = _nativeToLp0Assets;

        for (uint k = 0; k < _lp0ToLp1Route.length; k++) {
            lp0ToLp1Route.push(_lp0ToLp1Route[k]);
        }
        lp0ToLp1Assets = _lp0ToLp1Assets;
    }

    function setBalSwapOn(bool _balSwapOn) public onlyManager {
        balSwapOn = _balSwapOn;
    }

    function setHarvestOnDeposit(bool _harvestOnDeposit) public onlyManager {
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

        IERC20(lp0).safeApprove(unirouter, 0);
        IERC20(lp0).safeApprove(unirouter, type(uint).max);

        IERC20(lp1).safeApprove(unirouter, 0);
        IERC20(lp1).safeApprove(unirouter, type(uint).max);

        if (rewardTokens.length != 0) {
            for (uint i; i < rewardTokens.length; ++i) {
                if (rewards[rewardTokens[i]].assets[0] != address(0)) {
                    IERC20(rewardTokens[i]).safeApprove(unirouter, 0);
                    IERC20(rewardTokens[i]).safeApprove(unirouter, type(uint).max);
                } else {
                    IERC20(rewardTokens[i]).safeApprove(uniswapRouter, 0);
                    IERC20(rewardTokens[i]).safeApprove(uniswapRouter, type(uint).max);
                }
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
        IERC20(lp0).safeApprove(unirouter, 0);
        IERC20(lp1).safeApprove(unirouter, 0);
        if (rewardTokens.length != 0) {
            for (uint i; i < rewardTokens.length; ++i) {
                if (rewards[rewardTokens[i]].assets[0] != address(0)) {
                    IERC20(rewardTokens[i]).safeApprove(unirouter, 0);
                } else {
                    IERC20(rewardTokens[i]).safeApprove(uniswapRouter, 0);
                }
            }
        }
    }
}
