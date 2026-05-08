'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { revokeCertificateOnChain } from '@/lib/web3';
import { verifyCertificate } from '@/lib/api';
import { useAdmin } from '../layout';

export default function RevokePage() {
  const { walletAddress } = useAdmin();
  const [documentId, setDocumentId] = useState('');
  const [confirmAddress, setConfirmAddress] = useState('');
  const [certInfo, setCertInfo] = useState<{
    studentName: string;
    studentId: string;
    major: string;
  } | null>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState('');

  // Confirmation match check
  const isConfirmed =
    walletAddress &&
    confirmAddress.toLowerCase() === walletAddress.toLowerCase();

  // ============================================================
  //                  LOOK UP CERTIFICATE
  // ============================================================

  async function handleLookup() {
    if (!documentId.trim()) return;
    setIsChecking(true);
    setError('');
    setCertInfo(null);

    try {
      const response = await verifyCertificate(documentId.trim());
      if (response.success && response.data.isValid) {
        setCertInfo({
          studentName: response.data.certificate.studentName,
          studentId: response.data.certificate.studentId,
          major: response.data.certificate.major,
        });
      } else if (response.success && !response.data.isValid) {
        setError('Ijazah ini sudah dicabut sebelumnya.');
      } else {
        setError(response.message || 'Dokumen tidak ditemukan.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencari dokumen.');
    } finally {
      setIsChecking(false);
    }
  }

  // ============================================================
  //                  REVOKE HANDLER
  // ============================================================

  async function handleRevoke() {
    if (!isConfirmed || !documentId.trim()) return;

    setIsRevoking(true);
    setError('');

    try {
      const result = await revokeCertificateOnChain(documentId.trim());
      setTxHash(result.hash);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pencabutan gagal.';
      if (message.includes('user rejected') || message.includes('denied')) {
        setError('Transaksi dibatalkan oleh pengguna.');
      } else {
        setError(message);
      }
    } finally {
      setIsRevoking(false);
    }
  }

  // ============================================================
  //                   SUCCESS STATE
  // ============================================================

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <Icon icon="lucide:flame" className="text-[var(--danger)] text-5xl" />
          </div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Ijazah Dicabut</h3>
          <p className="text-[var(--text-secondary)] text-sm mb-2">
            Soulbound Token (SBT) telah dibakar dan statusnya sekarang <strong className="text-[var(--danger)]">INVALID</strong> secara permanen.
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono break-all mb-6">TX: {txHash}</p>
          <button
            onClick={() => {
              setSuccess(false);
              setDocumentId('');
              setConfirmAddress('');
              setCertInfo(null);
              setTxHash('');
            }}
            className="btn-outline"
          >
            Selesai
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  //                        RENDER
  // ============================================================

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1 flex items-center gap-3">
          <Icon icon="lucide:flame" className="text-[var(--danger)]" />
          Pencabutan Ijazah (Revoke & Burn)
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Cabut dan hancurkan Soulbound Token ijazah yang bermasalah secara permanen.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 p-4 rounded-xl bg-[var(--danger-bg)] border border-red-500/20 flex items-start gap-3">
        <Icon icon="lucide:shield-alert" className="text-[var(--danger)] text-2xl flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[var(--danger)] text-sm font-semibold">⚠ PERINGATAN: Tindakan Ini Tidak Dapat Dibatalkan</p>
          <p className="text-[var(--danger)]/70 text-xs mt-1">
            Pencabutan ijazah akan menghancurkan SBT dari wallet mahasiswa dan menandai status
            dokumen sebagai INVALID secara permanen di Blockchain. Data tidak bisa dipulihkan.
          </p>
        </div>
      </div>

      <div className="max-w-xl">
        {/* Step 1: Cari Dokumen */}
        <div className="glass-card p-6 mb-4">
          <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-4 flex items-center gap-2">
            <Icon icon="lucide:search" className="text-[#ff9500]" />
            Langkah 1: Cari Dokumen
          </h3>
          <div className="flex gap-2">
            <input
              id="revoke-doc-id"
              type="text"
              placeholder="Masukkan Nomor Ijazah"
              value={documentId}
              onChange={(e) => {
                setDocumentId(e.target.value);
                setCertInfo(null);
                setError('');
              }}
              className="input-field flex-1"
            />
            <button
              onClick={handleLookup}
              disabled={!documentId.trim() || isChecking}
              className="btn-outline flex items-center gap-2"
            >
              {isChecking ? (
                <Icon icon="lucide:loader-2" className="animate-spin" />
              ) : (
                <Icon icon="lucide:search" />
              )}
              Cari
            </button>
          </div>

          {/* Certificate Info */}
          <AnimatePresence>
            {certInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <p className="text-amber-300 text-xs font-semibold mb-2">Dokumen ditemukan:</p>
                <div className="space-y-1 text-sm">
                  <p className="text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)]">Nama: </span>
                    {certInfo.studentName}
                  </p>
                  <p className="text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)]">NIM: </span>
                    {certInfo.studentId}
                  </p>
                  <p className="text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)]">Jurusan: </span>
                    {certInfo.major}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step 2: Konfirmasi Identitas (2-Layer Security) */}
        {certInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 mb-4"
          >
            <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-4 flex items-center gap-2">
              <Icon icon="lucide:shield-alert" className="text-[var(--danger)]" />
              Langkah 2: Verifikasi 2 Lapis — Konfirmasi Identitas Admin
            </h3>

            <p className="text-[var(--text-secondary)] text-xs mb-3">
              Untuk keamanan, ketik ulang <strong className="text-[var(--text-primary)]">Wallet Address Anda</strong> di bawah ini
              sebagai bukti bahwa Anda sadar penuh melakukan tindakan ini:
            </p>

            <div className="p-3 rounded-lg bg-[var(--surface-secondary)] text-xs text-[var(--text-secondary)] font-mono mb-3 break-all">
              {walletAddress}
            </div>

            <input
              id="revoke-confirm-address"
              type="text"
              placeholder="Ketik ulang Wallet Address Anda di sini..."
              value={confirmAddress}
              onChange={(e) => setConfirmAddress(e.target.value)}
              className="input-field font-mono text-sm"
            />

            {confirmAddress && !isConfirmed && (
              <p className="text-[var(--danger)] text-xs mt-2 flex items-center gap-1">
                <Icon icon="lucide:x-circle" />
                Address tidak cocok
              </p>
            )}
            {isConfirmed && (
              <p className="text-[var(--success)] text-xs mt-2 flex items-center gap-1">
                <Icon icon="lucide:check-circle" />
                Address cocok — tombol pencabutan aktif
              </p>
            )}
          </motion.div>
        )}

        {/* Step 3: Execute Revoke */}
        {certInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6"
          >
            <button
              id="revoke-execute"
              onClick={handleRevoke}
              disabled={!isConfirmed || isRevoking}
              className="btn-danger w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {isRevoking ? (
                <>
                  <Icon icon="lucide:loader-2" className="animate-spin text-xl" />
                  Memproses pencabutan...
                </>
              ) : (
                <>
                  <Icon icon="lucide:flame" className="text-xl" />
                  Cabut & Bakar Ijazah
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 rounded-xl bg-[var(--danger-bg)] border border-red-200 flex items-center gap-3"
            >
              <Icon icon="lucide:alert-circle" className="text-[var(--danger)] text-xl flex-shrink-0" />
              <p className="text-[var(--danger)] text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
