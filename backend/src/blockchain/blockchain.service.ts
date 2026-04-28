import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Service for interacting with the AcademicCertificate Smart Contract on blockchain.
 *
 * Main tasks:
 * 1. Read certificate data from blockchain (view functions - free)
 * 2. Verify certificates by documentId or CID
 * 3. Provide contract instance for frontend (ABI + address)
 *
 * Note: Write transactions (registerCertificate, revokeCertificate)
 * are performed directly from the frontend via MetaMask, not from the backend.
 * The backend only performs READ operations for verification.
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private contractAddress: string;
  private abi: any[];

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    const rpcUrl =
      this.configService.get<string>('BLOCKCHAIN_RPC_URL') ||
      'http://127.0.0.1:8545';
    this.contractAddress =
      this.configService.get<string>('CONTRACT_ADDRESS') || '';

    // Load ABI
    try {
      const abiPath = join(process.cwd(), 'dist', 'blockchain', 'abi', 'AcademicCertificate.json');
      const abiRaw = readFileSync(abiPath, 'utf-8');
      this.abi = JSON.parse(abiRaw);
    } catch {
      this.logger.warn(
        'ABI file not found. Make sure abi/AcademicCertificate.json exists.',
      );
      this.abi = [];
    }

    // Setup provider and contract (read-only)
    // Using static network so provider does not immediately connect
    // to RPC at startup (prevents crash if blockchain node is not active)
    try {
      const staticNetwork = ethers.Network.from(31337); // Hardhat default chainId
      this.provider = new ethers.JsonRpcProvider(rpcUrl, staticNetwork, {
        staticNetwork: staticNetwork,
      });

      // Validation: ensure contract address is a valid Ethereum address
      const isValidAddress =
        this.contractAddress && ethers.isAddress(this.contractAddress);

      if (isValidAddress && this.abi.length > 0) {
        this.contract = new ethers.Contract(
          this.contractAddress,
          this.abi,
          this.provider,
        );
        this.logger.log(
          `Blockchain Service siap (RPC: ${rpcUrl}, Contract: ${this.contractAddress})`,
        );
      } else {
        this.logger.warn(
          'CONTRACT_ADDRESS is not configured or invalid. ' +
          'Deploy the smart contract first and update .env',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Unable to initialize blockchain provider: ${error.message}`,
      );
    }
  }

  /**
   * Get ABI and contract address for frontend
   * Frontend needs this to interact directly via MetaMask
   */
  getContractInfo(): { abi: any[]; address: string } {
    return {
      abi: this.abi,
      address: this.contractAddress,
    };
  }

  /**
   * Verify certificate by documentId (QR Code scan)
   * Calls verifyByDocumentId() - view function (free, no gas)
   *
   * @param documentId Unique document ID
   * @returns Certificate data from blockchain
   */
  async verifyByDocumentId(documentId: string): Promise<{
    isValid: boolean;
    certificate: {
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
    };
    tokenId: string;
  }> {
    this.ensureContractReady();

    try {
      const [cert, tokenId] =
        await this.contract.verifyByDocumentId(documentId);

      return {
        isValid: cert.isValid,
        certificate: {
          documentId: cert.documentId,
          ipfsCID: cert.ipfsCID,
          studentName: cert.studentName,
          studentId: cert.studentId,
          studentWallet: cert.studentWallet,
          degree: cert.degree,
          major: cert.major,
          issuerName: cert.issuerName,
          issuedAt: Number(cert.issuedAt),
          isValid: cert.isValid,
        },
        tokenId: tokenId.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify document ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Verify certificate by comparing CID (deep verification)
   * Uses staticCall to call verifyCertificate() without gas
   *
   * @param documentId Document ID
   * @param ipfsCID CID to verify against
   */
  async verifyCertificateWithCID(
    documentId: string,
    ipfsCID: string,
  ): Promise<{
    isValid: boolean;
    isMatching: boolean;
    certificate: {
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
    };
    tokenId: string;
    tokenOwner: string;
  }> {
    this.ensureContractReady();

    try {
      const result = await this.contract.verifyCertificate.staticCall(
        documentId,
        ipfsCID,
      );

      return {
        isValid: result.isValid,
        isMatching: result.isMatching,
        certificate: {
          documentId: result.cert.documentId,
          ipfsCID: result.cert.ipfsCID,
          studentName: result.cert.studentName,
          studentId: result.cert.studentId,
          studentWallet: result.cert.studentWallet,
          degree: result.cert.degree,
          major: result.cert.major,
          issuerName: result.cert.issuerName,
          issuedAt: Number(result.cert.issuedAt),
          isValid: result.cert.isValid,
        },
        tokenId: result.tokenId.toString(),
        tokenOwner: result.tokenOwner,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deep verify document ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if a certificate is registered on blockchain
   */
  async certificateExists(documentId: string): Promise<boolean> {
    this.ensureContractReady();
    return await this.contract.certificateExists(documentId);
  }

  /**
   * Get complete certificate data from blockchain
   */
  async getCertificate(documentId: string): Promise<{
    certificate: {
      documentId: string;
      ipfsCID: string;
      studentName: string;
      studentId: string;
      studentWallet: string;
      degree: string;
      major: string;
      issuerAddress: string;
      issuerName: string;
      issuedAt: number;
      isValid: boolean;
    };
    tokenId: string;
  }> {
    this.ensureContractReady();

    try {
      const [cert, tokenId] = await this.contract.getCertificate(documentId);

      return {
        certificate: {
          documentId: cert.documentId,
          ipfsCID: cert.ipfsCID,
          studentName: cert.studentName,
          studentId: cert.studentId,
          studentWallet: cert.studentWallet,
          degree: cert.degree,
          major: cert.major,
          issuerAddress: cert.issuerAddress,
          issuerName: cert.issuerName,
          issuedAt: Number(cert.issuedAt),
          isValid: cert.isValid,
        },
        tokenId: tokenId.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get document data ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get CID from blockchain
   */
  async getCID(documentId: string): Promise<string> {
    this.ensureContractReady();
    return await this.contract.getCID(documentId);
  }

  /**
   * Get total number of registered certificates
   */
  async getTotalCertificates(): Promise<number> {
    this.ensureContractReady();
    const total = await this.contract.totalCertificates();
    return Number(total);
  }

  /**
   * Get all document IDs
   */
  async getAllDocumentIds(): Promise<string[]> {
    this.ensureContractReady();
    return await this.contract.getAllDocumentIds();
  }

  /**
   * Ensure contract is ready to use
   */
  private ensureContractReady(): void {
    if (!this.contract) {
      throw new Error(
        'Smart contract is not connected. Make sure CONTRACT_ADDRESS and BLOCKCHAIN_RPC_URL are configured.',
      );
    }
  }
}
