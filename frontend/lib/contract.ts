// Smart Contract ABI - AcademicCertificate (Soulbound Token)
// Hanya fungsi-fungsi yang dibutuhkan oleh Frontend

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

export const CONTRACT_ABI = [
  // ========== READ FUNCTIONS (No Gas) ==========
  
  // Check if address is authorized issuer
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'authorizedIssuers',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // Get contract owner
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // Get total certificates
  {
    inputs: [],
    name: 'totalCertificates',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Get all document IDs
  {
    inputs: [],
    name: 'getAllDocumentIds',
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // Check if certificate exists
  {
    inputs: [{ name: '_documentId', type: 'string' }],
    name: 'certificateExists',
    outputs: [{ name: 'exists', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Get certificate by documentId (view)
  {
    inputs: [{ name: '_documentId', type: 'string' }],
    name: 'verifyByDocumentId',
    outputs: [
      {
        components: [
          { name: 'documentId', type: 'string' },
          { name: 'ipfsCID', type: 'string' },
          { name: 'studentName', type: 'string' },
          { name: 'studentId', type: 'string' },
          { name: 'studentWallet', type: 'address' },
          { name: 'degree', type: 'string' },
          { name: 'major', type: 'string' },
          { name: 'issuerAddress', type: 'address' },
          { name: 'issuerName', type: 'string' },
          { name: 'issuedAt', type: 'uint256' },
          { name: 'isValid', type: 'bool' },
          { name: 'exists', type: 'bool' },
        ],
        name: 'cert',
        type: 'tuple',
      },
      { name: 'tokenId', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ========== WRITE FUNCTIONS (Requires Gas / MetaMask) ==========
  
  // Register certificate (Mint SBT)
  {
    inputs: [
      { name: '_documentId', type: 'string' },
      { name: '_ipfsCID', type: 'string' },
      { name: '_studentName', type: 'string' },
      { name: '_studentId', type: 'string' },
      { name: '_studentWallet', type: 'address' },
      { name: '_degree', type: 'string' },
      { name: '_major', type: 'string' },
      { name: '_metadataURI', type: 'string' },
    ],
    name: 'registerCertificate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  
  // Revoke certificate (Burn SBT)
  {
    inputs: [{ name: '_documentId', type: 'string' }],
    name: 'revokeCertificate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ========== EVENTS ==========
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'documentId', type: 'string' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'ipfsCID', type: 'string' },
      { indexed: true, name: 'studentWallet', type: 'address' },
      { indexed: false, name: 'issuerAddress', type: 'address' },
      { indexed: false, name: 'studentName', type: 'string' },
      { indexed: false, name: 'studentId', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'CertificateRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'documentId', type: 'string' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'revokedBy', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'CertificateRevoked',
    type: 'event',
  },
] as const;
