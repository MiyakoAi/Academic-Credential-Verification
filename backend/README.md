# Backend

> The backend serves as the **bridge** between the Frontend and the Smart Contract, while managing decentralized file storage on IPFS.
> Built with **NestJS** (TypeScript).

---

## Backend Role in the System

The backend **does not** execute blockchain transactions directly (it holds no private keys for write operations). Instead, it functions as:

```mermaid
graph LR
    FE["Frontend"]
    BE["Backend<br/>(Bridge)"]
    SC["Smart Contract"]
    IPFS["IPFS (Pinata)"]

    FE <-->|"REST API"| BE
    BE <-->|"Read-Only<br/>(Ethers.js)"| SC
    BE <-->|"Upload / Fetch<br/>(Pinata SDK)"| IPFS
    FE -.->|"Write TX<br/>(MetaMask)"| SC

    style BE fill:#ff9800,stroke:#e65100,color:#fff
```

| Task | Description |
|---|---|
| **IPFS Manager** | Uploads PDF documents and metadata JSON to IPFS via Pinata |
| **Blockchain Reader** | Reads certificate data from the smart contract (call / view operations) |
| **QR Code Generator** | Generates QR Codes with AES-256-CBC encryption |
| **Orchestrator** | Coordinates the entire registration and verification workflow |

> **Note:** **Write transactions** (minting SBT, revoking) are executed **directly from the frontend via MetaMask**, not from the backend.

---

## Module Architecture

```mermaid
graph TB
    subgraph App ["NestJS Application"]
        Main["main.ts<br/>Bootstrap + Swagger"]
        AppModule["AppModule"]

        subgraph CertMod ["Certificate Module"]
            CertCtrl["CertificateController<br/>/certificates/*"]
            CertSvc["CertificateService<br/>(Orchestrator)"]
        end

        subgraph IpfsMod ["IPFS Module"]
            IpfsCtrl["IpfsController<br/>/ipfs/*"]
            IpfsSvc["IpfsService<br/>(Pinata SDK)"]
        end

        subgraph BcMod ["Blockchain Module"]
            BCCtrl["BlockchainController<br/>/blockchain/*"]
            BCSvc["BlockchainService<br/>(Ethers.js)"]
        end

        subgraph QrMod ["QR Code Module"]
            QRCtrl["QrcodeController<br/>/qrcode/*"]
            QRSvc["QrcodeService<br/>(AES-256-CBC)"]
        end
    end

    Main --> AppModule
    AppModule --> CertCtrl
    AppModule --> IpfsCtrl
    AppModule --> BCCtrl
    AppModule --> QRCtrl

    CertCtrl --> CertSvc
    CertSvc --> IpfsSvc
    CertSvc --> BCSvc
    CertSvc --> QRSvc

    IpfsCtrl --> IpfsSvc
    BCCtrl --> BCSvc
    QRCtrl --> QRSvc

    style CertSvc fill:#f9a825,stroke:#f57f17,color:#000
    style IpfsSvc fill:#00bcd4,stroke:#006064,color:#fff
    style BCSvc fill:#7c4dff,stroke:#311b92,color:#fff
    style QRSvc fill:#66bb6a,stroke:#2e7d32,color:#fff
```

---

## API Endpoints

### Certificate API (`/certificates`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/certificates/register` | Upload PDF to IPFS, generate metadata, create QR Code |
| `GET` | `/certificates/verify/:documentId` | Verify certificate (QR Code scan) |
| `POST` | `/certificates/verify-deep/:documentId` | Deep verify: upload file and compare CID |
| `POST` | `/certificates/download` | Secure download (3-factor credential verification) |

### QR Code API (`/qrcode`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/qrcode/:documentId` | Generate QR Code (base64 data URL) |
| `GET` | `/qrcode/:documentId/download` | Download QR Code (PNG) |
| `GET` | `/qrcode/:documentId/svg` | Generate QR Code (SVG) |
| `GET` | `/qrcode/decrypt?data=...` | Decrypt QR Code data |

### Blockchain API (`/blockchain`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/blockchain/stats` | Blockchain statistics (total certificates) |
| `GET` | `/blockchain/contract-info` | Contract information (ABI + address) |

### Swagger Documentation

After starting the backend, access interactive API documentation at:
```
http://localhost:3001/api
```

