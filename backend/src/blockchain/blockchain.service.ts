import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Service untuk berinteraksi dengan Smart Contract AcademicCertificate di blockchain.
 *
 * Tugas utama:
 * 1. Membaca data sertifikat dari blockchain (view functions - gratis)
 * 2. Memverifikasi sertifikat berdasarkan documentId atau CID
 * 3. Menyediakan contract instance untuk frontend (ABI + address)
 *
 * Catatan: Transaksi write (registerCertificate, revokeCertificate)
 * dilakukan langsung dari frontend melalui MetaMask, bukan dari backend.
 * Backend hanya melakukan operasi READ untuk verifikasi.
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
        'ABI file tidak ditemukan. Pastikan file abi/AcademicCertificate.json ada.',
      );
      this.abi = [];
    }

    // Setup provider dan contract (read-only)
    // Menggunakan static network agar provider tidak langsung melakukan
    // koneksi ke RPC saat startup (mencegah crash jika blockchain node belum aktif)
    try {
      const staticNetwork = ethers.Network.from(31337); // Hardhat default chainId
      this.provider = new ethers.JsonRpcProvider(rpcUrl, staticNetwork, {
        staticNetwork: staticNetwork,
      });

      // Validasi: pastikan contract address adalah alamat Ethereum yang valid
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
          'CONTRACT_ADDRESS belum dikonfigurasi atau tidak valid. ' +
          'Deploy smart contract terlebih dahulu dan update .env',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Tidak dapat menginisialisasi blockchain provider: ${error.message}`,
      );
    }
  }

  /**
   * Mendapatkan ABI dan address contract untuk frontend
   * Frontend membutuhkan ini untuk berinteraksi langsung via MetaMask
   */
  getContractInfo(): { abi: any[]; address: string } {
    return {
      abi: this.abi,
      address: this.contractAddress,
    };
  }

  /**
   * Verifikasi sertifikat berdasarkan documentId (QR Code scan)
   * Memanggil verifyByDocumentId() - view function (gratis, tanpa gas)
   *
   * @param documentId ID unik dokumen
   * @returns Data sertifikat dari blockchain
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
        `Gagal verifikasi dokumen ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Verifikasi sertifikat dengan membandingkan CID (deep verification)
   * Menggunakan staticCall untuk memanggil verifyCertificate() tanpa gas
   *
   * @param documentId ID dokumen
   * @param ipfsCID CID yang ingin diverifikasi
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
        `Gagal deep verify dokumen ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Mengecek apakah sertifikat sudah terdaftar di blockchain
   */
  async certificateExists(documentId: string): Promise<boolean> {
    this.ensureContractReady();
    return await this.contract.certificateExists(documentId);
  }

  /**
   * Mengambil data sertifikat lengkap dari blockchain
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
        `Gagal ambil data dokumen ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Mengambil CID dari blockchain
   */
  async getCID(documentId: string): Promise<string> {
    this.ensureContractReady();
    return await this.contract.getCID(documentId);
  }

  /**
   * Mengambil total jumlah sertifikat terdaftar
   */
  async getTotalCertificates(): Promise<number> {
    this.ensureContractReady();
    const total = await this.contract.totalCertificates();
    return Number(total);
  }

  /**
   * Mengambil semua document IDs
   */
  async getAllDocumentIds(): Promise<string[]> {
    this.ensureContractReady();
    return await this.contract.getAllDocumentIds();
  }

  /**
   * Memastikan contract sudah siap digunakan
   */
  private ensureContractReady(): void {
    if (!this.contract) {
      throw new Error(
        'Smart contract belum terhubung. Pastikan CONTRACT_ADDRESS dan BLOCKCHAIN_RPC_URL sudah dikonfigurasi.',
      );
    }
  }
}
