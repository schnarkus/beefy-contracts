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
}

interface IMinter {
    function mint(address gauge) external;
}

contract StrategyAuraBalancer is StratFeeManagerInitializable {
    using SafeERC20 for IERC20;

    // Tokens used
    address public want;
    address public output;
    address public native;

    BeefyBalancerStructs.Input public input;

    // Third party contracts
    address public booster;
    address public rewardPool;
    uint256 public pid;
    address public rewardsGauge;

    IBalancerVault.SwapKind public swapKind;
    IBalancerVault.FundManagement public funds;

    BeefyBalancerStructs.BatchSwapStruct[] public nativeToInputRoute;
    BeefyBalancerStructs.BatchSwapStruct[] public outputToNativeRoute;
    address[] public nativeToInputAssets;
    address[] public outputToNativeAssets;

    mapping(address => BeefyBalancerStructs.Reward) public rewards;
    address[] public rewardTokens;

    address public uniswapRouter;
    bool public harvestOnDeposit;
    uint256 public lastHarvest;

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
        bool _inputIsComposable,
        BeefyBalancerStructs.BatchSwapStruct[] memory _nativeToInputRoute,
        BeefyBalancerStructs.BatchSwapStruct[] memory _outputToNativeRoute,
        address[] memory _nativeToInput,
        address[] memory _outputToNative,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);

        want = _want;
        isAura = _isAura;
        booster = address(0x98Ef32edd24e2c92525E59afc4475C1242a30184);
        output = _outputToNative[0];
        native = _nativeToInput[0];
        input.input = _nativeToInput[_nativeToInput.length - 1];
        input.isComposable = _inputIsComposable;
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
            balSwapOn = _balSwapOn;
        }

        swapKind = IBalancerVault.SwapKind.GIVEN_IN;
        funds = IBalancerVault.FundManagement(address(this), false, payable(address(this)), false);

        setRoutes(_nativeToInputRoute, _outputToNativeRoute, _nativeToInput, _outputToNative);
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
                    for (uint j; j < rewards[rewardTokens[i]].assets.length - 1; ) {
                        swapInfo[j] = rewards[rewardTokens[i]].swapInfo[j];
                        unchecked {
                            ++j;
                        }
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

    // Adds liquidity to AMM and gets more LP tokens.
    function addLiquidity() internal {
        uint256 nativeBal = IERC20(native).balanceOf(address(this));
        if (native != input.input) {
            IBalancerVault.BatchSwapStep[] memory _swaps = BalancerActionsLib.buildSwapStructArray(
                nativeToInputRoute,
                nativeBal
            );
            BalancerActionsLib.balancerSwap(unirouter, swapKind, _swaps, nativeToInputAssets, funds, int256(nativeBal));
        }

        if (input.input != want) {
            uint256 inputBal = IERC20(input.input).balanceOf(address(this));
            BalancerActionsLib.balancerJoin(unirouter, IBalancerPool(want).getPoolId(), input.input, inputBal);
        }
    }

    // calculate the total underlying 'want' held by the strat.
    function balanceOf() public view returns (uint256) {
        return balanceOfWant() + balanceOfPool();
    }

    // it calculates how much 'want' this contract holds.
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // it calculates how much 'want' the strategy has working in the farm.
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
        return 0; // multiple swap providers with no easy way to estimate native output.
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
        BeefyBalancerStructs.BatchSwapStruct[] memory _nativeToInputRoute,
        BeefyBalancerStructs.BatchSwapStruct[] memory _outputToNativeRoute,
        address[] memory _nativeToInputAssets,
        address[] memory _outputToNativeAssets
    ) public onlyOwner {
        delete nativeToInputRoute;
        delete outputToNativeRoute;
        delete nativeToInputAssets;
        delete outputToNativeAssets;

        for (uint i = 0; i < _nativeToInputRoute.length; i++) {
            nativeToInputRoute.push(_nativeToInputRoute[i]);
        }

        for (uint j = 0; j < _outputToNativeRoute.length; j++) {
            outputToNativeRoute.push(_outputToNativeRoute[j]);
        }

        nativeToInputAssets = _nativeToInputAssets;
        outputToNativeAssets = _outputToNativeAssets;
    }

    function setHarvestOnDeposit(bool _harvestOnDeposit) external onlyManager {
        harvestOnDeposit = _harvestOnDeposit;

        if (harvestOnDeposit) {
            setWithdrawalFee(0);
        } else {
            setWithdrawalFee(10);
        }
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
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

    // pauses deposits and withdraws all funds from third party systems.
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
        if (!input.isComposable) {
            IERC20(input.input).safeApprove(unirouter, 0);
            IERC20(input.input).safeApprove(unirouter, type(uint).max);
        }
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
        if (!input.isComposable) {
            IERC20(input.input).safeApprove(unirouter, 0);
        }
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
