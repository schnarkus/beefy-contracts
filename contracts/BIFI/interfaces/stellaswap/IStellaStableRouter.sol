// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.9.0;

interface IStellaStableRouter {
    function addLiquidity(
        address pool,
        address basePool,
        uint256[] calldata meta_amounts,
        uint256[] calldata base_amounts,
        uint256 minToMint,
        uint256 deadline
    ) external returns (uint256);

    function calculateConvert(address fromPool, address toPool, uint256 amount) external view returns (uint256);

    function calculateRemoveBaseLiquidityOneToken(
        address pool,
        address basePool,
        uint256 _token_amount,
        uint8 iBase
    ) external view returns (uint256 availableTokenAmount);

    function calculateRemoveLiquidity(
        address pool,
        address basePool,
        uint256 amount
    ) external view returns (uint256[] calldata meta_amounts, uint256[] calldata base_amounts);

    function calculateSwapFromBase(
        address pool,
        address basePool,
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx
    ) external view returns (uint256);

    function calculateSwapToBase(
        address pool,
        address basePool,
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx
    ) external view returns (uint256);

    function calculateTokenAmount(
        address pool,
        address basePool,
        uint256[] calldata meta_amounts,
        uint256[] calldata base_amounts,
        bool is_deposit
    ) external view returns (uint256);

    function convert(
        address fromPool,
        address toPool,
        uint256 amount,
        uint256 minToMint,
        uint256 deadline
    ) external returns (uint256);

    function removeBaseLiquidityOneToken(
        address pool,
        address basePool,
        uint256 _token_amount,
        uint8 i,
        uint256 _min_amount,
        uint256 deadline
    ) external returns (uint256);

    function removeLiquidity(
        address pool,
        address basePool,
        uint256 _amount,
        uint256[] calldata min_amounts_meta,
        uint256[] calldata min_amounts_base,
        uint256 deadline
    ) external returns (uint256[] calldata amounts, uint256[] calldata base_amounts);

    function swapFromBase(
        address pool,
        address basePool,
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy,
        uint256 deadline
    ) external returns (uint256);

    function swapToBase(
        address pool,
        address basePool,
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy,
        uint256 deadline
    ) external returns (uint256);
}
