// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeERC20} from "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin-4/contracts/token/ERC20/IERC20.sol";

import {IMasterChef} from "../../interfaces/stellaswap/IMasterChef.sol";
import {UniswapV3Utils} from "../../utils/UniswapV3Utils.sol";
import {AlgebraUtils} from "../../utils/AlgebraUtils.sol";
import {IStableRouter} from "../../interfaces/stellaswap/IStableRouter.sol";
import "../Common/StratFeeManagerInitializable.sol";

contract StrategyStellaswapStable is StratFeeManagerInitializable {
    using SafeERC20 for IERC20;

    // Tokens used
    address public native;
    address public output;
    address public want;
    address public input;

    // Third party contracts
    address public chef;
    uint256 public pid;
    address public stableRouter;
    uint256 public depositIndex;

    bool public uniswapType;

    bool public harvestOnDeposit;
    uint256 public lastHarvest;

    bytes public outputToNativePath;
    bytes public nativeToInputPath;

    mapping(address => bytes) public rewardsPath;
    address[] public rewards;

    event StratHarvest(address indexed harvester, uint256 wantHarvested, uint256 tvl);
    event Deposit(uint256 tvl);
    event Withdraw(uint256 tvl);
    event ChargedFees(uint256 callFees, uint256 beefyFees, uint256 strategistFees);

    function initialize(
        address _want,
        address _input,
        address _chef,
        uint256 _pid,
        address _stableRouter,
        bool _uniswapType,
        bytes calldata _outputToNativePath,
        bytes calldata _nativeToInputPath,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);
        want = _want;
        input = _input;
        chef = _chef;
        pid = _pid;
        stableRouter = _stableRouter;
        depositIndex = IStableRouter(stableRouter).getTokenIndex(input);
        uniswapType = _uniswapType;

        address[] memory route = uniswapType
            ? UniswapV3Utils.pathToRoute(_outputToNativePath)
            : AlgebraUtils.pathToRoute(_outputToNativePath);
        output = route[0];
        native = route[route.length - 1];

        setOutputToNative(_outputToNativePath);
        setNativeToInput(_nativeToInputPath);

        harvestOnDeposit = true;
        withdrawalFee = 0;

        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IMasterChef(chef).deposit(pid, wantBal);
            emit Deposit(balanceOf());
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IMasterChef(chef).withdraw(pid, _amount - wantBal);
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

    function beforeDeposit() external virtual override {
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
        IMasterChef(chef).deposit(pid, 0);
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        uint256 before = balanceOfWant();
        if (outputBal > 0) {
            swapRewardsToNative();
            chargeFees(callFeeRecipient);
            addLiquidity();
            uint256 wantHarvested = balanceOfWant() - before;
            deposit();

            lastHarvest = block.timestamp;
            emit StratHarvest(msg.sender, wantHarvested, balanceOf());
        }
    }

    function swapRewardsToNative() internal {
        uint bal = IERC20(output).balanceOf(address(this));
        if (output != native) {
            if (bal > 0)
                uniswapType
                    ? UniswapV3Utils.swap(unirouter, outputToNativePath, bal)
                    : AlgebraUtils.swap(unirouter, outputToNativePath, bal);
        }

        for (uint i; i < rewards.length; ++i) {
            uint rewardBal = IERC20(rewards[i]).balanceOf(address(this));
            if (rewardBal > 0)
                uniswapType
                    ? UniswapV3Utils.swap(unirouter, rewardsPath[rewards[i]], rewardBal)
                    : AlgebraUtils.swap(unirouter, rewardsPath[rewards[i]], rewardBal);
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
        uint256 toInput = IERC20(native).balanceOf(address(this));
        if (nativeToInputPath.length > 0) {
            uniswapType
                ? UniswapV3Utils.swap(unirouter, nativeToInputPath, toInput)
                : AlgebraUtils.swap(unirouter, nativeToInputPath, toInput);
        }

        uint256 numberOfTokens = IStableRouter(stableRouter).getNumberOfTokens();
        uint256[] memory inputs = new uint256[](numberOfTokens);
        inputs[depositIndex] = IERC20(input).balanceOf(address(this));
        IStableRouter(stableRouter).addLiquidity(inputs, 1, block.timestamp);
    }

    function addReward(address _token, bytes calldata _path) external onlyOwner {
        address[] memory route = uniswapType ? UniswapV3Utils.pathToRoute(_path) : AlgebraUtils.pathToRoute(_path);
        require(route[0] == _token, "!output");
        require(route[route.length - 1] == native, "!native");

        IERC20(_token).safeApprove(unirouter, 0);
        IERC20(_token).safeApprove(unirouter, type(uint).max);

        rewards.push(_token);
        rewardsPath[_token] = _path;
    }

    function deleteRewards() external onlyManager {
        for (uint256 i; i < rewards.length; ++i) {
            delete rewardsPath[rewards[i]];
        }

        delete rewards;
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
        (uint256 _amount, , , ) = IMasterChef(chef).userInfo(pid, address(this));
        return _amount;
    }

    // returns rewards unharvested
    function rewardsAvailable() public view returns (address[] memory, uint256[] memory) {
        (address[] memory addresses, , , uint256[] memory amounts) = IMasterChef(chef).pendingTokens(
            pid,
            address(this)
        );
        return (addresses, amounts);
    }

    // native reward amount for calling harvest
    function callReward() public pure returns (uint256) {
        return 0;
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

        if (balanceOfPool() > 0) {
            IMasterChef(chef).emergencyWithdraw(pid);
        }

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        IMasterChef(chef).emergencyWithdraw(pid);
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
        IERC20(want).approve(chef, type(uint).max);
        IERC20(output).approve(unirouter, type(uint).max);
        IERC20(native).approve(unirouter, type(uint).max);

        for (uint i; i < rewards.length; ++i) {
            IERC20(rewards[i]).safeApprove(unirouter, 0);
            IERC20(rewards[i]).safeApprove(unirouter, type(uint).max);
        }

        IERC20(input).approve(stableRouter, 0);
        IERC20(input).safeApprove(stableRouter, type(uint).max);
    }

    function _removeAllowances() internal {
        IERC20(want).approve(chef, 0);
        IERC20(output).approve(unirouter, 0);
        IERC20(native).approve(unirouter, 0);

        for (uint i; i < rewards.length; ++i) {
            IERC20(rewards[i]).safeApprove(unirouter, 0);
        }

        IERC20(input).safeApprove(stableRouter, 0);
    }

    function setOutputToNative(bytes calldata _outputToNativePath) public onlyOwner {
        if (_outputToNativePath.length > 0) {
            address[] memory route = uniswapType
                ? UniswapV3Utils.pathToRoute(_outputToNativePath)
                : AlgebraUtils.pathToRoute(_outputToNativePath);
            require(route[0] == output, "!output");
        }
        outputToNativePath = _outputToNativePath;
    }

    function setNativeToInput(bytes calldata _nativeToInputPath) public onlyOwner {
        if (_nativeToInputPath.length > 0) {
            address[] memory route = uniswapType
                ? UniswapV3Utils.pathToRoute(_nativeToInputPath)
                : AlgebraUtils.pathToRoute(_nativeToInputPath);
            require(route[0] == native, "!native");
            require(route[route.length - 1] == input, "!input");
        }
        nativeToInputPath = _nativeToInputPath;
    }

    function outputToNative() external view returns (address[] memory) {
        return
            uniswapType ? UniswapV3Utils.pathToRoute(outputToNativePath) : AlgebraUtils.pathToRoute(outputToNativePath);
    }

    function nativeToInput() external view returns (address[] memory) {
        return
            uniswapType ? UniswapV3Utils.pathToRoute(nativeToInputPath) : AlgebraUtils.pathToRoute(nativeToInputPath);
    }

    function rewardsRoute(uint index) external view returns (address[] memory) {
        return
            uniswapType
                ? UniswapV3Utils.pathToRoute(rewardsPath[rewards[index]])
                : AlgebraUtils.pathToRoute(rewardsPath[rewards[index]]);
    }
}
