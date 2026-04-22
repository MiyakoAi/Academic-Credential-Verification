// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title AcademicCertificate (Soulbound Token / SBT)
 * @author Tugas Akhir - Teknik Informatika
 * @notice Smart contract untuk verifikasi dokumen akademik berbasis blockchain
 *         menggunakan Soulbound Token (SBT) - NFT yang TIDAK dapat ditransfer.
 *
 * @dev Inherit dari ERC-721 dengan modifikasi:
 *      - Token TIDAK bisa di-transfer (Soulbound)
 *      - Token TIDAK bisa di-approve untuk pihak lain
 *      - Token hanya bisa di-mint oleh Authorized Issuer
 *      - Token bisa di-burn (revoke) oleh Issuer asli atau Owner
 *
 * Alur Kerja:
 * 1. Owner (admin sistem) mendaftarkan Issuer (universitas/institusi).
 * 2. Issuer mendaftarkan sertifikat → SBT di-mint ke wallet mahasiswa.
 * 3. Pihak ketiga memverifikasi via QR Code / documentId.
 * 4. Issuer/Owner bisa revoke (burn) sertifikat jika diperlukan.
 */
contract AcademicCertificate is ERC721, ERC721URIStorage {
    // ============================================================
    //                         STRUCTS
    // ============================================================

    /**
     * @notice Struktur data untuk menyimpan informasi sertifikat akademik
     * @param documentId ID unik dokumen (format: UNIV-TAHUN-NOMOR)
     * @param ipfsCID Content Identifier dari IPFS (hash file dokumen)
     * @param studentName Nama mahasiswa pemilik dokumen
     * @param studentId NIM (Nomor Induk Mahasiswa)
     * @param studentWallet Alamat wallet mahasiswa (penerima SBT)
     * @param degree Gelar/jenjang pendidikan (S1, S2, S3, dll)
     * @param major Program studi / jurusan
     * @param issuerAddress Alamat wallet institusi yang menerbitkan
     * @param issuerName Nama institusi penerbit
     * @param issuedAt Timestamp saat sertifikat didaftarkan
     * @param isValid Status validitas sertifikat (true = valid, false = revoked)
     * @param exists Flag untuk mengecek apakah data ada di mapping
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

    /// @notice Alamat pemilik contract (admin utama sistem)
    address public owner;

    /// @notice Counter untuk tokenId (auto-increment)
    uint256 private _nextTokenId;

    /// @notice Mapping documentId => Certificate data
    mapping(string => Certificate) private certificates;

    /// @notice Mapping documentId => tokenId
    mapping(string => uint256) public documentToTokenId;

    /// @notice Mapping tokenId => documentId
    mapping(uint256 => string) public tokenToDocumentId;

    /// @notice Mapping alamat => status issuer (true = authorized)
    mapping(address => bool) public authorizedIssuers;

    /// @notice Mapping alamat issuer => nama institusi
    mapping(address => string) public issuerNames;

    /// @notice Array untuk menyimpan semua documentId yang terdaftar
    string[] public documentIds;

    /// @notice Total jumlah sertifikat yang terdaftar
    uint256 public totalCertificates;

    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Event ketika sertifikat baru didaftarkan (SBT di-mint)
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

    /// @notice Event ketika sertifikat dicabut/direvoke (SBT di-burn)
    event CertificateRevoked(
        string indexed documentId,
        uint256 indexed tokenId,
        address indexed revokedBy,
        uint256 timestamp
    );

    /// @notice Event ketika issuer baru ditambahkan
    event IssuerAdded(
        address indexed issuerAddress,
        string issuerName,
        uint256 timestamp
    );

    /// @notice Event ketika issuer dihapus
    event IssuerRemoved(
        address indexed issuerAddress,
        uint256 timestamp
    );

    /// @notice Event ketika verifikasi dilakukan
    event CertificateVerified(
        string indexed documentId,
        address indexed verifier,
        bool isValid,
        uint256 timestamp
    );

    // ============================================================
    //                        MODIFIERS
    // ============================================================

    /// @notice Hanya pemilik contract yang bisa mengakses
    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang dapat mengakses fungsi ini");
        _;
    }

    /// @notice Hanya issuer yang berwenang yang bisa mengakses
    modifier onlyAuthorizedIssuer() {
        require(
            authorizedIssuers[msg.sender],
            "Hanya issuer yang berwenang yang dapat mengakses fungsi ini"
        );
        _;
    }

    /// @notice Memastikan documentId belum terdaftar
    modifier documentNotExists(string memory _documentId) {
        require(
            !certificates[_documentId].exists,
            "Dokumen dengan ID ini sudah terdaftar"
        );
        _;
    }

    /// @notice Memastikan documentId sudah terdaftar
    modifier documentExists(string memory _documentId) {
        require(
            certificates[_documentId].exists,
            "Dokumen dengan ID ini tidak ditemukan"
        );
        _;
    }

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    /**
     * @notice Inisialisasi contract sebagai ERC-721 Soulbound Token
     * @dev Token name: "Academic Certificate SBT", symbol: "ACSBT"
     */
    constructor() ERC721("Academic Certificate SBT", "ACSBT") {
        owner = msg.sender;
        _nextTokenId = 1; // Token ID dimulai dari 1
    }

    // ============================================================
    //              SOULBOUND: OVERRIDE TRANSFER FUNCTIONS
    // ============================================================

    /**
     * @notice Override _update untuk mencegah transfer token (Soulbound)
     * @dev Hanya mengizinkan minting (from == address(0)) dan
     *      burning (to == address(0)). Transfer antar wallet DILARANG.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        // Izinkan hanya mint (from == 0) dan burn (to == 0)
        if (from != address(0) && to != address(0)) {
            revert("Soulbound Token: token tidak dapat ditransfer");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Override approve untuk mencegah approval (Soulbound)
     * @dev SBT tidak dapat di-approve untuk pihak lain
     */
    function approve(
        address /* to */,
        uint256 /* tokenId */
    ) public pure override(ERC721, IERC721) {
        revert("Soulbound Token: approval tidak diizinkan");
    }

    /**
     * @notice Override setApprovalForAll untuk mencegah operator approval
     * @dev SBT tidak dapat di-approve untuk operator
     */
    function setApprovalForAll(
        address /* operator */,
        bool /* approved */
    ) public pure override(ERC721, IERC721) {
        revert("Soulbound Token: approval tidak diizinkan");
    }

    // ============================================================
    //                    ISSUER MANAGEMENT
    // ============================================================

    /**
     * @notice Menambahkan issuer baru yang berwenang menerbitkan sertifikat
     * @param _issuerAddress Alamat wallet issuer
     * @param _issuerName Nama institusi penerbit
     */
    function addIssuer(
        address _issuerAddress,
        string memory _issuerName
    ) external onlyOwner {
        require(_issuerAddress != address(0), "Alamat issuer tidak valid");
        require(bytes(_issuerName).length > 0, "Nama issuer tidak boleh kosong");
        require(!authorizedIssuers[_issuerAddress], "Issuer sudah terdaftar");

        authorizedIssuers[_issuerAddress] = true;
        issuerNames[_issuerAddress] = _issuerName;

        emit IssuerAdded(_issuerAddress, _issuerName, block.timestamp);
    }

    /**
     * @notice Menghapus issuer dari daftar yang berwenang
     * @param _issuerAddress Alamat wallet issuer yang akan dihapus
     */
    function removeIssuer(address _issuerAddress) external onlyOwner {
        require(authorizedIssuers[_issuerAddress], "Issuer tidak ditemukan");

        authorizedIssuers[_issuerAddress] = false;
        delete issuerNames[_issuerAddress];

        emit IssuerRemoved(_issuerAddress, block.timestamp);
    }

    // ============================================================
    //          CERTIFICATE REGISTRATION (MINT SBT)
    // ============================================================

    /**
     * @notice Mendaftarkan sertifikat akademik dan mint SBT ke wallet mahasiswa
     * @dev Hanya bisa dipanggil oleh issuer yang sudah di-authorize.
     *      Proses: menyimpan data → mint SBT → set tokenURI ke IPFS metadata.
     * @param _documentId ID unik dokumen (format: UNIV-TAHUN-NOMOR)
     * @param _ipfsCID Content Identifier dari IPFS (hash file dokumen)
     * @param _studentName Nama lengkap mahasiswa
     * @param _studentId NIM mahasiswa
     * @param _studentWallet Alamat wallet mahasiswa (penerima SBT)
     * @param _degree Gelar/jenjang (S1, S2, S3, D3, dll)
     * @param _major Program studi / jurusan
     * @param _metadataURI URI metadata token (IPFS URI untuk metadata JSON)
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
        // Validasi input
        require(bytes(_documentId).length > 0, "Document ID tidak boleh kosong");
        require(bytes(_ipfsCID).length > 0, "IPFS CID tidak boleh kosong");
        require(bytes(_studentName).length > 0, "Nama mahasiswa tidak boleh kosong");
        require(bytes(_studentId).length > 0, "NIM tidak boleh kosong");
        require(_studentWallet != address(0), "Alamat wallet mahasiswa tidak valid");
        require(bytes(_degree).length > 0, "Gelar tidak boleh kosong");
        require(bytes(_major).length > 0, "Jurusan tidak boleh kosong");

        // Generate tokenId
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        // Simpan data sertifikat
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

        // Simpan mapping dua arah: documentId <-> tokenId
        documentToTokenId[_documentId] = tokenId;
        tokenToDocumentId[tokenId] = _documentId;

        // Simpan documentId ke array
        documentIds.push(_documentId);

        // Increment counter
        totalCertificates++;

        // Mint SBT ke wallet mahasiswa
        _safeMint(_studentWallet, tokenId);

        // Set token URI (metadata IPFS)
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
     * @notice Mengambil data sertifikat berdasarkan documentId
     * @dev Fungsi ini bersifat view (read-only, tanpa gas fee).
     *      Mengembalikan struct Certificate secara langsung.
     * @param _documentId ID unik dokumen
     * @return cert Data sertifikat lengkap
     * @return tokenId ID token SBT
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
     * @notice Memverifikasi validitas sertifikat dan membandingkan CID
     * @dev Membandingkan CID di blockchain dengan CID yang diberikan.
     *      Juga mengecek apakah SBT masih ada di wallet mahasiswa.
     * @param _documentId ID unik dokumen
     * @param _ipfsCID CID yang ingin diverifikasi
     * @return isValid Apakah sertifikat masih valid
     * @return isMatching Apakah CID cocok
     * @return cert Data sertifikat lengkap
     * @return tokenId Token ID SBT
     * @return tokenOwner Pemilik token saat ini
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

        // Bandingkan CID
        bool cidMatch = keccak256(abi.encodePacked(storedCert.ipfsCID)) ==
            keccak256(abi.encodePacked(_ipfsCID));

        // Cek pemilik token (address(0) jika sudah di-burn/revoke)
        address _tokenOwner = address(0);
        if (storedCert.isValid) {
            _tokenOwner = ownerOf(_tokenId);
        }

        // Emit event verifikasi
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
     * @notice Verifikasi sederhana berdasarkan documentId (QR Code scan)
     * @dev Digunakan saat scan QR Code - tanpa gas fee (view function).
     *      Mengembalikan struct Certificate secara langsung.
     * @param _documentId ID unik dokumen
     * @return cert Data sertifikat lengkap
     * @return tokenId Token ID SBT
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
     * @notice Mencabut sertifikat dan membakar (burn) SBT
     * @dev Hanya issuer asli atau owner yang bisa revoke.
     *      Token SBT akan di-burn dari wallet mahasiswa.
     * @param _documentId ID unik dokumen yang akan di-revoke
     */
    function revokeCertificate(
        string memory _documentId
    ) external documentExists(_documentId) {
        Certificate storage cert = certificates[_documentId];

        // Hanya issuer asli atau owner yang bisa revoke
        require(
            msg.sender == cert.issuerAddress || msg.sender == owner,
            "Hanya issuer asli atau owner yang dapat mencabut sertifikat"
        );

        require(cert.isValid, "Sertifikat sudah di-revoke sebelumnya");

        // Set status invalid
        cert.isValid = false;

        // Burn SBT
        uint256 tokenId = documentToTokenId[_documentId];
        _burn(tokenId);

        emit CertificateRevoked(_documentId, tokenId, msg.sender, block.timestamp);
    }

    // ============================================================
    //                     UTILITY FUNCTIONS
    // ============================================================

    /**
     * @notice Mengecek apakah sebuah documentId sudah terdaftar
     * @param _documentId ID unik dokumen
     * @return exists Apakah dokumen terdaftar
     */
    function certificateExists(
        string memory _documentId
    ) external view returns (bool exists) {
        return certificates[_documentId].exists;
    }

    /**
     * @notice Mengambil CID dari sebuah sertifikat
     * @param _documentId ID unik dokumen
     * @return ipfsCID CID yang tersimpan
     */
    function getCID(
        string memory _documentId
    ) external view documentExists(_documentId) returns (string memory ipfsCID) {
        return certificates[_documentId].ipfsCID;
    }

    /**
     * @notice Mengambil daftar semua documentId yang terdaftar
     * @return Array dari semua documentId
     */
    function getAllDocumentIds() external view returns (string[] memory) {
        return documentIds;
    }

    /**
     * @notice Mengambil tokenId berdasarkan documentId
     * @param _documentId ID unik dokumen
     * @return tokenId ID token SBT
     */
    function getTokenId(
        string memory _documentId
    ) external view documentExists(_documentId) returns (uint256) {
        return documentToTokenId[_documentId];
    }

    /**
     * @notice Mengambil documentId berdasarkan tokenId
     * @param _tokenId ID token SBT
     * @return documentId ID dokumen
     */
    function getDocumentId(
        uint256 _tokenId
    ) external view returns (string memory) {
        require(bytes(tokenToDocumentId[_tokenId]).length > 0, "Token tidak ditemukan");
        return tokenToDocumentId[_tokenId];
    }

    /**
     * @notice Transfer kepemilikan contract ke alamat baru
     * @param _newOwner Alamat owner baru
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Alamat owner baru tidak valid");
        owner = _newOwner;
    }

    // ============================================================
    //               ERC-721 REQUIRED OVERRIDES
    // ============================================================

    /**
     * @notice Override tokenURI untuk ERC721URIStorage
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Override supportsInterface untuk ERC721URIStorage
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
