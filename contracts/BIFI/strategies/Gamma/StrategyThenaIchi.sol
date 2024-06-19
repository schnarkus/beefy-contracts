// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/common/IRewardPool.sol";
import "../../interfaces/ichi/IIchiDepositHelper.sol";
import "../Common/StratFeeManagerInitializable.sol";
import "../../utils/GasFeeThrottler.sol";
import "../../utils/AlgebraUtils.sol";

contract StrategyThenaIchi is StratFeeManagerInitializable, GasFeeThrottler {
    using SafeERC20 for IERC20;

    // Tokens used
    address public constant native = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant output = 0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11;
    address public want;
    address public depositToken;

    // Third party contracts
    address public rewardPool;
    address public ichiDepositHelper;
    address public vaultDeployer;

    bool public harvestOnDeposit;
    uint256 public lastHarvest;

    bytes public outputToNativePath;
    bytes public nativeToDepositPath;

    event StratHarvest(address indexed harvester, uint256 wantHarvested, uint256 tvl);
    event Deposit(uint256 tvl);
    event Withdraw(uint256 tvl);
    event ChargedFees(uint256 callFees, uint256 beefyFees, uint256 strategistFees);

    function initialize(
        address _want,
        address _rewardPool,
        address _depositToken,
        address _ichiDepositHelper,
        address _vaultDeployer,
        bytes calldata _outputToNativePath,
        bytes calldata _nativeToDepositPath,
        CommonAddresses calldata _commonAddresses
    ) public initializer {
        __StratFeeManager_init(_commonAddresses);
        want = _want;
        rewardPool = _rewardPool;
        depositToken = _depositToken;
        ichiDepositHelper = _ichiDepositHelper;
        vaultDeployer = _vaultDeployer;

        setOutputToNative(_outputToNativePath);
        setNativeToDeposit(_nativeToDepositPath);

        harvestOnDeposit = true;
        withdrawalFee = 0;

        _giveAllowances();
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IRewardPool(rewardPool).deposit(wantBal);
            emit Deposit(balanceOf());
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IRewardPool(rewardPool).withdraw(_amount - wantBal);
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

    function harvest() external virtual gasThrottle {
        _harvest(tx.origin);
    }

    function harvest(address callFeeRecipient) external virtual gasThrottle {
        _harvest(callFeeRecipient);
    }

    // compounds earnings and charges performance fee
    function _harvest(address callFeeRecipient) internal whenNotPaused {
        IRewardPool(rewardPool).getReward();
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        if (outputBal > 0) {
            swapRewardsToNative();
            chargeFees(callFeeRecipient);
            addLiquidity();
            uint256 wantHarvested = balanceOfWant();
            deposit();

            lastHarvest = block.timestamp;
            emit StratHarvest(msg.sender, wantHarvested, balanceOf());
        }
    }

    function swapRewardsToNative() internal {
        uint bal = IERC20(output).balanceOf(address(this));
        AlgebraUtils.swap(unirouter, outputToNativePath, bal);
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

        if (native != depositToken) {
            AlgebraUtils.swap(unirouter, nativeToDepositPath, nativeBal);
        }

        uint256 depositTokenBal = IERC20(depositToken).balanceOf(address(this));
        IIchiDepositHelper(ichiDepositHelper).forwardDepositToICHIVault(
            want,
            vaultDeployer,
            depositToken,
            depositTokenBal,
            0,
            address(this)
        );
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
        return IRewardPool(rewardPool).balanceOf(address(this));
    }

    // returns rewards unharvested
    function rewardsAvailable() public view returns (uint256) {
        return IRewardPool(rewardPool).earned(address(this));
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

    function setShouldGasThrottle(bool _shouldGasThrottle) external onlyManager {
        shouldGasThrottle = _shouldGasThrottle;
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        if (balanceOfPool() > 0) {
            if (IRewardPool(rewardPool).emergency()) IRewardPool(rewardPool).emergencyWithdraw();
            else IRewardPool(rewardPool).withdraw(balanceOfPool());
        }

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        if (IRewardPool(rewardPool).emergency()) IRewardPool(rewardPool).emergencyWithdraw();
        else IRewardPool(rewardPool).withdraw(balanceOfPool());
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
        IERC20(want).approve(rewardPool, type(uint).max);
        IERC20(output).approve(unirouter, type(uint).max);
        IERC20(native).approve(unirouter, type(uint).max);

        IERC20(depositToken).approve(ichiDepositHelper, 0);
        IERC20(depositToken).approve(ichiDepositHelper, type(uint).max);
    }

    function _removeAllowances() internal {
        IERC20(want).approve(rewardPool, 0);
        IERC20(output).approve(unirouter, 0);
        IERC20(native).approve(unirouter, 0);

        IERC20(depositToken).approve(ichiDepositHelper, 0);
    }

    function setOutputToNative(bytes calldata _outputToNativePath) public onlyOwner {
        if (_outputToNativePath.length > 0) {
            address[] memory route = AlgebraUtils.pathToRoute(_outputToNativePath);
            require(route[0] == output, "!output");
        }
        outputToNativePath = _outputToNativePath;
    }

    function setNativeToDeposit(bytes calldata _nativeToDepositPath) public onlyOwner {
        if (_nativeToDepositPath.length > 0) {
            address[] memory route = AlgebraUtils.pathToRoute(_nativeToDepositPath);
            require(route[0] == native, "!native");
            require(route[route.length - 1] == depositToken, "!deposit");
        }
        nativeToDepositPath = _nativeToDepositPath;
    }

    function outputToNative() external view returns (address[] memory) {
        return AlgebraUtils.pathToRoute(outputToNativePath);
    }

    function nativeToDeposit() external view returns (address[] memory) {
        return AlgebraUtils.pathToRoute(nativeToDepositPath);
    }
}
