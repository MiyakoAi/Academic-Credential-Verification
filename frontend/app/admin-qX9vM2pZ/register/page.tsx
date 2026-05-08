'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { registerCertificate } from '@/lib/api';
import { mintCertificate } from '@/lib/web3';
import { useAdmin } from '../layout';

type Step = 'form' | 'uploading' | 'metamask' | 'mining' | 'success' | 'error';

export default function RegisterPage() {
  const { stampedData, setStampedData } = useAdmin();

  // Form state
  const [documentId, setDocumentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentWallet, setStudentWallet] = useState('');
  const [degree, setDegree] = useState('');
  const [major, setMajor] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Process state
  const [step, setStep] = useState<Step>('form');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-fill from Menu 2 (Stamper)
  useEffect(() => {
    if (stampedData) {
      setDocumentId(stampedData.documentId);
      if (stampedData.pdfFile) setPdfFile(stampedData.pdfFile);
      // Clear after consuming
      setStampedData(null);
    }
  }, [stampedData, setStampedData]);

  const isFormValid =
    documentId.trim() &&
    studentName.trim() &&
    studentId.trim() &&
    studentWallet.trim() &&
    degree.trim() &&
    major.trim() &&
    pdfFile;

  // ============================================================
  //              DRAG & DROP FILE HANDLERS
  // ============================================================

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') setPdfFile(file);
  }, []);

  // ============================================================
  //              REGISTRATION HANDLER
  // ============================================================

  async function handleRegister() {
    if (!isFormValid || !pdfFile) return;

    try {
      // Step 1: Upload to IPFS via Backend
      setStep('uploading');

      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('documentId', documentId.trim());
      formData.append('studentName', studentName.trim());
      formData.append('studentId', studentId.trim());
      formData.append('studentWallet', studentWallet.trim());
      formData.append('degree', degree.trim());
      formData.append('major', major.trim());
      formData.append('issuerName', 'Universitas Muslim Indonesia');

      const response = await registerCertificate(formData);

      if (!response.success) {
        throw new Error(response.message);
      }

      // Step 2: Trigger MetaMask
      setStep('metamask');

      const result = await mintCertificate({
        documentId: documentId.trim(),
        ipfsCID: response.data.ipfsCID,
        studentName: studentName.trim(),
        studentId: studentId.trim(),
        studentWallet: studentWallet.trim(),
        degree: degree.trim(),
        major: major.trim(),
        metadataURI: response.data.metadataURI,
      });

      // Step 3: Mining
      setStep('mining');
      setTxHash(result.hash);

      // Step 4: Success!
      setStep('success');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.',
      );
      setStep('error');
    }
  }

  function handleReset() {
    setStep('form');
    setDocumentId('');
    setStudentName('');
    setStudentId('');
    setStudentWallet('');
    setDegree('');
    setMajor('');
    setPdfFile(null);
    setTxHash('');
    setErrorMsg('');
  }

  // ============================================================
  //                PROCESSING OVERLAY
  // ============================================================

  if (step !== 'form') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 max-w-md w-full text-center"
        >
          <AnimatePresence mode="wait">
            {step === 'uploading' && (
              <StepDisplay
                key="uploading"
                icon="lucide:upload-cloud"
                color="blue"
                title="Mengunggah ke IPFS..."
                description="Menyimpan dokumen ke sistem penyimpanan terdesentralisasi."
                spinning
              />
            )}
            {step === 'metamask' && (
              <StepDisplay
                key="metamask"
                icon="lucide:wallet"
                color="amber"
                title="Menunggu Konfirmasi MetaMask..."
                description="Silakan konfirmasi transaksi di pop-up MetaMask Anda."
                spinning
              />
            )}
            {step === 'mining' && (
              <StepDisplay
                key="mining"
                icon="lucide:hammer"
                color="purple"
                title="Memproses Transaksi di Blockchain..."
                description="Menunggu konfirmasi dari jaringan blockchain."
                spinning
              />
            )}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Icon icon="lucide:badge-check" className="text-[var(--success)] text-5xl" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">🎉 SUKSES!</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-4">
                  Ijazah berhasil didaftarkan ke Blockchain dan tidak dapat diubah lagi.
                </p>
                {txHash && (
                  <p className="text-xs text-[var(--text-muted)] font-mono mb-6 break-all">
                    TX: {txHash}
                  </p>
                )}
                <button onClick={handleReset} className="btn-primary">
                  Daftarkan Lagi
                </button>
              </motion.div>
            )}
            {step === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Icon icon="lucide:alert-circle" className="text-[var(--danger)] text-5xl" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Registrasi Gagal</h3>
                <p className="text-[var(--danger)] text-sm mb-6">{errorMsg}</p>
                <button onClick={() => setStep('form')} className="btn-outline">
                  Kembali ke Form
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  //                    FORM RENDER
  // ============================================================

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1 flex items-center gap-3">
          <Icon icon="lucide:file-plus" className="text-[var(--accent)]" />
          Registrasi Ijazah ke Blockchain
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Isi data mahasiswa dan upload PDF final untuk menerbitkan Soulbound Token (SBT).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form Fields */}
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-[var(--text-primary)] text-sm font-semibold flex items-center gap-2">
              <Icon icon="lucide:text-cursor-input" className="text-[var(--success)]" />
              Data Mahasiswa
            </h3>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Nomor Ijazah *</label>
              <input
                id="reg-doc-id"
                type="text"
                placeholder="UMI-2022-13020220166"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Nama Lengkap *</label>
              <input
                id="reg-name"
                type="text"
                placeholder="Mugni Adji"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">NIM *</label>
                <input
                  id="reg-nim"
                  type="text"
                  placeholder="13020220166"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Gelar *</label>
                <input
                  id="reg-degree"
                  type="text"
                  placeholder="S1"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Program Studi / Jurusan *</label>
              <input
                id="reg-major"
                type="text"
                placeholder="Teknik Informatika"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Wallet Address Mahasiswa *</label>
              <input
                id="reg-wallet"
                type="text"
                placeholder="0x..."
                value={studentWallet}
                onChange={(e) => setStudentWallet(e.target.value)}
                className="input-field font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: File Upload & Submit */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-4 flex items-center gap-2">
              <Icon icon="lucide:file-check" className="text-[var(--danger)]" />
              Upload PDF Ijazah Final
            </h3>

            <div
              className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => document.getElementById('reg-file-input')?.click()}
            >
              <input
                id="reg-file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPdfFile(file);
                }}
              />
              {pdfFile ? (
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:file-check" className="text-[var(--danger)] text-3xl" />
                  <div className="text-left">
                    <p className="text-[var(--text-primary)] text-sm font-medium">{pdfFile.name}</p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfFile(null);
                    }}
                    className="ml-auto text-[var(--text-secondary)] hover:text-[var(--danger)] transition"
                  >
                    <Icon icon="lucide:x" className="text-xl" />
                  </button>
                </div>
              ) : (
                <>
                  <Icon icon="lucide:upload-cloud" className="text-3xl text-[var(--text-muted)] mb-2" />
                  <p className="text-[var(--text-secondary)] text-sm">Drag & Drop PDF atau klik untuk memilih</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">Pastikan QR Code sudah tertempel</p>
                </>
              )}
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="glass-card p-6">
            <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-4 flex items-center gap-2">
              <Icon icon="lucide:list-checks" className="text-[#ff9500]" />
              Ringkasan
            </h3>
            <div className="space-y-2 text-sm mb-6">
              <SummaryRow label="Nomor Ijazah" value={documentId} />
              <SummaryRow label="Nama" value={studentName} />
              <SummaryRow label="NIM" value={studentId} />
              <SummaryRow label="Jurusan" value={major} />
              <SummaryRow label="Gelar" value={degree} />
              <SummaryRow label="Wallet" value={studentWallet ? `${studentWallet.slice(0, 10)}...` : ''} />
              <SummaryRow label="File" value={pdfFile?.name || ''} />
            </div>

            <button
              id="register-submit"
              onClick={handleRegister}
              disabled={!isFormValid}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              <Icon icon="lucide:rocket" className="text-xl" />
              Daftarkan ke Blockchain
            </button>

            <p className="text-xs text-[var(--text-muted)] text-center mt-3">
              Anda akan diminta konfirmasi di MetaMask untuk membayar Gas Fee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//                    SUB-COMPONENTS
// ============================================================

function StepDisplay({
  icon,
  color,
  title,
  description,
  spinning,
}: {
  icon: string;
  color: string;
  title: string;
  description: string;
  spinning?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'text-[var(--accent)] bg-blue-500/20',
    amber: 'text-[#ff9500] bg-amber-500/20',
    purple: 'text-[#af52de] bg-purple-500/20',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={`w-20 h-20 mx-auto mb-6 rounded-full ${colors[color]} flex items-center justify-center`}>
        <Icon icon={icon} className={`text-4xl ${spinning ? 'animate-spin' : ''}`} />
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm">{description}</p>
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-medium ${value ? 'text-[var(--text-primary)]' : 'text-slate-700'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
