// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMasterChef {
    struct UserInfoOutput {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 pending;
        uint256 userBalance;
        uint256 poolBalance;
    }

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accERC20PerShare;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) external;

    function allUserInfo(address _user) external view returns (UserInfoOutput[] memory);

    function batchHarvest(uint256[] memory _pids) external;

    function currentRewardPerBlock() external view returns (uint256);

    function decayPeriod() external view returns (uint256);

    function deposit(uint256 _pid, uint256 _amount) external;

    function deposited(uint256 _pid, address _user) external view returns (uint256);

    function emergencyWithdraw(uint256 _pid) external;

    function harvest(uint256 _pid) external;

    function massUpdatePools() external;

    function paidOut() external view returns (uint256);

    function pending(uint256 _pid, address _user) external view returns (uint256);

    function poolBalance(uint256 _pid) external view returns (uint256);

    function poolInfo(uint256 _pid) external view returns (PoolInfo memory);

    function poolLength() external view returns (uint256);

    function poolTokens(address _token) external view returns (bool);

    function rewardPerBlock(uint256 year) external pure returns (uint256);

    function rewardToken() external view returns (IERC20);

    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external;

    function startBlock() external view returns (uint256);

    function totalAllocPoint() external view returns (uint256);

    function totalPending() external view returns (uint256);

    function updatePool(uint256 _pid) external;

    function userInfo(uint256 _pid, address _user) external view returns (UserInfo memory);

    function withdraw(uint256 _pid, uint256 _amount) external;
}
