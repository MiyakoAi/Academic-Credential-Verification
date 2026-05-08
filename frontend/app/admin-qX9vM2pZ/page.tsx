'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { getBlockchainStats } from '@/lib/api';
import { useAdmin } from './layout';

export default function AdminDashboard() {
  const { walletAddress } = useAdmin();
  const [stats, setStats] = useState({
    totalCertificates: 0,
    contractAddress: '',
    networkUrl: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getBlockchainStats();
        setStats(data);
      } catch {
        // Backend might not be running
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const statCards = [
    {
      icon: 'lucide:scroll-text',
      label: 'Total Ijazah Terdaftar',
      value: stats.totalCertificates.toString(),
      accent: 'var(--success)',
      bg: 'var(--success-bg)',
    },
    {
      icon: 'lucide:file-code',
      label: 'Smart Contract',
      value: stats.contractAddress
        ? `${stats.contractAddress.slice(0, 8)}...${stats.contractAddress.slice(-6)}`
        : '—',
      accent: 'var(--accent)',
      bg: 'var(--accent-glow)',
    },
    {
      icon: 'lucide:network',
      label: 'Jaringan Blockchain',
      value: stats.networkUrl || 'Localhost',
      accent: '#af52de',
      bg: 'rgba(175,82,222,0.08)',
    },
    {
      icon: 'lucide:wallet',
      label: 'Wallet Admin',
      value: walletAddress
        ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
        : '—',
      accent: '#ff9500',
      bg: 'rgba(255,149,0,0.08)',
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Beranda Dashboard</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Ringkasan dan statistik sistem verifikasi ijazah.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="glass-card p-5"
          >
            {isLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-6 w-16" />
              </div>
            ) : (
              <>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: card.bg }}
                >
                  <Icon icon={card.icon} className="text-xl" style={{ color: card.accent }} />
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{card.label}</p>
                <p className="text-base font-semibold text-[var(--text-primary)] font-mono">{card.value}</p>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-5">
        <h3 className="text-[var(--text-primary)] font-semibold mb-4 flex items-center gap-2">
          <Icon icon="lucide:zap" className="text-[#ff9500]" />
          Aksi Cepat
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickAction
            href={`/${process.env.NEXT_PUBLIC_ADMIN_PATH || 'admin-qX9vM2pZ'}/stamper`}
            icon="lucide:qr-code"
            title="QR Stamper"
            description="Tempel QR Code ke file PDF Ijazah"
            accent="var(--success)"
            bg="var(--success-bg)"
          />
          <QuickAction
            href={`/${process.env.NEXT_PUBLIC_ADMIN_PATH || 'admin-qX9vM2pZ'}/register`}
            icon="lucide:file-plus"
            title="Registrasi Ijazah"
            description="Daftarkan ijazah baru ke Blockchain"
            accent="var(--accent)"
            bg="var(--accent-glow)"
          />
          <QuickAction
            href={`/${process.env.NEXT_PUBLIC_ADMIN_PATH || 'admin-qX9vM2pZ'}/revoke`}
            icon="lucide:flame"
            title="Pencabutan"
            description="Cabut dan bakar ijazah yang bermasalah"
            accent="var(--danger)"
            bg="var(--danger-bg)"
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
  accent,
  bg,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  accent: string;
  bg: string;
}) {
  return (
    <a
      href={href}
      className="group p-4 rounded-xl border border-[var(--surface-border)] hover:border-[var(--surface-border-strong)] hover:bg-[var(--surface-secondary)] transition-all flex items-start gap-4"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition"
        style={{ background: bg }}
      >
        <Icon icon={icon} className="text-xl" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[var(--text-primary)] text-sm font-semibold group-hover:text-[var(--accent)] transition">{title}</p>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">{description}</p>
      </div>
    </a>
  );
}
