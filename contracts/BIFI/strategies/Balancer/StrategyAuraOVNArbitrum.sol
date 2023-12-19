// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/common/IUniswapRouterETH.sol";
import "../../interfaces/beethovenx/IBalancerVault.sol";
import "../../interfaces/aura/IAuraRewardPool.sol";
import "../../interfaces/curve/IStreamer.sol";
import "../../interfaces/aura/IAuraBooster.sol";
import "../Common/StratFeeManagerInitializable.sol";
import "./BalancerActionsLib.sol";
import "./BeefyBalancerStructs.sol";
import "../../utils/UniV3Actions.sol";

interface IBalancerPool {
    function getPoolId() external view returns (bytes32);
}

interface ICurveSwap {
    function exchange_underlying(int128 i, int128 j, uint256 _dx, uint256 _min_dy) external returns (uint256);
}

interface IWrapper {
    function wrap(address asset, uint256 amount, address receiver) external returns (uint256);
}

contract StrategyAuraOVNArbitrum is StratFeeManagerInitializable {
    using SafeERC20 for IERC20;

    // tokens used
    address public want;
    address public output;
    address public native;
    address public usdc;
    address public usdp;

    BeefyBalancerStructs.Input public input;
    mapping(address => BeefyBalancerStructs.Reward) public rewards;
    address[] public rewardTokens;

    // third party contracts
    address public booster;
    address public rewardPool;
    uint256 public pid;
    address public uniswapRouter;
    address public sushiRouter;
    address public curvepool;
    address public wrapper;

    IBalancerVault.SwapKind public swapKind;
    IBalancerVault.FundManagement public funds;

    // routes
    BeefyBalancerStructs.BatchSwapStruct[] public outputToNativeRoute;
    address[] public outputToNativeAssets;
    address[] public nativeToInputAssets;
    address[] public nativeToUSDCRoute;

    bool public harvestOnDeposit;
    uint256 public lastHarvest;

    event StratHarvest(address indexed harvester, uint256 indexed wantHarvested, uint256 indexed tvl);
    event Deposit(uint256 indexed tvl);
    event Withdraw(uint256 indexed tvl);
    event ChargedFees(uint256 indexed callFees, uint256 indexed beefyFees, uint256 indexed strategistFees);

    function initialize(
        address _want,
        BeefyBalancerStructs.BatchSwapStruct[] memory _outputToNativeRoute,
        address[] memory _outputToNative,
        address[] memory _nativeToInput,
        address[] memory _nativeToUSDCRoute,
        address _booster,
        uint256 _pid,
        bool _inputIsComposable,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);

        for (uint i; i < _outputToNativeRoute.length; ++i) {
            outputToNativeRoute.push(_outputToNativeRoute[i]);
        }

        nativeToUSDCRoute = _nativeToUSDCRoute;

        want = _want;
        booster = _booster;
        pid = _pid;
        outputToNativeAssets = _outputToNative;
        nativeToInputAssets = _nativeToInput;
        output = outputToNativeAssets[0];
        native = nativeToInputAssets[0];
        input.input = nativeToInputAssets[nativeToInputAssets.length - 1];
        input.isComposable = _inputIsComposable;

        uniswapRouter = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
        sushiRouter = address(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);
        curvepool = address(0xb34a7d1444a707349Bc7b981B7F2E1f20F81F013);
        wrapper = address(0x149Eb6E777aDa78D383bD93c57D45a9A71b171B1);

        usdc = address(0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8);
        usdp = address(0xe80772Eaf6e2E18B651F160Bc9158b2A5caFCA65);

        (, , , rewardPool, , ) = IAuraBooster(booster).poolInfo(pid);

        swapKind = IBalancerVault.SwapKind.GIVEN_IN;
        funds = IBalancerVault.FundManagement(address(this), false, payable(address(this)), false);

        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IAuraBooster(booster).deposit(pid, wantBal, true);
            emit Deposit(balanceOf());
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IAuraRewardPool(rewardPool).withdrawAndUnwrap(_amount - wantBal, false);
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
        IAuraRewardPool(rewardPool).getReward();
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

    // wraps usd+ to wusd+
    function wrapTokens() internal {
        uint256 toWrap = IERC20(usdp).balanceOf(address(this));
        require(toWrap > 0, "No tokens to wrap");

        IERC20(usdp).safeApprove(wrapper, toWrap);
        IWrapper(wrapper).wrap(usdp, toWrap, address(this));
        IERC20(usdp).safeApprove(wrapper, 0);
    }

    // adds liquidity to balancer and gets more tokens
    function addLiquidity() internal {
        uint256 toUSDC = IERC20(native).balanceOf(address(this));
        if (toUSDC > 0) {
            IUniswapRouterETH(sushiRouter).swapExactTokensForTokens(
                toUSDC,
                0,
                nativeToUSDCRoute,
                address(this),
                block.timestamp
            );
        }

        uint256 toUSDP = IERC20(usdc).balanceOf(address(this));
        if (toUSDP > 0) {
            ICurveSwap(curvepool).exchange_underlying(2, 0, toUSDP, 0);
        }

        wrapTokens();

        uint256 inputBal = IERC20(input.input).balanceOf(address(this));
        BalancerActionsLib.balancerJoin(unirouter, IBalancerPool(want).getPoolId(), input.input, inputBal);
    }

    // calculate the total underlaying 'want' held by the strat
    function balanceOf() public view returns (uint256) {
        return balanceOfWant() + balanceOfPool();
    }

    // calculates how much 'want' this contract holds
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // calculates how much 'want' the strategy has working in the farm
    function balanceOfPool() public view returns (uint256) {
        return IAuraRewardPool(rewardPool).balanceOf(address(this));
    }

    // returns rewards unharvested
    function rewardsAvailable() public view returns (uint256) {
        return IAuraRewardPool(rewardPool).earned(address(this));
    }

    // native reward amount for calling harvest
    function callReward() public pure returns (uint256) {
        return 0;
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

    function setHarvestOnDeposit(bool _harvestOnDeposit) external onlyManager {
        harvestOnDeposit = _harvestOnDeposit;

        if (harvestOnDeposit) {
            setWithdrawalFee(0);
        } else {
            setWithdrawalFee(10);
        }
    }

    // called as part of strat migration, sends all the available funds back to the vault
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IAuraRewardPool(rewardPool).withdrawAndUnwrap(balanceOfPool(), false);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems
    function panic() public onlyManager {
        pause();
        IAuraRewardPool(rewardPool).withdrawAndUnwrap(balanceOfPool(), false);
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
        IERC20(want).safeApprove(booster, type(uint).max);
        IERC20(output).safeApprove(unirouter, type(uint).max);
        IERC20(native).safeApprove(sushiRouter, type(uint).max);
        IERC20(usdc).safeApprove(curvepool, type(uint).max);
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
        IERC20(want).safeApprove(booster, 0);
        IERC20(output).safeApprove(unirouter, 0);
        IERC20(native).safeApprove(sushiRouter, 0);
        IERC20(usdc).safeApprove(curvepool, 0);
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
