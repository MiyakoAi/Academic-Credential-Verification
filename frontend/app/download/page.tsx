'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Icon } from '@iconify/react';
import { secureDownload } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

// ============================================================
//   INTERACTIVE PARTICLE MESH (shared visual with public page)
// ============================================================

interface Particle {
  x: number; y: number; baseX: number; baseY: number;
  vx: number; vy: number; size: number;
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

    function resize() { canvas!.width = window.innerWidth; canvas!.height = window.innerHeight; }

    function initParticles() {
      const w = canvas!.width; const h = canvas!.height;
      particlesRef.current = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x: number;
        const roll = Math.random();
        if (roll < 0.4) { x = Math.random() * w * 0.22; }
        else if (roll < 0.8) { x = w - Math.random() * w * 0.22; }
        else { x = w * 0.25 + Math.random() * w * 0.5; }
        const y = Math.random() * h;
        particlesRef.current.push({ x, y, baseX: x, baseY: y, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, size: Math.random() * 2 + 1.2 });
      }
    }

    function edgeFactor(px: number): number {
      const w = canvas!.width;
      const centerDist = Math.abs(px - w / 2) / (w / 2);
      return 0.08 + centerDist * 0.92;
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        const dx = mouse.x - p.x; const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.vx -= (dx / dist) * force * 1.2; p.vy -= (dy / dist) * force * 1.2;
        }
        p.vx += (p.baseX - p.x) * RETURN_SPEED; p.vy += (p.baseY - p.y) * RETURN_SPEED;
        p.vx *= 0.93; p.vy *= 0.93; p.x += p.vx; p.y += p.vy;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x; const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const midX = (particles[i].x + particles[j].x) / 2;
            const opacity = (1 - dist / CONNECTION_DISTANCE) * edgeFactor(midX) * 0.15;
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,0,0,${opacity})`; ctx.lineWidth = 0.6; ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const fade = edgeFactor(p.x);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${fade * 0.3})`; ctx.fill();
      }
      animRef.current = requestAnimationFrame(animate);
    }

    function handleMouse(e: MouseEvent) { mouseRef.current = { x: e.clientX, y: e.clientY }; }
    function handleMouseLeave() { mouseRef.current = { x: -9999, y: -9999 }; }

    resize(); initParticles(); animate();
    const onResize = () => { resize(); initParticles(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', handleMouse); window.removeEventListener('mouseleave', handleMouseLeave); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

// ============================================================
//   DOWNLOAD PAGE
// ============================================================

export default function DownloadPage() {
  const [documentId, setDocumentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentWallet, setStudentWallet] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [certificateName, setCertificateName] = useState('');

  // Mouse parallax (spring-based)
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

  const isFormValid = documentId.trim() && studentId.trim() && studentWallet.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');
    setDownloadUrl('');

    try {
      const response = await secureDownload(documentId.trim(), studentId.trim(), studentWallet.trim());
      if (response.success && response.data) {
        setDownloadUrl(response.data.documentUrl);
        setCertificateName(response.data.certificate.studentName);
      } else {
        setError(response.message || 'Kredensial tidak cocok dengan data blockchain.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memverifikasi. Pastikan server backend berjalan.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden relative flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #eef2f7 0%, #e8ecf3 30%, #f0ece6 60%, #edf0f5 100%)' }}
    >
      {/* ── Interactive Particle Mesh Network ── */}
      <NetworkMesh />

      {/* ── Logo UMI — blended watermark ── */}
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

      {/* ── Color orbs — vivid blobs for glass refraction ── */}
      <div className="absolute pointer-events-none" style={{ width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,160,255,0.22) 0%, transparent 60%)', top: '10%', left: '15%', filter: 'blur(90px)' }} />
      <div className="absolute pointer-events-none" style={{ width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,140,200,0.18) 0%, transparent 60%)', bottom: '5%', right: '10%', filter: 'blur(80px)' }} />
      <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(140,220,180,0.16) 0%, transparent 60%)', top: '50%', left: '55%', filter: 'blur(70px)' }} />

      {/* ── Main Content ── */}
      <div className="relative z-10 w-full max-w-lg px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {/* Title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--accent-glow)] flex items-center justify-center">
              <Icon icon="lucide:download" className="text-[var(--accent)] text-2xl" />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#1d1d1f' }}>Unduh Dokumen Asli</h1>
            <p className="text-sm max-w-sm mx-auto" style={{ color: '#86868b' }}>
              Masukkan kredensial Anda untuk mengunduh file ijazah dari penyimpanan terdesentralisasi.
            </p>
          </div>

          {/* Form */}
          <div className="liquid-glass-strong p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="download-doc-id" className="block text-sm font-medium mb-2" style={{ color: '#1d1d1f' }}>
                  <Icon icon="lucide:file-text" className="inline mr-2 text-[var(--accent)]" />
                  Nomor Ijazah
                </label>
                <input
                  id="download-doc-id" type="text" placeholder="misal: UMI-2022-13020220166"
                  value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="input-field"
                />
              </div>

              <div>
                <label htmlFor="download-nim" className="block text-sm font-medium mb-2" style={{ color: '#1d1d1f' }}>
                  <Icon icon="lucide:id-card" className="inline mr-2 text-[var(--accent)]" />
                  NIM (Nomor Induk Mahasiswa)
                </label>
                <input
                  id="download-nim" type="text" placeholder="misal: 13020220166"
                  value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input-field"
                />
              </div>

              <div>
                <label htmlFor="download-wallet" className="block text-sm font-medium mb-2" style={{ color: '#1d1d1f' }}>
                  <Icon icon="lucide:wallet" className="inline mr-2 text-[var(--accent)]" />
                  Alamat Wallet Mahasiswa
                </label>
                <input
                  id="download-wallet" type="text" placeholder="0x..."
                  value={studentWallet} onChange={(e) => setStudentWallet(e.target.value)} className="input-field font-mono text-sm"
                />
              </div>

              {/* Security Notice */}
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <Icon icon="lucide:info" className="text-[var(--accent)] text-lg mt-0.5 flex-shrink-0" />
                <p className="text-xs leading-relaxed" style={{ color: '#6e6e73' }}>
                  Ketiga data akan dicocokkan dengan Blockchain.
                  File hanya tersedia jika <strong style={{ color: '#1d1d1f' }}>ketiga kredensial cocok</strong>.
                </p>
              </div>

              <button
                id="download-submit" type="submit" disabled={!isFormValid || isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? (
                  <><Icon icon="lucide:loader-2" className="animate-spin text-lg" /> Memverifikasi kredensial...</>
                ) : (
                  <><Icon icon="lucide:shield-check" className="text-lg" /> Verifikasi & Unduh</>
                )}
              </button>
            </form>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-4 p-4 rounded-2xl bg-[var(--danger-bg)] border border-red-200 flex items-center gap-3"
                >
                  <Icon icon="lucide:alert-circle" className="text-[var(--danger)] text-xl flex-shrink-0" />
                  <p className="text-[var(--danger)] text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Download Result */}
            <AnimatePresence>
              {downloadUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="mt-4 p-6 rounded-2xl bg-[var(--success-bg)] border border-green-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Icon icon="lucide:badge-check" className="text-[var(--success)] text-2xl" />
                    <div>
                      <p className="text-[var(--success)] font-semibold text-sm">Kredensial Terverifikasi!</p>
                      <p className="text-xs" style={{ color: '#6e6e73' }}>Ijazah milik: {certificateName}</p>
                    </div>
                  </div>
                  <a
                    id="download-link" href={downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-primary w-full text-center"
                  >
                    <Icon icon="lucide:download" className="text-lg" />
                    Download Ijazah (PDF)
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Back to verify */}
          <div className="mt-6 text-center">
            <Link href="/" className="liquid-glass inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium cursor-pointer hover:scale-105 active:scale-95 transition-transform" style={{ color: '#6e6e73' }}>
              <Icon icon="lucide:arrow-left" className="text-base" />
              Kembali ke Verifikasi
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs" style={{ color: '#aeaeb2' }}>
          © {new Date().getFullYear()} Universitas Muslim Indonesia
        </p>
      </div>
    </div>
  );
}
