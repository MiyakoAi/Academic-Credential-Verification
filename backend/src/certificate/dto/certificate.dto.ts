import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for certificate registration request (Phase 1: Upload to IPFS)
 * Admin fills in this data through the frontend form
 */
export class RegisterCertificateDto {
  @ApiProperty({
    description: 'Unique document ID (format: UNIV-YEAR-NUMBER)',
    example: 'UMI-2022-13020220166',
  })
  @IsString()
  @IsNotEmpty({ message: 'Document ID cannot be empty' })
  documentId: string;

  @ApiProperty({
    description: 'Student full name',
    example: 'Abd. Mugni Adji Susilo',
  })
  @IsString()
  @IsNotEmpty({ message: 'Student name cannot be empty' })
  studentName: string;

  @ApiProperty({
    description: 'Student ID number',
    example: '13020220166',
  })
  @IsString()
  @IsNotEmpty({ message: 'Student ID cannot be empty' })
  studentId: string;

  @ApiProperty({
    description: 'Student wallet address (SBT recipient)',
    example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  })
  @IsString()
  @IsNotEmpty({ message: 'Student wallet address cannot be empty' })
  studentWallet: string;

  @ApiProperty({
    description: 'Degree / education level',
    example: 'S1',
  })
  @IsString()
  @IsNotEmpty({ message: 'Degree cannot be empty' })
  degree: string;

  @ApiProperty({
    description: 'Study program / major',
    example: 'Teknik Informatika',
  })
  @IsString()
  @IsNotEmpty({ message: 'Major cannot be empty' })
  major: string;

  @ApiProperty({
    description: 'Issuing institution name',
    example: 'Universitas Muslim Indonesia',
  })
  @IsString()
  @IsNotEmpty({ message: 'Issuer name cannot be empty' })
  issuerName: string;
}

/**
 * DTO for document verification request
 */
export class VerifyDocumentDto {
  @ApiProperty({
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({
    description: 'CID for deep verification (optional)',
    example: 'QmX7b3e1LpHTzKsRoEaqbzCp5AuNpBSmk5pCiN4QiPzMar',
    required: false,
  })
  @IsString()
  @IsOptional()
  cid?: string;
}

/**
 * DTO for Secure Download feature
 * Requires Document ID, Student ID (NIM), and Wallet Address
 * All three must match the blockchain record to authorize download
 */
export class SecureDownloadDto {
  @ApiProperty({
    description: 'Unique document ID',
    example: 'UMI-2022-13020220166',
  })
  @IsString()
  @IsNotEmpty({ message: 'Document ID cannot be empty' })
  documentId: string;

  @ApiProperty({
    description: 'Student ID number (NIM)',
    example: '13020220166',
  })
  @IsString()
  @IsNotEmpty({ message: 'Student ID cannot be empty' })
  studentId: string;

  @ApiProperty({
    description: 'Student wallet address',
    example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  })
  @IsString()
  @IsNotEmpty({ message: 'Wallet address cannot be empty' })
  studentWallet: string;
}
