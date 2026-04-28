// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title AcademicCertificate (Soulbound Token / SBT)
 * @author Abd. Mugni Adji Susilo - Universitas Muslim Indonesia
 * @notice Smart contract for blockchain-based academic document verification
 *         using Soulbound Token (SBT) - a non-transferable NFT.
 *
 * @dev Inherits from ERC-721 with modifications:
 *      - Token CANNOT be transferred (Soulbound)
 *      - Token CANNOT be approved to third parties
 *      - Token can only be minted by Authorized Issuers
 *      - Token can be burned (revoked) by the original Issuer or Owner
 *
 * Workflow:
 * 1. Owner (system admin) registers an Issuer (university/institution).
 * 2. Issuer registers a certificate → SBT is minted to the student's wallet.
 * 3. Third parties verify via QR Code / documentId.
 * 4. Issuer/Owner can revoke (burn) the certificate if necessary.
 */
contract AcademicCertificate is ERC721, ERC721URIStorage {
    // ============================================================
    //                         STRUCTS
    // ============================================================

    /**
     * @notice Data structure for storing academic certificate information
     * @param documentId Unique document ID (format: UNIV-YEAR-NUMBER)
     * @param ipfsCID Content Identifier from IPFS (document file hash)
     * @param studentName Name of the student who owns the document
     * @param studentId Student ID number
     * @param studentWallet Student's wallet address (SBT recipient)
     * @param degree Education level (Bachelor, Master, Doctorate, etc.)
     * @param major Study program / major
     * @param issuerAddress Wallet address of the issuing institution
     * @param issuerName Name of the issuing institution
     * @param issuedAt Timestamp when the certificate was registered
     * @param isValid Certificate validity status (true = valid, false = revoked)
     * @param exists Flag to check if data exists in the mapping
     */
    struct Certificate {
        string documentId;
        string ipfsCID;
        string studentName;
        string studentId;
        address studentWallet;
        string degree;
        string major;
        address issuerAddress;
        string issuerName;
        uint256 issuedAt;
        bool isValid;
        bool exists;
    }

    // ============================================================
    //                      STATE VARIABLES
    // ============================================================

    /// @notice Contract owner address (main system admin)
    address public owner;

    /// @notice Counter for tokenId (auto-increment)
    uint256 private _nextTokenId;

    /// @notice Mapping documentId => Certificate data
    mapping(string => Certificate) private certificates;

    /// @notice Mapping documentId => tokenId
    mapping(string => uint256) public documentToTokenId;

    /// @notice Mapping tokenId => documentId
    mapping(uint256 => string) public tokenToDocumentId;

    /// @notice Mapping address => issuer status (true = authorized)
    mapping(address => bool) public authorizedIssuers;

    /// @notice Mapping issuer address => institution name
    mapping(address => string) public issuerNames;

    /// @notice Array to store all registered documentIds
    string[] public documentIds;

    /// @notice Total number of registered certificates
    uint256 public totalCertificates;

    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Event when a new certificate is registered (SBT minted)
    event CertificateRegistered(
        string indexed documentId,
        uint256 indexed tokenId,
        string ipfsCID,
        address indexed studentWallet,
        address issuerAddress,
        string studentName,
        string studentId,
        uint256 timestamp
    );

    /// @notice Event when a certificate is revoked (SBT burned)
    event CertificateRevoked(
        string indexed documentId,
        uint256 indexed tokenId,
        address indexed revokedBy,
        uint256 timestamp
    );

    /// @notice Event when a new issuer is added
    event IssuerAdded(
        address indexed issuerAddress,
        string issuerName,
        uint256 timestamp
    );

    /// @notice Event when an issuer is removed
    event IssuerRemoved(address indexed issuerAddress, uint256 timestamp);

    /// @notice Event when verification is performed
    event CertificateVerified(
        string indexed documentId,
        address indexed verifier,
        bool isValid,
        uint256 timestamp
    );

    // ============================================================
    //                        MODIFIERS
    // ============================================================

    /// @notice Only the contract owner can access
    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only the owner can access this function"
        );
        _;
    }

    /// @notice Only authorized issuers can access
    modifier onlyAuthorizedIssuer() {
        require(
            authorizedIssuers[msg.sender],
            "Only authorized issuers can access this function"
        );
        _;
    }

    /// @notice Ensure documentId is not yet registered
    modifier documentNotExists(string memory _documentId) {
        require(
            !certificates[_documentId].exists,
            "Document with this ID is already registered"
        );
        _;
    }

    /// @notice Ensure documentId is already registered
    modifier documentExists(string memory _documentId) {
        require(
            certificates[_documentId].exists,
            "Document with this ID was not found"
        );
        _;
    }

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    /**
     * @notice Initialize contract as ERC-721 Soulbound Token
     * @dev Token name: "Academic Certificate SBT", symbol: "ACSBT"
     */
    constructor() ERC721("Academic Certificate SBT", "ACSBT") {
        owner = msg.sender;
        _nextTokenId = 1; // Token ID starts from 1
    }

    // ============================================================
    //              SOULBOUND: OVERRIDE TRANSFER FUNCTIONS
    // ============================================================

    /**
     * @notice Override _update to prevent token transfers (Soulbound)
     * @dev Only allows minting (from == address(0)) and
     *      burning (to == address(0)). Wallet-to-wallet transfers are BLOCKED.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        // Allow only mint (from == 0) and burn (to == 0)
        if (from != address(0) && to != address(0)) {
            revert("Soulbound Token: token is non-transferable");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Override approve to prevent approval (Soulbound)
     * @dev SBT cannot be approved to third parties
     */
    function approve(
        address /* to */,
        uint256 /* tokenId */
    ) public pure override(ERC721, IERC721) {
        revert("Soulbound Token: approval is not allowed");
    }

    /**
     * @notice Override setApprovalForAll to prevent operator approval
     * @dev SBT cannot be approved for operators
     */
    function setApprovalForAll(
        address /* operator */,
        bool /* approved */
    ) public pure override(ERC721, IERC721) {
        revert("Soulbound Token: approval is not allowed");
    }

    // ============================================================
    //                    ISSUER MANAGEMENT
    // ============================================================

    /**
     * @notice Add a new authorized issuer for certificate issuance
     * @param _issuerAddress Issuer's wallet address
     * @param _issuerName Name of the issuing institution
     */
    function addIssuer(
        address _issuerAddress,
        string memory _issuerName
    ) external onlyOwner {
        require(_issuerAddress != address(0), "Invalid issuer address");
        require(
            bytes(_issuerName).length > 0,
            "Issuer name cannot be empty"
        );
        require(!authorizedIssuers[_issuerAddress], "Issuer is already registered");

        authorizedIssuers[_issuerAddress] = true;
        issuerNames[_issuerAddress] = _issuerName;

        emit IssuerAdded(_issuerAddress, _issuerName, block.timestamp);
    }

    /**
     * @notice Remove an issuer from the authorized list
     * @param _issuerAddress Wallet address of the issuer to remove
     */
    function removeIssuer(address _issuerAddress) external onlyOwner {
        require(authorizedIssuers[_issuerAddress], "Issuer not found");

        authorizedIssuers[_issuerAddress] = false;
        delete issuerNames[_issuerAddress];

        emit IssuerRemoved(_issuerAddress, block.timestamp);
    }

    // ============================================================
    //          CERTIFICATE REGISTRATION (MINT SBT)
    // ============================================================

    /**
     * @notice Register an academic certificate and mint SBT to the student's wallet
     * @dev Can only be called by an authorized issuer.
     *      Process: store data → mint SBT → set tokenURI to IPFS metadata.
     * @param _documentId Unique document ID (format: UNIV-YEAR-NUMBER)
     * @param _ipfsCID Content Identifier from IPFS (document file hash)
     * @param _studentName Student's full name
     * @param _studentId Student ID number
     * @param _studentWallet Student's wallet address (SBT recipient)
     * @param _degree Degree level (S1, S2, S3, D3, etc.)
     * @param _major Study program / major
     * @param _metadataURI Token metadata URI (IPFS URI for metadata JSON)
     */
    function registerCertificate(
        string memory _documentId,
        string memory _ipfsCID,
        string memory _studentName,
        string memory _studentId,
        address _studentWallet,
        string memory _degree,
        string memory _major,
        string memory _metadataURI
    ) external onlyAuthorizedIssuer documentNotExists(_documentId) {
        // Input validation
        require(
            bytes(_documentId).length > 0,
            "Document ID cannot be empty"
        );
        require(bytes(_ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(
            bytes(_studentName).length > 0,
            "Student name cannot be empty"
        );
        require(bytes(_studentId).length > 0, "Student ID cannot be empty");
        require(
            _studentWallet != address(0),
            "Invalid student wallet address"
        );
        require(bytes(_degree).length > 0, "Degree cannot be empty");
        require(bytes(_major).length > 0, "Major cannot be empty");

        // Generate tokenId
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        // Store certificate data
        certificates[_documentId] = Certificate({
            documentId: _documentId,
            ipfsCID: _ipfsCID,
            studentName: _studentName,
            studentId: _studentId,
            studentWallet: _studentWallet,
            degree: _degree,
            major: _major,
            issuerAddress: msg.sender,
            issuerName: issuerNames[msg.sender],
            issuedAt: block.timestamp,
            isValid: true,
            exists: true
        });

        // Store bidirectional mapping: documentId <-> tokenId
        documentToTokenId[_documentId] = tokenId;
        tokenToDocumentId[tokenId] = _documentId;

        // Store documentId to array
        documentIds.push(_documentId);

        // Increment counter
        totalCertificates++;

        // Mint SBT to student's wallet
        _safeMint(_studentWallet, tokenId);

        // Set token URI (IPFS metadata)
        if (bytes(_metadataURI).length > 0) {
            _setTokenURI(tokenId, _metadataURI);
        }

        // Emit event
        emit CertificateRegistered(
            _documentId,
            tokenId,
            _ipfsCID,
            _studentWallet,
            msg.sender,
            _studentName,
            _studentId,
            block.timestamp
        );
    }

    // ============================================================
    //                  CERTIFICATE RETRIEVAL
    // ============================================================

    /**
     * @notice Retrieve certificate data by documentId
     * @dev This is a view function (read-only, no gas fee).
     *      Returns the Certificate struct directly.
     * @param _documentId Unique document ID
     * @return cert Complete certificate data
     * @return tokenId SBT token ID
     */
    function getCertificate(
        string memory _documentId
    )
        external
        view
        documentExists(_documentId)
        returns (Certificate memory cert, uint256 tokenId)
    {
        cert = certificates[_documentId];
        tokenId = documentToTokenId[_documentId];
    }

    // ============================================================
    //                  CERTIFICATE VERIFICATION
    // ============================================================

    /**
     * @notice Verify certificate validity and compare CID
     * @dev Compares the CID stored on blockchain with the provided CID.
     *      Also checks if the SBT still exists in the student's wallet.
     * @param _documentId Unique document ID
     * @param _ipfsCID CID to verify against
     * @return isValid Whether the certificate is still valid
     * @return isMatching Whether the CID matches
     * @return cert Complete certificate data
     * @return tokenId SBT Token ID
     * @return tokenOwner Current token owner
     */
    function verifyCertificate(
        string memory _documentId,
        string memory _ipfsCID
    )
        external
        documentExists(_documentId)
        returns (
            bool isValid,
            bool isMatching,
            Certificate memory cert,
            uint256 tokenId,
            address tokenOwner
        )
    {
        Certificate storage storedCert = certificates[_documentId];
        uint256 _tokenId = documentToTokenId[_documentId];

        // Compare CID
        bool cidMatch = keccak256(abi.encodePacked(storedCert.ipfsCID)) ==
            keccak256(abi.encodePacked(_ipfsCID));

        // Check token owner (address(0) if burned/revoked)
        address _tokenOwner = address(0);
        if (storedCert.isValid) {
            _tokenOwner = ownerOf(_tokenId);
        }

        // Emit verification event
        emit CertificateVerified(
            _documentId,
            msg.sender,
            storedCert.isValid && cidMatch,
            block.timestamp
        );

        return (
            storedCert.isValid,
            cidMatch,
            storedCert,
            _tokenId,
            _tokenOwner
        );
    }

    /**
     * @notice Simple verification by documentId (QR Code scan)
     * @dev Used when scanning QR Code - no gas fee (view function).
     *      Returns the Certificate struct directly.
     * @param _documentId Unique document ID
     * @return cert Complete certificate data
     * @return tokenId SBT Token ID
     */
    function verifyByDocumentId(
        string memory _documentId
    )
        external
        view
        documentExists(_documentId)
        returns (Certificate memory cert, uint256 tokenId)
    {
        cert = certificates[_documentId];
        tokenId = documentToTokenId[_documentId];
    }

    // ============================================================
    //            CERTIFICATE REVOCATION (BURN SBT)
    // ============================================================

    /**
     * @notice Revoke a certificate and burn the SBT
     * @dev Only the original issuer or the owner can revoke.
     *      The SBT will be burned from the student's wallet.
     * @param _documentId Unique document ID to revoke
     */
    function revokeCertificate(
        string memory _documentId
    ) external documentExists(_documentId) {
        Certificate storage cert = certificates[_documentId];

        // Only the original issuer or owner can revoke
        require(
            msg.sender == cert.issuerAddress || msg.sender == owner,
            "Only the original issuer or owner can revoke a certificate"
        );

        require(cert.isValid, "Certificate has already been revoked");

        // Set status to invalid
        cert.isValid = false;

        // Burn SBT
        uint256 tokenId = documentToTokenId[_documentId];
        _burn(tokenId);

        emit CertificateRevoked(
            _documentId,
            tokenId,
            msg.sender,
            block.timestamp
        );
    }

    // ============================================================
    //                     UTILITY FUNCTIONS
    // ============================================================

    /**
     * @notice Check if a documentId is already registered
     * @param _documentId Unique document ID
     * @return exists Whether the document is registered
     */
    function certificateExists(
        string memory _documentId
    ) external view returns (bool exists) {
        return certificates[_documentId].exists;
    }

    /**
     * @notice Get the CID of a certificate
     * @param _documentId Unique document ID
     * @return ipfsCID The stored CID
     */
    function getCID(
        string memory _documentId
    )
        external
        view
        documentExists(_documentId)
        returns (string memory ipfsCID)
    {
        return certificates[_documentId].ipfsCID;
    }

    /**
     * @notice Get a list of all registered documentIds
     * @return Array of all documentIds
     */
    function getAllDocumentIds() external view returns (string[] memory) {
        return documentIds;
    }

    /**
     * @notice Get tokenId by documentId
     * @param _documentId Unique document ID
     * @return tokenId SBT Token ID
     */
    function getTokenId(
        string memory _documentId
    ) external view documentExists(_documentId) returns (uint256) {
        return documentToTokenId[_documentId];
    }

    /**
     * @notice Get documentId by tokenId
     * @param _tokenId SBT Token ID
     * @return documentId Document ID
     */
    function getDocumentId(
        uint256 _tokenId
    ) external view returns (string memory) {
        require(
            bytes(tokenToDocumentId[_tokenId]).length > 0,
            "Token not found"
        );
        return tokenToDocumentId[_tokenId];
    }

    /**
     * @notice Transfer contract ownership to a new address
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address");
        owner = _newOwner;
    }

    // ============================================================
    //               ERC-721 REQUIRED OVERRIDES
    // ============================================================

    /**
     * @notice Override tokenURI for ERC721URIStorage
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Override supportsInterface for ERC721URIStorage
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