---

## Detailed Process Workflows

### Registration — How Documents Are Stored on IPFS

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Admin
    participant API as POST /certificates/register
    participant CertSvc as CertificateService
    participant IpfsSvc as IpfsService
    participant Pinata as Pinata (IPFS)
    participant QRSvc as QrcodeService

    Admin->>API: FormData (PDF + student data)
    API->>CertSvc: prepareRegistration(dto, file)

    Note over CertSvc,Pinata: STEP 1: Upload Document to IPFS
    CertSvc->>IpfsSvc: uploadFile(buffer, filename, mime)
    IpfsSvc->>IpfsSvc: new File([buffer], name)
    IpfsSvc->>Pinata: pinata.upload.public.file(file)
    Pinata-->>IpfsSvc: { cid: "Qm..." }
    IpfsSvc-->>CertSvc: { cid, gatewayUrl }

    Note over CertSvc,Pinata: STEP 2: Upload Metadata to IPFS
    CertSvc->>IpfsSvc: buildCertificateMetadata(params)
    IpfsSvc-->>CertSvc: metadata JSON (ERC-721 standard)
    CertSvc->>IpfsSvc: uploadMetadata(metadata, name)
    IpfsSvc->>Pinata: pinata.upload.public.json(metadata)
    Pinata-->>IpfsSvc: { cid: "Qm..." }
    IpfsSvc-->>CertSvc: { cid, metadataUri: "ipfs://..." }

    Note over CertSvc,QRSvc: STEP 3: Generate QR Code
    CertSvc->>QRSvc: generateQRCodeDataURL(documentId)
    QRSvc->>QRSvc: encrypt(documentId) -> AES-256-CBC
    QRSvc->>QRSvc: buildVerificationUrl(documentId)
    QRSvc-->>CertSvc: QR Code Data URL (base64)

    CertSvc-->>API: { ipfsCID, metadataURI, qrCode }
    API-->>Admin: Response JSON
```

### Metadata JSON Stored on IPFS

```json
{
  "name": "Academic Certificate - Mugni Adji",
  "description": "Academic certificate S1 Teknik Informatika issued by UMI",
  "image": "ipfs://QmDocumentCID...",
  "external_url": "ipfs://QmDocumentCID...",
  "attributes": [
    { "trait_type": "Document ID", "value": "UMI-2022-13020220166" },
    { "trait_type": "Student Name", "value": "Mugni Adji" },
    { "trait_type": "Student ID (NIM)", "value": "13020220166" },
    { "trait_type": "Degree", "value": "S1" },
    { "trait_type": "Major", "value": "Teknik Informatika" },
    { "trait_type": "Issuer", "value": "Universitas Muslim Indonesia" },
    { "display_type": "date", "trait_type": "Issued At", "value": "2024-01-15T..." }
  ]
}
```

### Verification — How Data Is Read from the Blockchain

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as GET /certificates/verify/:id
    participant CertSvc as CertificateService
    participant BCSvc as BlockchainService
    participant SC as Smart Contract
    participant QRSvc as QrcodeService

    FE->>API: GET /certificates/verify/UMI-2022-001
    API->>CertSvc: verifyCertificate(documentId)

    Note over CertSvc,SC: STEP 1: Query Blockchain
    CertSvc->>BCSvc: verifyByDocumentId(documentId)
    BCSvc->>SC: contract.verifyByDocumentId(documentId)
    SC-->>BCSvc: [Certificate struct, tokenId]
    BCSvc-->>CertSvc: { isValid, certificate, tokenId }

    Note over CertSvc,QRSvc: STEP 2: Generate QR Code
    CertSvc->>QRSvc: generateQRCodeDataURL(documentId)
    QRSvc-->>CertSvc: QR Code base64

    CertSvc-->>API: { isValid, certificate, qrCode }
    API-->>FE: Response JSON
```

---

## QR Code Encryption (AES-256-CBC)

The QR Code **does not** contain the Document ID in plaintext. Instead, the Document ID is encrypted using **AES-256-CBC** before being embedded in the QR Code.

