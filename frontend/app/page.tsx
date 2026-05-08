'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { verifyCertificate, deepVerifyCertificate, decryptQRData } from '@/lib/api';
import type { CertificateData } from '@/lib/api';

// ============================================================
//   VIEW STATES
// ============================================================

type ViewState = 'idle' | 'result' | 'deep-verify' | 'info-popup';

// ============================================================
//   MAIN PAGE
// ============================================================

export default function VerificationPage() {
  const [searchId, setSearchId] = useState('');
  const [view, setView] = useState<ViewState>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    certificate: CertificateData;
    tokenId: string;
    qrCode: string;
  } | null>(null);
  const [error, setError] = useState('');

  // Deep Verify
  const [deepFile, setDeepFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deepResult, setDeepResult] = useState<{
    isMatching: boolean;
    uploadedCID: string;
    storedCID: string;
  } | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);

  // Info popup
  const [infoContent, setInfoContent] = useState<{ title: string; body: string } | null>(null);

  // Mouse parallax with springs for smoothness
  const mouseX = useSpring(0, { stiffness: 50, damping: 20 });
  const mouseY = useSpring(0, { stiffness: 50, damping: 20 });
  const logoX = useTransform(mouseX, [-1, 1], [12, -12]);
  const logoY = useTransform(mouseY, [-1, 1], [12, -12]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
      mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [mouseX, mouseY]);

  // ── Auto-fill from URL query ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encryptedData = params.get('data');
    if (encryptedData) {
      (async () => {
        try {
          setIsVerifying(true);
          setError('');
          const documentId = await decryptQRData(encryptedData);
          setSearchId(documentId);
          await handleVerify(documentId);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal mendekripsi data QR Code.');
          setView('idle');
        } finally {
          setIsVerifying(false);
        }
      })();
      return;
    }
    const id = params.get('id');
    if (id) { setSearchId(id); handleVerify(id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers (unchanged logic) ──

  async function handleVerify(id?: string) {
    const docId = id || searchId.trim();
    if (!docId) return;
    setIsVerifying(true);
    setError('');
    setResult(null);
    setDeepResult(null);
    try {
      const response = await verifyCertificate(docId);
      if (response.success) {
        setResult(response.data);
        setView('result');
      } else {
        setError(response.message || 'Dokumen tidak ditemukan.');
        setView('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memverifikasi.');
      setView('idle');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleDeepVerify() {
    if (!deepFile || !result) return;
    setDeepLoading(true);
    setDeepResult(null);
    try {
      const response = await deepVerifyCertificate(result.certificate.documentId, deepFile);
      if (response.success) {
        setDeepResult({ isMatching: response.data.isMatching, uploadedCID: response.data.uploadedCID, storedCID: response.data.storedCID });
      } else { setError(response.message); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Deep verify gagal.'); }
    finally { setDeepLoading(false); }
  }

  function handleReset() {
    setView('idle');
    setResult(null);
    setError('');
    setSearchId('');
    setDeepFile(null);
    setDeepResult(null);
    setInfoContent(null);
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') setDeepFile(file);
  }, []);
  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDeepFile(file);
  }, []);

  const infoItems = [
    { icon: 'lucide:scan-line', label: 'Scan QR Code', title: 'Cara Scan QR Code', body: 'Arahkan kamera HP Anda ke QR Code yang tercetak pada ijazah fisik. Browser akan otomatis membuka halaman ini dan menampilkan hasil verifikasi secara instan.' },
    { icon: 'lucide:fingerprint', label: 'Deep Verification', title: 'Apa itu Deep Verification?', body: 'Masukkan nomor ijazah terlebih dahulu, lalu unggah file PDF softcopy ijazah. Sistem akan membandingkan sidik jari digital (CID) file Anda dengan data yang tersimpan di Blockchain untuk memastikan keaslian 100%.' },
    { icon: 'lucide:blocks', label: 'Blockchain', title: 'Bagaimana Blockchain Bekerja?', body: 'Setiap ijazah yang diterbitkan dicatat secara permanen di Blockchain sebagai Soulbound Token (SBT) yang tidak bisa dipalsukan, dihapus, atau dipindahtangankan. Ini menjamin keaslian dokumen Anda selamanya.' },
  ];

  const isIdle = view === 'idle' || view === 'info-popup';

  // ── spring-based animation configs ──
  const springTransition = { type: 'spring' as const, stiffness: 200, damping: 25, mass: 0.8 };
  const smoothTransition = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 1 };

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden relative flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #eef2f7 0%, #e8ecf3 30%, #f0ece6 60%, #edf0f5 100%)' }}
    >
      {/* ── Interactive Particle Mesh Network ── */}
      <NetworkMesh />

      {/* ── Logo UMI — blended watermark, right side ── */}
      <motion.div
        className="absolute pointer-events-none select-none"
        style={{
          x: logoX,
          y: logoY,
          right: '-2%',
          top: '50%',
          translateY: '-50%',
          width: '52%',
          maxWidth: '620px',
        }}
      >
        <Image
          src="/logo-umi.png"
          alt=""
          width={620}
          height={620}
          className="w-full h-auto"
          style={{
            opacity: 0.07,
            filter: 'blur(1.5px) grayscale(0.3)',
            mixBlendMode: 'multiply',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 72%)',
          }}
          priority
        />
      </motion.div>

      {/* ── Color orbs — vivid blobs that the glass refracts ── */}
      <div className="absolute pointer-events-none" style={{ width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,160,255,0.22) 0%, transparent 60%)', top: '10%', left: '15%', filter: 'blur(90px)' }} />
      <div className="absolute pointer-events-none" style={{ width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,200,0.18) 0%, transparent 60%)', bottom: '5%', right: '10%', filter: 'blur(80px)' }} />
      <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(140,220,180,0.16) 0%, transparent 60%)', top: '50%', left: '55%', filter: 'blur(70px)' }} />

      {/* ══════════════════════════════════════
           MAIN CONTENT
          ══════════════════════════════════════ */}
      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">

        {/* ── Title & Subtitle ── */}
        <AnimatePresence>
          {isIdle && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={smoothTransition}
              className="text-center mb-10"
            >
              <h1
                className="text-4xl md:text-5xl font-medium tracking-tight mb-4"
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  color: '#1d1d1f',
                  lineHeight: 1.15,
                }}
              >
                Universitas Muslim Indonesia
              </h1>
              <p className="text-base md:text-lg max-w-md mx-auto leading-relaxed" style={{ color: '#86868b' }}>
                Pastikan keaslian Ijazah dengan teknologi Blockchain yang tidak dapat dipalsukan
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && view === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="w-full mb-4"
            >
              <div className="liquid-glass p-4 flex items-center gap-3">
                <Icon icon="lucide:alert-circle" className="text-[var(--danger)] text-xl flex-shrink-0" />
                <p className="text-[var(--danger)] text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════
             THE MORPHING ELEMENT
            ══════════════════════════════════════ */}
        <AnimatePresence mode="wait">

          {/* ── IDLE: Search Bar ── */}
          {view === 'idle' && (
            <motion.div
              key="searchbar"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                scale: 0.3,
                opacity: 0,
                borderRadius: '50%',
                width: 72,
                height: 72,
                transition: { duration: 0.3, ease: 'easeInOut' },
              }}
              transition={springTransition}
              className="w-full"
            >
              <div className="liquid-glass-strong p-2.5 flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Icon
                    icon="lucide:search"
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-xl"
                    style={{ color: '#86868b' }}
                  />
                  <input
                    id="document-id-input"
                    type="text"
                    placeholder="Masukkan Nomor Ijazah"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    disabled={isVerifying}
                    className="w-full py-4 pl-14 pr-4 bg-transparent outline-none text-base rounded-2xl disabled:opacity-50"
                    style={{ color: '#1d1d1f' }}
                  />
                </div>
                <button
                  id="verify-button"
                  onClick={() => handleVerify()}
                  disabled={!searchId.trim() || isVerifying}
                  className="flex items-center gap-2 px-7 py-4 rounded-[22px] font-semibold text-sm text-white transition-all duration-200 disabled:opacity-30"
                  style={{
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {isVerifying ? (
                    <Icon icon="lucide:loader-2" className="text-base animate-spin" />
                  ) : (
                    <>
                      Verifikasi
                      <Icon icon="lucide:arrow-right" className="text-base" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── INFO POPUP ── */}
          {view === 'info-popup' && infoContent && (
            <motion.div
              key="info-popup"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={springTransition}
              className="w-full"
            >
              <div className="liquid-glass-strong p-8">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: '#1d1d1f' }}>{infoContent.title}</h3>
                  <button onClick={() => { setView('idle'); setInfoContent(null); }}
                    className="p-2 rounded-full hover:bg-black/5 transition">
                    <Icon icon="lucide:x" className="text-lg" style={{ color: '#86868b' }} />
                  </button>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#6e6e73' }}>{infoContent.body}</p>
              </div>
            </motion.div>
          )}

          {/* ── RESULT: Info Card ── */}
          {view === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.5, borderRadius: 60 }}
              animate={{ opacity: 1, scale: 1, borderRadius: 28 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 130, damping: 18, mass: 0.8 }}
              className="w-full"
            >
              <div className={`liquid-glass-strong p-8 ${result.isValid ? 'glow-emerald' : 'glow-danger'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className={result.isValid ? 'badge-valid' : 'badge-invalid'}>
                    <Icon icon={result.isValid ? 'lucide:badge-check' : 'lucide:shield-x'} className="text-lg" />
                    {result.isValid ? 'DOKUMEN VALID' : 'DOKUMEN DICABUT'}
                  </div>
                  <span className="text-xs font-mono" style={{ color: '#aeaeb2' }}>#{result.tokenId}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoRow icon="lucide:file-text" label="Nomor Ijazah" value={result.certificate.documentId} />
                  <InfoRow icon="lucide:user" label="Nama" value={result.certificate.studentName} />
                  <InfoRow icon="lucide:hash" label="NIM" value={result.certificate.studentId} />
                  <InfoRow icon="lucide:graduation-cap" label="Jurusan" value={result.certificate.major} />
                  <InfoRow icon="lucide:award" label="Gelar" value={result.certificate.degree} />
                  <InfoRow icon="lucide:building-2" label="Penerbit" value={result.certificate.issuerName} />
                  <InfoRow icon="lucide:fingerprint" label="Nomor Token" value={`#${result.tokenId}`} />
                  <InfoRow
                    icon="lucide:calendar-check" label="Terbit"
                    value={new Date(result.certificate.issuedAt * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DEEP VERIFY ── */}
          {view === 'deep-verify' && result && (
            <motion.div
              key="deep"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={springTransition}
              className="w-full"
            >
              <div className="liquid-glass-strong p-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                    <Icon icon="lucide:fingerprint" style={{ color: 'var(--accent)' }} />
                    Deep Verification
                  </h3>
                  <button onClick={() => setView('result')} className="btn-ghost text-sm hover:bg-black/5 p-2 rounded-lg transition-colors">
                    <Icon icon="lucide:arrow-left" className="text-base" /> Kembali
                  </button>
                </div>
                <p className="text-sm mb-6" style={{ color: '#6e6e73' }}>
                  Upload file PDF ijazah untuk membandingkan sidik jari digital (CID) dengan data Blockchain.
                </p>
                <div
                  className={`drop-zone mb-4 ${isDragging ? 'drag-over' : ''}`}
                  onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  onClick={() => document.getElementById('deep-file-input')?.click()}
                >
                  <input id="deep-file-input" type="file" accept=".pdf" className="hidden" onChange={onFileSelect} />
                  {deepFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <Icon icon="lucide:file-check" className="text-[var(--success)] text-3xl" />
                      <div className="text-left">
                        <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>{deepFile.name}</p>
                        <p className="text-xs" style={{ color: '#aeaeb2' }}>{(deepFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setDeepFile(null); setDeepResult(null); }}
                        className="ml-4 hover:text-[var(--danger)] transition" style={{ color: '#aeaeb2' }}>
                        <Icon icon="lucide:x" className="text-xl" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Icon icon="lucide:upload-cloud" className="text-4xl mb-2" style={{ color: '#aeaeb2' }} />
                      <p className="text-sm" style={{ color: '#6e6e73' }}>Drag & Drop PDF, atau klik untuk memilih</p>
                    </>
                  )}
                </div>
                <button id="deep-verify-submit" onClick={handleDeepVerify} disabled={!deepFile || deepLoading}
                  className="btn-primary w-full">
                  {deepLoading
                    ? (<><Icon icon="lucide:loader-2" className="animate-spin text-lg" /> Membandingkan...</>)
                    : (<><Icon icon="lucide:shield-check" className="text-lg" /> Verifikasi Keaslian File</>)
                  }
                </button>
                <AnimatePresence>
                  {deepResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                      <div className={`p-4 rounded-2xl border ${deepResult.isMatching ? 'bg-[var(--success-bg)] border-green-200' : 'bg-[var(--danger-bg)] border-red-200'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <Icon icon={deepResult.isMatching ? 'lucide:badge-check' : 'lucide:shield-alert'}
                            className={`text-2xl ${deepResult.isMatching ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`} />
                          <p className={`font-semibold text-sm ${deepResult.isMatching ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {deepResult.isMatching ? 'FILE ASLI — CID cocok 100%' : 'FILE TIDAK SESUAI — CID berbeda!'}
                          </p>
                        </div>
                        <div className="text-xs space-y-1 font-mono" style={{ color: '#6e6e73' }}>
                          <p>CID Upload : {deepResult.uploadedCID}</p>
                          <p>CID Chain  : {deepResult.storedCID}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action Buttons (slide in after result) ── */}
        <AnimatePresence>
          {view === 'result' && result && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.15 } }}
              transition={{ ...springTransition, delay: 0.2 }}
              className="flex gap-3 mt-6"
            >
              {result.isValid && (
                <button
                  onClick={() => { setView('deep-verify'); setDeepFile(null); setDeepResult(null); }}
                  className="liquid-glass px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  style={{ color: '#1d1d1f' }}
                >
                  <Icon icon="lucide:fingerprint" className="text-base" />
                  Deep Verify
                </button>
              )}
              <button
                onClick={handleReset}
                className="liquid-glass px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                style={{ color: '#6e6e73' }}
              >
                <Icon icon="lucide:rotate-ccw" className="text-base" />
                Cek Lagi
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 3 Help Pills ── */}
        <AnimatePresence>
          {isIdle && !infoContent && (
            <motion.div
              key="pills"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ ...smoothTransition, delay: 0.15 }}
              className="flex flex-wrap gap-2.5 mt-8 justify-center"
            >
              {infoItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { setInfoContent({ title: item.title, body: item.body }); setView('info-popup'); }}
                  className="liquid-glass inline-flex items-center gap-2 px-5 py-3 rounded-full
                             text-sm font-medium cursor-pointer
                             hover:scale-105 active:scale-95 transition-transform"
                  style={{ color: '#6e6e73' }}
                >
                  <Icon icon={item.icon} className="text-base" />
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs" style={{ color: '#aeaeb2' }}>
          © {new Date().getFullYear()} Universitas Muslim Indonesia
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
      <Icon icon={icon} className="text-lg mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <div>
        <p className="text-xs mb-0.5" style={{ color: '#aeaeb2' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>{value}</p>
      </div>
    </div>
  );
}

// ============================================================
//   INTERACTIVE PARTICLE MESH NETWORK (Canvas)
//   Dense at edges, fading toward center, reacts to cursor
// ============================================================

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
}

function NetworkMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PARTICLE_COUNT = 45;
    const CONNECTION_DISTANCE = 220;
    const MOUSE_RADIUS = 200;
    const RETURN_SPEED = 0.025;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    // Distribute particles mostly at left & right edges
    function initParticles() {
      const w = canvas!.width;
      const h = canvas!.height;
      particlesRef.current = [];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x: number;
        const roll = Math.random();

        if (roll < 0.4) {
          // Left edge zone (0% - 20% of width)
          x = Math.random() * w * 0.22;
        } else if (roll < 0.8) {
          // Right edge zone (80% - 100% of width)
          x = w - Math.random() * w * 0.22;
        } else {
          // Sparse middle
          x = w * 0.25 + Math.random() * w * 0.5;
        }

        const y = Math.random() * h;

        particlesRef.current.push({
          x, y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: Math.random() * 2 + 1.2,
        });
      }
    }

    // How opaque a particle/line should be based on distance from edges
    // 1.0 at edges, fading to ~0.1 at center
    function edgeFactor(px: number): number {
      const w = canvas!.width;
      const centerDist = Math.abs(px - w / 2) / (w / 2); // 0 at center, 1 at edge
      return 0.08 + centerDist * 0.92; // min 0.08, max 1.0
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.vx -= (dx / dist) * force * 1.2;
          p.vy -= (dy / dist) * force * 1.2;
        }

        p.vx += (p.baseX - p.x) * RETURN_SPEED;
        p.vy += (p.baseY - p.y) * RETURN_SPEED;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.x += p.vx;
        p.y += p.vy;
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const midX = (particles[i].x + particles[j].x) / 2;
            const fade = edgeFactor(midX);
            const distFade = 1 - dist / CONNECTION_DISTANCE;
            const opacity = distFade * fade * 0.15;

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,0,0,${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const p of particles) {
        const fade = edgeFactor(p.x);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${fade * 0.3})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    function handleMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    resize();
    initParticles();
    animate();

    const onResize = () => { resize(); initParticles(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

