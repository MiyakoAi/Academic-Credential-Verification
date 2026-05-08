// ============================================================
// Web3 Service - MetaMask & Ethers.js Integration
// ============================================================

import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, RPC_URL } from './contract';

// Global type declaration for MetaMask
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
}

/**
 * Connect to MetaMask and get wallet address
 */
export async function connectWallet(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask belum terinstall. Silakan install MetaMask terlebih dahulu.');
  }

  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('Tidak ada akun yang terhubung.');
  }

  return accounts[0];
}

/**
 * Get current connected account (without triggering popup)
 */
export async function getCurrentAccount(): Promise<string | null> {
  if (!isMetaMaskInstalled()) return null;

  const accounts = (await window.ethereum!.request({
    method: 'eth_accounts',
  })) as string[];

  return accounts?.[0] || null;
}

/**
 * Get read-only contract instance (no MetaMask needed)
 */
export function getReadOnlyContract(): Contract {
  const provider = new JsonRpcProvider(RPC_URL);
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

/**
 * Get contract instance with signer (MetaMask needed for write operations)
 */
export async function getSignerContract(): Promise<Contract> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is required for this operation');
  }

  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

/**
 * Check if connected wallet is the contract Owner
 */
export async function isOwner(address: string): Promise<boolean> {
  const contract = getReadOnlyContract();
  const owner = await contract.owner();
  return owner.toLowerCase() === address.toLowerCase();
}

/**
 * Check if connected wallet is an authorized Issuer
 */
export async function isAuthorizedIssuer(address: string): Promise<boolean> {
  const contract = getReadOnlyContract();
  return contract.authorizedIssuers(address);
}

/**
 * Check if wallet is either Owner or Issuer (Admin access)
 */
export async function hasAdminAccess(address: string): Promise<boolean> {
  const [ownerCheck, issuerCheck] = await Promise.all([
    isOwner(address),
    isAuthorizedIssuer(address),
  ]);
  return ownerCheck || issuerCheck;
}

/**
 * Get wallet ETH balance
 */
export async function getBalance(address: string): Promise<string> {
  if (!isMetaMaskInstalled()) return '0';
  
  const provider = new BrowserProvider(window.ethereum!);
  const balance = await provider.getBalance(address);
  // Format to 4 decimal places
  const ethBalance = Number(balance) / 1e18;
  return ethBalance.toFixed(4);
}

/**
 * Register certificate on blockchain (Mint SBT)
 * This triggers MetaMask popup for user confirmation
 */
export async function mintCertificate(params: {
  documentId: string;
  ipfsCID: string;
  studentName: string;
  studentId: string;
  studentWallet: string;
  degree: string;
  major: string;
  metadataURI: string;
}): Promise<{ hash: string }> {
  const contract = await getSignerContract();

  const tx = await contract.registerCertificate(
    params.documentId,
    params.ipfsCID,
    params.studentName,
    params.studentId,
    params.studentWallet,
    params.degree,
    params.major,
    params.metadataURI,
  );

  // Wait for transaction to be mined
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}

/**
 * Revoke certificate on blockchain (Burn SBT)
 * This triggers MetaMask popup for user confirmation
 */
export async function revokeCertificateOnChain(documentId: string): Promise<{ hash: string }> {
  const contract = await getSignerContract();

  const tx = await contract.revokeCertificate(documentId);
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}

/**
 * Listen for MetaMask account changes
 */
export function onAccountChange(callback: (accounts: string[]) => void): () => void {
  if (!isMetaMaskInstalled()) return () => {};

  const handler = (...args: unknown[]) => callback(args[0] as string[]);
  window.ethereum!.on('accountsChanged', handler);
  return () => window.ethereum!.removeListener('accountsChanged', handler);
}
