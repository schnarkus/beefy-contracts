// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/common/IUniswapRouterETH.sol";
import "../../interfaces/common/IWrappedNative.sol";
import "../../interfaces/solar/ISolarStableRouter.sol";
import "../../interfaces/stellaswap/IStellaStableRouter.sol";
import "../../interfaces/solar/ISolarChef.sol";
import "../Common/StratFeeManager.sol";
import "../../utils/GasFeeThrottler.sol";

struct StablePool {
    address pool;
    address router;
    uint8 depositIndex;
}

contract StrategySolarbeamMetaStable is StratFeeManager, GasFeeThrottler {
    using SafeERC20 for IERC20;

    // Tokens used
    address public native;
    address public output;
    address public want;
    address public input;

    // Pools
    StablePool public metapool;
    StablePool public basepool;

    // Third party contracts
    address public chef;
    uint256 public poolId;
    address public stellaStableRouter = address(0xB0Dfd6f3fdDb219E60fCDc1EA3D04B22f2FFa9Cc);

    bool public harvestOnDeposit;
    uint256 public lastHarvest;

    // Routes
    address[] public outputToNativeRoute;
    address[] public outputToInputRoute;
    address[][] public rewardToOutputRoute;

    event StratHarvest(address indexed harvester, uint256 wantHarvested, uint256 tvl);
    event Deposit(uint256 tvl);
    event Withdraw(uint256 tvl);
    event ChargedFees(uint256 callFees, uint256 beefyFees, uint256 strategistFees);

    constructor(
        address _want,
        uint256 _poolId,
        address _chef,
        address[] memory _metapoolAndRouter,
        address[] memory _basepoolAndRouter,
        CommonAddresses memory _commonAddresses,
        address[] memory _outputToNativeRoute,
        address[] memory _outputToInputRoute
    ) StratFeeManager(_commonAddresses) {
        want = _want;
        poolId = _poolId;
        chef = _chef;

        StablePool memory _metapool;
        StablePool memory _basepool;

        input = _outputToInputRoute[_outputToInputRoute.length - 1];

        require(_basepoolAndRouter.length == 2, "_basepoolAndRouter.length != 2");
        _basepool.pool = _basepoolAndRouter[0];
        _basepool.router = _basepoolAndRouter[1];
        _basepool.depositIndex = ISolarStableRouter(_basepool.router).getTokenIndex(input);
        basepool = _basepool;

        require(_metapoolAndRouter.length == 2, "_metapoolAndRouter.length != 2");
        _metapool.pool = _metapoolAndRouter[0];
        _metapool.router = _metapoolAndRouter[1];
        _metapool.depositIndex = ISolarStableRouter(_metapool.router).getTokenIndex(_basepool.pool);
        metapool = _metapool;

        output = _outputToNativeRoute[0];
        require(output == _outputToInputRoute[0], "output must match between routes");

        native = _outputToNativeRoute[_outputToNativeRoute.length - 1];
        outputToNativeRoute = _outputToNativeRoute;
        outputToInputRoute = _outputToInputRoute;

        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            ISolarChef(chef).deposit(poolId, wantBal);
            emit Deposit(balanceOf());
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            ISolarChef(chef).withdraw(poolId, _amount - wantBal);
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

    function harvest() external virtual gasThrottle {
        _harvest(tx.origin);
    }

    function harvest(address callFeeRecipient) external virtual gasThrottle {
        _harvest(callFeeRecipient);
    }

    function managerHarvest() external onlyManager {
        _harvest(tx.origin);
    }

    // compounds earnings and charges performance fee
    function _harvest(address callFeeRecipient) internal {
        ISolarChef(chef).deposit(poolId, 0);
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        if (outputBal > 0) {
            chargeFees(callFeeRecipient);
            addLiquidity();
            uint256 wantHarvested = balanceOfWant();
            deposit();

            lastHarvest = block.timestamp;
            emit StratHarvest(msg.sender, wantHarvested, balanceOf());
        }
    }

    // performance fees
    function chargeFees(address callFeeRecipient) internal {
        IFeeConfig.FeeCategory memory fees = getFees();

        if (rewardToOutputRoute.length != 0) {
            uint256 _length = rewardToOutputRoute.length;
            for (uint256 i; i < _length; ) {
                address _reward = rewardToOutputRoute[i][0];
                if (_reward == native) {
                    uint256 _nativeBal = address(this).balance;
                    if (_nativeBal > 0) {
                        IWrappedNative(native).deposit{value: _nativeBal}();
                    }
                }
                uint256 _rewardBal = IERC20(_reward).balanceOf(address(this));
                if (_rewardBal > 0) {
                    IUniswapRouterETH(unirouter).swapExactTokensForTokens(
                        _rewardBal,
                        0,
                        rewardToOutputRoute[i],
                        address(this),
                        block.timestamp
                    );
                }
                unchecked {
                    ++i;
                }
            }
        }

        uint256 toNative = (IERC20(output).balanceOf(address(this)) * fees.total) / DIVISOR;
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(
            toNative,
            0,
            outputToNativeRoute,
            address(this),
            block.timestamp
        );

        uint256 nativeBal = IERC20(native).balanceOf(address(this));

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
        address _baserouter = basepool.router;
        address _metarouter = metapool.router;

        // Swap output to input
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(
            outputBal,
            0,
            outputToInputRoute,
            address(this),
            block.timestamp
        );

        // Deposit input to basepool
        uint256 numberOfTokens = ISolarStableRouter(_baserouter).getNumberOfTokens();
        uint256[] memory inputs = new uint256[](numberOfTokens);
        inputs[basepool.depositIndex] = IERC20(input).balanceOf(address(this));
        ISolarStableRouter(_baserouter).addLiquidity(inputs, 1, block.timestamp);

        numberOfTokens = ISolarStableRouter(_metarouter).getNumberOfTokens();
        inputs = new uint256[](numberOfTokens);
        inputs[metapool.depositIndex] = IERC20(basepool.pool).balanceOf(address(this));
        ISolarStableRouter(_metarouter).addLiquidity(inputs, 1, block.timestamp);
    }

    // calculate the total underlaying 'want' held by the strat.
    function balanceOf() public view returns (uint256) {
        return balanceOfWant() + balanceOfPool();
    }

    // it calculates how much 'want' this contract holds.
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // it calculates how much 'want' the strategy has working in the farm.
    function balanceOfPool() public view returns (uint256) {
        (uint256 _amount, , , ) = ISolarChef(chef).userInfo(poolId, address(this));
        return _amount;
    }

    function rewardsAvailable() public view returns (address[] memory, uint256[] memory) {
        (address[] memory addresses, , , uint256[] memory amounts) = ISolarChef(chef).pendingTokens(
            poolId,
            address(this)
        );
        return (addresses, amounts);
    }

    function callReward() public view returns (uint256) {
        IFeeConfig.FeeCategory memory fees = getFees();
        (address[] memory rewardAdd, uint256[] memory rewardBal) = rewardsAvailable();
        address _output = output;
        uint256 _rewardRouteCount = rewardToOutputRoute.length;

        uint256 _outputBal;
        for (uint i; i < rewardAdd.length; ) {
            if (rewardAdd[i] == _output) {
                _outputBal += rewardBal[i];
            } else {
                for (uint j; j < _rewardRouteCount; ) {
                    if (rewardAdd[i] == rewardToOutputRoute[j][0]) {
                        uint256[] memory _balances = IUniswapRouterETH(unirouter).getAmountsOut(
                            rewardBal[i],
                            rewardToOutputRoute[j]
                        );
                        _outputBal += _balances[_balances.length - 1];
                    }
                    unchecked {
                        ++j;
                    }
                }
            }
            unchecked {
                ++i;
            }
        }

        uint256 _nativeBal;
        if (_outputBal > 0) {
            uint256[] memory amountOut = IUniswapRouterETH(unirouter).getAmountsOut(_outputBal, outputToNativeRoute);
            _nativeBal = amountOut[amountOut.length - 1];
        }

        return (((_nativeBal * fees.total) / DIVISOR) * fees.call) / DIVISOR;
    }

    function setHarvestOnDeposit(bool _harvestOnDeposit) external onlyManager {
        harvestOnDeposit = _harvestOnDeposit;

        if (harvestOnDeposit) {
            setWithdrawalFee(0);
        } else {
            setWithdrawalFee(10);
        }
    }

    function setShouldGasThrottle(bool _shouldGasThrottle) external onlyManager {
        shouldGasThrottle = _shouldGasThrottle;
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        ISolarChef(chef).emergencyWithdraw(poolId);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        ISolarChef(chef).emergencyWithdraw(poolId);
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
        IERC20(want).safeApprove(chef, type(uint256).max);
        IERC20(output).safeApprove(unirouter, type(uint256).max);
        IERC20(input).safeApprove(basepool.router, type(uint256).max);
        IERC20(basepool.pool).safeApprove(metapool.router, type(uint256).max);

        if (rewardToOutputRoute.length != 0) {
            for (uint i; i < rewardToOutputRoute.length; i++) {
                IERC20(rewardToOutputRoute[i][0]).safeApprove(unirouter, 0);
                IERC20(rewardToOutputRoute[i][0]).safeApprove(unirouter, type(uint256).max);
            }
        }
    }

    function _removeAllowances() internal {
        IERC20(want).safeApprove(chef, 0);
        IERC20(output).safeApprove(unirouter, 0);
        IERC20(input).safeApprove(basepool.router, 0);
        IERC20(basepool.pool).safeApprove(metapool.router, 0);

        if (rewardToOutputRoute.length != 0) {
            for (uint i; i < rewardToOutputRoute.length; i++) {
                IERC20(rewardToOutputRoute[i][0]).safeApprove(unirouter, 0);
            }
        }
    }

    function addRewardRoute(address[] memory _rewardToOutputRoute) external onlyOwner {
        IERC20(_rewardToOutputRoute[0]).safeApprove(unirouter, 0);
        IERC20(_rewardToOutputRoute[0]).safeApprove(unirouter, type(uint256).max);
        rewardToOutputRoute.push(_rewardToOutputRoute);
    }

    function removeLastRewardRoute() external onlyManager {
        address reward = rewardToOutputRoute[rewardToOutputRoute.length - 1][0];
        IERC20(reward).safeApprove(unirouter, 0);
        rewardToOutputRoute.pop();
    }

    function outputToNative() external view returns (address[] memory) {
        return outputToNativeRoute;
    }

    function outputToInput() external view returns (address[] memory) {
        return outputToInputRoute;
    }

    function rewardToOutput() external view returns (address[][] memory) {
        return rewardToOutputRoute;
    }

    function getMetapool() external view returns (StablePool memory) {
        return metapool;
    }

    function getBasepool() external view returns (StablePool memory) {
        return basepool;
    }

    receive() external payable {}
}
