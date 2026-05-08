// ============================================================
// Backend API Service - Memanggil endpoint NestJS Backend
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Helper: fetch wrapper dengan error handling
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API Error: ${res.status}`);
  }

  return res.json();
}

// ============================================================
//                   VERIFICATION API
// ============================================================

export interface CertificateData {
  documentId: string;
  ipfsCID: string;
  studentName: string;
  studentId: string;
  studentWallet: string;
  degree: string;
  major: string;
  issuerName: string;
  issuedAt: number;
  isValid: boolean;
}

export interface VerifyResponse {
  success: boolean;
  message: string;
  data: {
    isValid: boolean;
    certificate: CertificateData;
    tokenId: string;
    qrCode: string;
  };
}

/**
 * Verify certificate by Document ID (QR Code scan)
 */
export async function verifyCertificate(documentId: string): Promise<VerifyResponse> {
  return apiFetch<VerifyResponse>(`/certificates/verify/${encodeURIComponent(documentId)}`);
}

// ============================================================
//                   DEEP VERIFY API
// ============================================================

export interface DeepVerifyResponse {
  success: boolean;
  message: string;
  data: {
    isValid: boolean;
    isMatching: boolean;
    uploadedCID: string;
    storedCID: string;
    certificate: CertificateData;
    tokenId: string;
    tokenOwner: string;
  };
}

/**
 * Deep verify: upload PDF and compare CID with blockchain
 */
export async function deepVerifyCertificate(
  documentId: string,
  file: File,
): Promise<DeepVerifyResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<DeepVerifyResponse>(
    `/certificates/verify-deep/${encodeURIComponent(documentId)}`,
    {
      method: 'POST',
      body: formData,
    },
  );
}

// ============================================================
//                   SECURE DOWNLOAD API
// ============================================================

export interface SecureDownloadResponse {
  success: boolean;
  message: string;
  data?: {
    documentUrl: string;
    certificate: CertificateData;
  };
}

/**
 * Secure download: requires Document ID + NIM + Wallet
 */
export async function secureDownload(
  documentId: string,
  studentId: string,
  studentWallet: string,
): Promise<SecureDownloadResponse> {
  const formBody = new URLSearchParams({
    documentId,
    studentId,
    studentWallet,
  });

  return apiFetch<SecureDownloadResponse>('/certificates/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });
}

// ============================================================
//                   REGISTRATION API
// ============================================================

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    documentId: string;
    ipfsCID: string;
    metadataCID: string;
    metadataURI: string;
    documentGatewayUrl: string;
    metadataGatewayUrl: string;
    qrCode: {
      dataUrl: string;
      verificationUrl: string;
    };
  };
}

/**
 * Register certificate: upload PDF to IPFS and get CID
 * (Blockchain minting is done separately via MetaMask)
 */
export async function registerCertificate(formData: FormData): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/certificates/register', {
    method: 'POST',
    body: formData,
  });
}

// ============================================================
//                   QR CODE API
// ============================================================

/**
 * Decrypt QR Code data (AES-256-CBC encrypted documentId)
 * Called when frontend receives ?data=<encrypted> from QR Code scan
 */
export async function decryptQRData(encryptedData: string): Promise<string> {
  const res = await apiFetch<{ success: boolean; data: { documentId: string } }>(
    `/qrcode/decrypt?data=${encodeURIComponent(encryptedData)}`,
  );
  return res.data.documentId;
}

/**
 * Get QR Code as base64 data URL
 */
export async function getQRCode(documentId: string): Promise<string> {
  const res = await fetch(`${API_URL}/qrcode/${encodeURIComponent(documentId)}`);
  if (!res.ok) throw new Error('Failed to generate QR Code');
  const json = await res.json();
  return json.data.qrCodeDataUrl;
}

/**
 * Get QR Code download URL (PNG)
 */
export function getQRCodeDownloadUrl(documentId: string): string {
  return `${API_URL}/qrcode/${encodeURIComponent(documentId)}/download`;
}

/**
 * Get QR Code as SVG
 */
export async function getQRCodeSVG(documentId: string): Promise<string> {
  const res = await fetch(`${API_URL}/qrcode/${encodeURIComponent(documentId)}/svg`);
  if (!res.ok) throw new Error('Failed to generate QR Code SVG');
  return res.text();
}

// ============================================================
//                   BLOCKCHAIN STATS API
// ============================================================

export interface BlockchainStats {
  totalCertificates: number;
  contractAddress: string;
  networkUrl: string;
}

/**
 * Get blockchain statistics
 */
export async function getBlockchainStats(): Promise<BlockchainStats> {
  const res = await apiFetch<{ success: boolean; data: { totalCertificates: number } }>('/blockchain/stats');
  
  return {
    totalCertificates: res.data.totalCertificates || 0,
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',
    networkUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
  };
}
