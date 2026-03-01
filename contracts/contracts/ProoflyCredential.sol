// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  ProoflyCredential
 * @notice Soulbound (non-transferable) ERC-721 credential NFT.
 *         Minted by the Proofly server after a birth certificate request
 *         is fulfilled and all personally-identifying data has been deleted.
 *
 *         Claims stored on-chain:
 *           - stateCode       — two-letter state abbreviation
 *           - isAgeOver18/21  — age range verified from the submitted ID
 *           - isStateResident — residency claim from submitted ID
 *           - certObtained    — always true at mint time
 *           - requestRef      — human-readable Proofly request ID (e.g. PRF-2026-ABCD)
 *           - attestedAt      — block timestamp of minting
 *
 *         Token URI resolves to: {baseURI}/api/credential-metadata/{tokenId}
 *         That endpoint is served by the Proofly Next.js app.
 *
 *         No PII is stored on-chain. The minter (Proofly server key) is the
 *         only address allowed to call mint(). Owner can rotate the minter
 *         key via setMinter().
 */
contract ProoflyCredential is ERC721, Ownable {
    using Strings for uint256;

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Credential {
        string  stateCode;
        bool    isAgeOver18;
        bool    isAgeOver21;
        bool    isStateResident;
        bool    certObtained;
        string  requestRef;
        uint256 attestedAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    mapping(uint256 => Credential) private _credentials;
    mapping(string  => uint256)    private _requestRefToTokenId;

    uint256 private _nextTokenId;
    string  private _baseTokenURI;
    address public  minter;

    // ── Events ────────────────────────────────────────────────────────────────

    event CredentialMinted(uint256 indexed tokenId, address indexed to, string requestRef);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    // ── Errors ────────────────────────────────────────────────────────────────

    error NotMinter();
    error AlreadyMinted(string requestRef);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialMinter, string memory baseTokenURI_)
        ERC721("Proofly Credential", "PRFLY")
        Ownable(msg.sender)
    {
        minter        = initialMinter;
        _baseTokenURI = baseTokenURI_;
        _nextTokenId  = 1;
    }

    // ── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint a credential to `to`. Only callable by the minter address.
     * @param to             Wallet address receiving the credential.
     * @param stateCode      Two-letter state code (e.g. "CO").
     * @param isAgeOver18    True if the requestor is verified 18+.
     * @param isAgeOver21    True if the requestor is verified 21+.
     * @param isStateResident True if the requestor is a resident of stateCode.
     * @param requestRef     Unique Proofly request reference (e.g. "PRF-2026-ABCD").
     */
    function mint(
        address to,
        string  calldata stateCode,
        bool    isAgeOver18,
        bool    isAgeOver21,
        bool    isStateResident,
        string  calldata requestRef
    ) external returns (uint256 tokenId) {
        if (msg.sender != minter)                     revert NotMinter();
        if (_requestRefToTokenId[requestRef] != 0)    revert AlreadyMinted(requestRef);

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _credentials[tokenId] = Credential({
            stateCode:       stateCode,
            isAgeOver18:     isAgeOver18,
            isAgeOver21:     isAgeOver21,
            isStateResident: isStateResident,
            certObtained:    true,
            requestRef:      requestRef,
            attestedAt:      block.timestamp
        });

        _requestRefToTokenId[requestRef] = tokenId;

        emit CredentialMinted(tokenId, to, requestRef);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the on-chain credential data for a given token.
     *         Reverts with ERC721NonexistentToken if tokenId does not exist.
     */
    function getCredential(uint256 tokenId) external view returns (Credential memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId];
    }

    /**
     * @notice Look up a token ID by its Proofly request reference.
     */
    function tokenByRequestRef(string calldata requestRef) external view returns (uint256) {
        uint256 tokenId = _requestRefToTokenId[requestRef];
        require(tokenId != 0, "ProoflyCredential: requestRef not found");
        return tokenId;
    }

    /**
     * @notice ERC-721 metadata URI — resolves to the Next.js credential-metadata endpoint.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, "/api/credential-metadata/", tokenId.toString());
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Rotate the minter key (e.g. after a server key rotation).
     */
    function setMinter(address newMinter) external onlyOwner {
        emit MinterUpdated(minter, newMinter);
        minter = newMinter;
    }

    /**
     * @notice Update the base URI (e.g. if the app domain changes).
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    // ── Soulbound ─────────────────────────────────────────────────────────────

    /**
     * @dev Block all transfers. Only minting (from == address(0)) is allowed.
     *      OZ v5 pattern: override _update instead of transferFrom/safeTransferFrom.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        require(from == address(0), "Soulbound: non-transferable");
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Disable approvals — they serve no purpose on a soulbound token.
     */
    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals disabled");
    }
}
