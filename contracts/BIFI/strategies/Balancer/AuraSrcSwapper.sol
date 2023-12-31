// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../interfaces/common/IWrappedNative.sol";
import "../../lz/NonblockingLzApp.sol";
import "../../utils/UniV3Actions.sol";

interface IOFT {
    function sendFrom(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;

    function estimateSendFee(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        bool _useZro,
        bytes calldata _adapterParams
    ) external view returns (uint256 nativeFee, uint256 zroFee);
}

// Swaps Aura and sends ETH back to src chain strategy
contract AuraSrcSwapper is NonblockingLzApp {
    using SafeERC20 for IERC20;

    address public aura;
    address public native;
    address public stargate;
    bytes public auraSwapper;
    uint256 public gasLimit;

    struct SwapConfig {
        bool shouldSwap;
        address router;
        bytes path;
        address tokenFrom;
        address tokenTo;
        bool deadline;
    }

    SwapConfig public swapConfig;
    mapping(address => bool) public operators; // Operators allowed to call retry().
    uint16 public dstChainId;
    uint16 private version = 1;

    // Errors
    error NotEnoughAura();
    error NotEnoughEth();
    error EtherTransferFailure();
    error NotAuthorized();

    event Swap(address _strategy, uint256 _amount);
    event SwapCompleted(address _strategy, uint256 _amount);
    event Error();

    constructor(
        address _aura,
        address _native,
        address _stargate,
        address _endpoint,
        bytes memory _auraSwapper,
        uint16 _dstChainId
    ) NonblockingLzApp(_endpoint) {
        aura = _aura;
        native = _native;
        stargate = _stargate;
        auraSwapper = _auraSwapper;
        dstChainId = _dstChainId;
    }

    modifier onlyAuth() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    function _returnNative(address _strategy) public {
        if (msg.sender != address(this)) revert NotAuthorized();
        if (swapConfig.shouldSwap) {
            uint256 bal = IERC20(swapConfig.tokenFrom).balanceOf(address(this));
            _approveTokenIfNeeded(swapConfig.router, swapConfig.tokenFrom);
            if (swapConfig.deadline) UniV3Actions.swapV3WithDeadline(swapConfig.router, swapConfig.path, bal);
            else UniV3Actions.swapV3(swapConfig.router, swapConfig.path, bal);
        }

        uint256 _amount = address(this).balance;
        uint256 wrappedBalance = IERC20(native).balanceOf(address(this));
        if (_amount > 0) IWrappedNative(native).deposit{value: _amount}();
        _amount += wrappedBalance;

        IERC20(native).safeTransfer(_strategy, _amount);
        emit SwapCompleted(_strategy, _amount);
    }

    function sgReceive(
        uint16 /*_chainId */,
        bytes memory /* _srcAddress */,
        uint256 /* _nonce */,
        address /*token*/,
        uint256 /*amountLD*/,
        bytes memory payload
    ) external payable {
        if (msg.sender != stargate) revert NotAuthorized();
        address strategy = abi.decode(payload, (address));
        try this._returnNative(strategy) {
            // Do Nothing
        } catch {
            emit Error();
        }
    }

    function swapAura(uint256 _amount) external payable {
        IERC20(aura).safeTransferFrom(msg.sender, address(this), _amount);

        bytes memory adapterParams = abi.encodePacked(version, gasLimit);
        bytes memory payload = abi.encode(msg.sender, _amount);

        (uint256 transferGas, ) = IOFT(aura).estimateSendFee(dstChainId, auraSwapper, _amount, false, adapterParams);

        (uint256 messageGas, ) = lzEndpoint.estimateFees(dstChainId, address(this), payload, false, adapterParams);

        IOFT(aura).sendFrom{value: transferGas}(
            address(this),
            dstChainId,
            auraSwapper,
            _amount,
            payable(msg.sender),
            address(0),
            ""
        );

        _lzSend( // {value: messageFee} will be paid out of this contract!
            dstChainId, // destination chainId
            payload, // abi.encode()'ed bytes
            payable(msg.sender), // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0), // future param, unused for this example
            adapterParams, // v1 adapterParams, specify custom destination gas qty
            messageGas
        );

        emit Swap(msg.sender, _amount);
    }

    function estimate(uint256 _amount) external view returns (uint256 gasNeeded) {
        bytes memory adapterParams = abi.encodePacked(version, gasLimit);
        bytes memory payload = abi.encode(msg.sender, _amount);
        (uint256 transferGas, ) = IOFT(aura).estimateSendFee(dstChainId, auraSwapper, _amount, false, adapterParams);

        (uint256 messageGas, ) = lzEndpoint.estimateFees(dstChainId, address(this), payload, false, adapterParams);

        return transferGas + messageGas;
    }

    function setOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
    }

    function setBridgeConfig(uint256 _gasLimit, bytes memory _auraSwapper, address _stargate) external onlyOwner {
        if (_gasLimit > 0) gasLimit = _gasLimit;
        if (_auraSwapper.length > 0) auraSwapper = _auraSwapper;
        if (_stargate != address(0)) stargate = _stargate;
    }

    function setSwap(SwapConfig calldata _swapConfig) external onlyOwner {
        swapConfig = _swapConfig;
    }

    // recover any tokens sent on error
    function inCaseTokensGetStuck(address _token, bool _native) external onlyOwner {
        if (_native) {
            uint256 _nativeAmount = address(this).balance;
            (bool sent, ) = msg.sender.call{value: _nativeAmount}("");
            if (!sent) revert EtherTransferFailure();
        } else {
            uint256 _amount = IERC20(_token).balanceOf(address(this));
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
    }

    function _nonblockingLzReceive(uint16, bytes memory, uint64, bytes memory) internal override {}

    function _approveTokenIfNeeded(address token, address spender) private {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            IERC20(token).safeApprove(spender, type(uint256).max);
        }
    }

    // allow this contract to receive ether
    receive() external payable {}
}
