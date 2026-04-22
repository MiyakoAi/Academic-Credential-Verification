import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO untuk request registrasi sertifikat (Fase 1: Upload ke IPFS)
 * Admin mengisi data ini melalui form di frontend
 */
export class RegisterCertificateDto {
  @ApiProperty({
    description: 'ID unik dokumen (format: UNIV-TAHUN-NOMOR)',
    example: 'UGM-2024-00001',
  })
  @IsString()
  @IsNotEmpty({ message: 'Document ID tidak boleh kosong' })
  documentId: string;

  @ApiProperty({
    description: 'Nama lengkap mahasiswa',
    example: 'Budi Santoso',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama mahasiswa tidak boleh kosong' })
  studentName: string;

  @ApiProperty({
    description: 'NIM (Nomor Induk Mahasiswa)',
    example: '20/504900/TK/51234',
  })
  @IsString()
  @IsNotEmpty({ message: 'NIM tidak boleh kosong' })
  studentId: string;

  @ApiProperty({
    description: 'Alamat wallet mahasiswa (penerima SBT)',
    example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  })
  @IsString()
  @IsNotEmpty({ message: 'Alamat wallet mahasiswa tidak boleh kosong' })
  studentWallet: string;

  @ApiProperty({
    description: 'Gelar/jenjang pendidikan',
    example: 'S1',
  })
  @IsString()
  @IsNotEmpty({ message: 'Gelar tidak boleh kosong' })
  degree: string;

  @ApiProperty({
    description: 'Program studi / jurusan',
    example: 'Teknik Informatika',
  })
  @IsString()
  @IsNotEmpty({ message: 'Jurusan tidak boleh kosong' })
  major: string;

  @ApiProperty({
    description: 'Nama institusi penerbit',
    example: 'Universitas Gadjah Mada',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama institusi tidak boleh kosong' })
  issuerName: string;
}

/**
 * DTO untuk request verifikasi dokumen
 */
export class VerifyDocumentDto {
  @ApiProperty({
    description: 'ID unik dokumen',
    example: 'UGM-2024-00001',
  })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({
    description: 'CID untuk deep verification (opsional)',
    example: 'QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar',
    required: false,
  })
  @IsString()
  @IsOptional()
  cid?: string;
}
