// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin-4/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin-4/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin-4/contracts/access/Ownable.sol";
import "@openzeppelin-4/contracts/utils/Counters.sol";
import "@openzeppelin-4/contracts/interfaces/IERC2981.sol";
import "@openzeppelin-4/contracts/security/ReentrancyGuard.sol";

contract DGNPUNKS is ERC721, Ownable, IERC2981, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant PRICE = 69 * 10 ** 18;
    uint256 public constant MAX_PER_TX = 4;
    uint256 public constant ROYALTY_FEE_PERCENT = 1;

    string public baseURI;
    string public baseExtension = ".json";

    bool public mintStarted = true;

    address public royaltyReceiver;
    IERC20 public paymentToken;

    constructor(address _paymentToken) ERC721("Degen Punks", "DGNPUNKS") {
        royaltyReceiver = 0xc8f566901B02Bf19154ce056977c814569693EE3;
        baseURI = "ipfs://QmNbc4dRTQisArFkr7LebztAwCiD4LbC4zcTCrQEsadSZp/";
        paymentToken = IERC20(_paymentToken);
    }

    // only owner

    function setMintStarted(bool _state) external onlyOwner {
        mintStarted = _state;
    }

    function withdrawAll() external onlyOwner {
        uint256 tokenBalance = paymentToken.balanceOf(address(this));
        require(tokenBalance > 0, "Zero payment token balance");
        paymentToken.safeTransfer(owner(), tokenBalance);
    }

    // read

    function royaltyInfo(
        uint256,
        uint256 _salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = royaltyReceiver;
        royaltyAmount = (_salePrice * ROYALTY_FEE_PERCENT) / 100;
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    // internal and private

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function _mintSingleNFT() private {
        uint newTokenID = _tokenIdCounter.current() + 1;
        _safeMint(msg.sender, newTokenID);
        _tokenIdCounter.increment();
    }

    // add .json to token uri

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(abi.encodePacked(currentBaseURI, tokenId.toString(), baseExtension))
                : "";
    }

    // minting

    function mint(uint256 quantity) external nonReentrant {
        uint totalMinted = _tokenIdCounter.current();

        require(mintStarted, "Minting is not allowed");
        require(quantity <= MAX_PER_TX, "Exceeded maximum per transaction");
        require(totalMinted + quantity <= MAX_SUPPLY, "Exceeded maximum supply");

        uint256 paymentAmount = PRICE * quantity;
        paymentToken.safeTransferFrom(msg.sender, address(this), paymentAmount);

        for (uint256 i = 0; i < quantity; i++) {
            _mintSingleNFT();
        }
    }
}
