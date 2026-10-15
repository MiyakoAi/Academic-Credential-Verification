# Academic Credential Verification

> **Soulbound Token (SBT) × IPFS × Smart Contract**
>
> An academic document verification system (degrees, transcripts, certificates) leveraging blockchain technology and IPFS as a tamper-evident record of data integrity.

---

## Description

This system enables educational institutions to register academic documents onto the blockchain as **Soulbound Tokens (SBT)** — non-transferable NFTs. The original documents are stored decentrally on **IPFS** (InterPlanetary File System), while the cryptographic hash (CID) of each document is permanently recorded on the blockchain as proof of integrity.

Third parties (companies, government agencies, or other universities) can verify document authenticity by **scanning a QR Code** or entering the Document ID.

---

## System Architecture

```mermaid
graph TB
    subgraph Users ["Users"]
        Admin["Admin / Issuer<br/>(University)"]
        Verifier["Verifier<br/>(Third Party)"]
        Student["Student"]
    end

    subgraph Frontend ["Frontend (Next.js)"]
        FE_Admin["Admin Pages<br/>Register / Revoke / Manage"]
        FE_Verify["Verification Page<br/>QR Scan / Deep Verify"]
        FE_Download["Download Page<br/>Secure Download"]
        MetaMask["MetaMask<br/>Browser Wallet"]
    end

    subgraph Backend ["Backend (NestJS)"]
        API["REST API<br/>Port 3001"]
        IPFS_Svc["IPFS Service<br/>(Pinata SDK)"]
        BC_Svc["Blockchain Service<br/>(Ethers.js)"]
        QR_Svc["QR Code Service<br/>(AES-256-CBC)"]
        Cert_Svc["Certificate Service<br/>(Orchestrator)"]
    end

    subgraph Infrastructure ["Infrastructure"]
        BC["Blockchain<br/>(Hardhat / Ethereum)"]
        SC["Smart Contract<br/>AcademicCertificate.sol"]
        IPFS["IPFS<br/>(Pinata Gateway)"]
    end

    Admin --> FE_Admin
    Verifier --> FE_Verify
    Student --> FE_Download

    FE_Admin -->|"Upload PDF + Data"| API
    FE_Admin -->|"Mint SBT / Revoke"| MetaMask
    MetaMask -->|"On-Chain Transaction"| SC

    FE_Verify -->|"Verify Document ID"| API
    FE_Download -->|"Request Download"| API

    API --> Cert_Svc
    Cert_Svc --> IPFS_Svc
    Cert_Svc --> BC_Svc
    Cert_Svc --> QR_Svc

    IPFS_Svc -->|"Upload / Fetch"| IPFS
    BC_Svc -->|"Read Data"| SC
    SC --> BC

    style SC fill:#f9a825,stroke:#f57f17,color:#000
    style IPFS fill:#00bcd4,stroke:#006064,color:#fff
    style MetaMask fill:#e65100,stroke:#bf360c,color:#fff
    style BC fill:#7c4dff,stroke:#311b92,color:#fff
```

---

## System Workflows

### 1. Certificate Registration Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin (Issuer)
    participant FE as Frontend
    participant BE as Backend
    participant IPFS as IPFS (Pinata)
    participant MM as MetaMask
    participant SC as Smart Contract

    Note over Admin,SC: REGISTRATION PHASE

    Admin->>FE: 1. Fill form + upload PDF
    FE->>BE: 2. POST /certificates/register (FormData)
    BE->>IPFS: 3. Upload PDF -> obtain CID
    IPFS-->>BE: Document CID
    BE->>IPFS: 4. Upload metadata JSON -> obtain metadataURI
    IPFS-->>BE: ipfs://metadata-CID
    BE->>BE: 5. Generate QR Code (AES-256-CBC encrypted)
    BE-->>FE: 6. Response: CID, metadataURI, QR Code

    Note over FE,SC: BLOCKCHAIN PHASE (via MetaMask)

    FE->>MM: 7. Trigger registerCertificate()
    MM->>Admin: 8. Transaction confirmation popup
    Admin->>MM: 9. Approve & sign
    MM->>SC: 10. Submit transaction to blockchain
    SC->>SC: 11. Mint SBT to student wallet
    SC-->>MM: 12. Transaction receipt
    MM-->>FE: 13. Transaction Hash
    FE-->>Admin: 14. Registration successful
```

### 2. Certificate Verification Workflow (QR Code Scan)

```mermaid
sequenceDiagram
    autonumber
    actor V as Verifier
    participant FE as Frontend
    participant BE as Backend
    participant SC as Smart Contract

    Note over V,SC: VERIFICATION PHASE

    V->>FE: 1. Scan QR Code on document
    FE->>FE: 2. Parse URL: /verify?data=<encrypted>
    FE->>BE: 3. GET /qrcode/decrypt?data=<encrypted>
    BE->>BE: 4. Decrypt AES-256-CBC -> documentId
    BE-->>FE: 5. documentId (plaintext)
    FE->>BE: 6. GET /certificates/verify/{documentId}
    BE->>SC: 7. Call verifyByDocumentId()
    SC-->>BE: 8. Certificate data + status
    BE-->>FE: 9. Certificate data + validity status
    FE-->>V: 10. Display result: VALID or INVALID