```mermaid
graph LR
    subgraph Enc ["Encryption (Generate QR)"]
        A["documentId<br/>'UMI-2022-001'"] --> B["AES-256-CBC<br/>Encrypt"]
        B --> C["'a1b2c3...:d4e5f6...'<br/>(iv:ciphertext)"]
        C --> D["URL Encode"]
        D --> E["QR Code<br/>/verify?data=a1b2c3..."]
    end

    subgraph Dec ["Decryption (Scan QR)"]
        F["QR Code Scan"] --> G["Extract ?data= param"]
        G --> H["AES-256-CBC<br/>Decrypt"]
        H --> I["documentId<br/>'UMI-2022-001'"]
    end

    style B fill:#f44336,stroke:#b71c1c,color:#fff
    style H fill:#4caf50,stroke:#1b5e20,color:#fff
```

| Component | Detail |
|---|---|
| **Algorithm** | AES-256-CBC |
| **Key** | SHA-256 hash of `AES_SECRET_KEY` environment variable (32 bytes) |
| **IV** | Random 16 bytes (unique per encryption) |
| **Output Format** | `{iv_hex}:{ciphertext_hex}` |

---

## Secure Download — Triple Verification

```mermaid
flowchart TD
    A["POST /certificates/download"] --> B["Receive: documentId, studentId, studentWallet"]
    B --> C["Query Blockchain<br/>verifyByDocumentId()"]
    C --> D{"Certificate<br/>isValid?"}
    D -->|"No"| E["Error: Certificate revoked"]
    D -->|"Yes"| F{"studentId<br/>matches?"}
    F -->|"No"| G["Error: Credentials mismatch"]
    F -->|"Yes"| H{"studentWallet<br/>matches?"}
    H -->|"No"| G
    H -->|"Yes"| I["Generate IPFS Gateway URL"]
    I --> J["Return download link"]

    style E fill:#ef5350,stroke:#c62828,color:#fff
    style G fill:#ef5350,stroke:#c62828,color:#fff
    style J fill:#66bb6a,stroke:#2e7d32,color:#fff
```

---

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
# Server
PORT=3001

# Pinata / IPFS
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY=your-gateway.mypinata.cloud

# Blockchain
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x_deployed_contract_address_here

# Frontend
FRONTEND_URL=http://localhost:3000
VERIFICATION_BASE_URL=http://localhost:3000/verify

# QR Code Encryption
AES_SECRET_KEY=your-secret-key-here
```

### 3. Run the Development Server

```bash
npm run start:dev
```

Backend runs at `http://localhost:3001`

### 4. Access Swagger

Visit `http://localhost:3001/api` to view and interactively test all API endpoints.

---

## Source Code Structure

```
backend/src/
├── main.ts                          # Bootstrap + Swagger setup
├── app.module.ts                    # Root module (imports all submodules)
│
├── certificate/                     # Main Orchestrator Module
│   ├── certificate.module.ts
│   ├── certificate.controller.ts    # REST endpoints /certificates/*
│   ├── certificate.service.ts       # Business logic (orchestrator)
│   └── dto/
│       └── certificate.dto.ts       # Input validation (class-validator)
│
├── ipfs/                            # IPFS Module (Pinata)
│   ├── ipfs.module.ts
│   ├── ipfs.controller.ts           # REST endpoints /ipfs/*
│   └── ipfs.service.ts              # File and metadata upload to Pinata
│
├── blockchain/                      # Blockchain Module (Read-Only)
│   ├── blockchain.module.ts
│   ├── blockchain.controller.ts     # REST endpoints /blockchain/*
│   ├── blockchain.service.ts        # Smart contract interaction
│   └── abi/
│       └── AcademicCertificate.json # Contract ABI (copied from artifacts)
│
└── qrcode/                          # QR Code & Encryption Module
    ├── qrcode.module.ts
    ├── qrcode.controller.ts         # REST endpoints /qrcode/*
    └── qrcode.service.ts            # QR generation + AES-256-CBC
```

---

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@nestjs/core` | ^11.0.1 | Backend framework |
| `@nestjs/swagger` | ^11.3.2 | Swagger API documentation |
| `ethers` | ^6.16.0 | Blockchain interaction (read-only) |
| `pinata` | ^2.5.5 | IPFS upload SDK |
| `qrcode` | ^1.5.4 | QR Code generation |
| `class-validator` | ^0.15.1 | DTO validation |
| `multer` | ^2.1.1 | File upload handling (multipart/form-data) |

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```
