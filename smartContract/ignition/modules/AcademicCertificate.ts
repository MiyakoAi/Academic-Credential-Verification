import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Hardhat Ignition Module untuk deploy AcademicCertificate
 *
 * Deploy menggunakan:
 *   npx hardhat ignition deploy ignition/modules/AcademicCertificate.ts --network <network>
 *
 * Contoh:
 *   npx hardhat ignition deploy ignition/modules/AcademicCertificate.ts --network sepolia
 *   npx hardhat ignition deploy ignition/modules/AcademicCertificate.ts --network polygonAmoy
 */
export default buildModule("AcademicCertificateModule", (m) => {
  // Deploy contract AcademicCertificate
  const academicCertificate = m.contract("AcademicCertificate");

  return { academicCertificate };
});