```

### 3. Deep Verification Workflow (CID Hash Comparison)

```mermaid
sequenceDiagram
    autonumber
    actor V as Verifier
    participant FE as Frontend
    participant BE as Backend
    participant IPFS as IPFS
    participant SC as Smart Contract

    Note over V,SC: DEEP VERIFICATION - File Tampering Detection

    V->>FE: 1. Upload digital document file (PDF)
    FE->>BE: 2. POST /certificates/verify-deep/{documentId}
    BE->>IPFS: 3. Upload file -> compute CID
    IPFS-->>BE: 4. CID of uploaded file
    BE->>SC: 5. Call verifyCertificate(documentId, CID)
    SC->>SC: 6. Compare uploaded CID vs blockchain stored CID
    SC-->>BE: 7. isMatching: true/false
    BE-->>FE: 8. Comparison result
    FE-->>V: 9. Display result: IDENTICAL or FILE MISMATCH
```

---

## Project Structure

```
tugasAkhir1/
├── smartContract/          # Smart Contract (Solidity + Hardhat)
│   ├── contracts/
│   │   └── AcademicCertificate.sol   # Main contract (SBT)
│   ├── scripts/
│   │   ├── deploy.ts                # Deployment script
│   │   ├── register.ts              # Test registration script
│   │   ├── authorize.ts             # Issuer authorization script
│   │   └── revoke.ts                # Certificate revocation script
│   └── hardhat.config.ts            # Hardhat configuration
│
├── backend/                # Backend API (NestJS)
│   └── src/
│       ├── certificate/    # Main orchestrator
│       ├── ipfs/           # IPFS integration (Pinata)
│       ├── blockchain/     # Smart Contract integration
│       └── qrcode/         # QR Code + AES encryption
│
├── frontend/               # Frontend (Next.js)
│   ├── app/
│   │   ├── page.tsx                  # Public verification page
│   │   ├── verify/                   # QR verification redirect handler
│   │   ├── admin-qX9vM2pZ/          # Admin panel (obfuscated)
│   │   │   ├── register/            # Certificate registration form
│   │   │   ├── revoke/              # Certificate revocation
│   │   │   ├── manage/              # Staff / issuer management
│   │   │   └── stamper/             # PDF QR stamper
│   │   └── download/                # Secure download
│   └── lib/
│       ├── api.ts          # Backend API client
│       ├── web3.ts         # MetaMask integration
│       └── contract.ts     # Contract ABI + address
│
└── README.md               # Current document
```

---

## Getting Started

### Prerequisites

| Software | Minimum Version | Purpose |
|----------|-----------------|---------|
| **Node.js** | v18+ | JavaScript runtime |
| **npm** | v9+ | Package manager |
| **MetaMask** | Latest | Browser wallet extension |
| **Pinata Account** | - | IPFS pinning service |

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd tugasAkhir1
```

### Step 2: Run Smart Contract (Local Blockchain)

```bash
cd smartContract
npm install

# Terminal 1 - Run local blockchain node
npx hardhat node

# Terminal 2 - Deploy contract
npx hardhat run scripts/deploy.ts --network localhost
```

> **Important:** Note the `Contract Address` displayed after deployment. You must add it to the `.env` files in both the backend and frontend.

### Step 3: Run Backend

```bash
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env -> specify CONTRACT_ADDRESS, PINATA_JWT, etc.

npm run start:dev
```

Backend runs at `http://localhost:3001`  
Swagger API Docs: `http://localhost:3001/api`

### Step 4: Run Frontend

```bash
cd frontend
npm install

# Edit .env.local -> specify NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

Frontend runs at `http://localhost:3000`

### Step 5: Configure MetaMask

1. Install MetaMask in your browser.
2. Import one of the test accounts from the Hardhat node (use a private key output by `npx hardhat node`).
3. Add a custom network:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** ETH

---

## System Security

```mermaid
graph LR
    subgraph SecurityLayers ["Security Layers"]
        A["Soulbound Token<br/>Non-transferable"]
        B["AES-256-CBC<br/>QR Code Encryption"]
        C["IPFS CID<br/>Content-addressed"]
        D["MetaMask<br/>User-signed TX"]
        E["Role-Based Access<br/>Owner & Issuer"]
    end

    A --- B --- C --- D --- E
```

| Layer | Mechanism | Description |
|---|---|---|
| **Document Integrity** | IPFS CID | Any modification to the file produces a different CID |
| **On-Chain Authenticity** | Soulbound Token | SBT cannot be transferred; only minted and burned |
| **QR Code Encryption** | AES-256-CBC | Document ID is encrypted before being embedded in the QR Code |
| **Transaction Authorization** | MetaMask Signing | Every state-changing transaction requires explicit user signature |
| **Access Control** | Smart Contract Modifiers | Only Owner / Issuer can register or revoke certificates |
| **Secure Download** | Triple Verification | Document ID + Student ID + Student Wallet must all match |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Smart Contract** | Solidity + Hardhat 3 + OpenZeppelin | ^0.8.28 |
| **Backend** | NestJS + Ethers.js + Pinata SDK | v11 |
| **Frontend** | Next.js + React + Ethers.js + Framer Motion | v16 |
| **Blockchain** | Ethereum (Hardhat Local / Sepolia / Polygon Amoy) | - |
| **Storage** | IPFS via Pinata | - |
| **Wallet** | MetaMask | - |

---

## Further Documentation

| Component | README | Description |
|---|---|---|
| Smart Contract | [`smartContract/README.md`](./smartContract/README.md) | SBT architecture, contract functions, role management |
| Backend | [`backend/README.md`](./backend/README.md) | API endpoints, IPFS integration, QR Code encryption |
| Frontend | [`frontend/README.md`](./frontend/README.md) | MetaMask integration, application pages, UI flows |

---