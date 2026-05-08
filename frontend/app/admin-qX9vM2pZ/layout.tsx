'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  connectWallet,
  getCurrentAccount,
  hasAdminAccess,
  getBalance,
  onAccountChange,
} from '@/lib/web3';

// ============================================================
//                   ADMIN CONTEXT (Global State)
// ============================================================

interface AdminContextType {
  walletAddress: string | null;
  balance: string;
  isAdmin: boolean;
  // Data to pass between Menu 2 → Menu 3 (Auto-Fill)
  stampedData: {
    documentId: string;
    pdfFile: File | null;
  } | null;
  setStampedData: (data: { documentId: string; pdfFile: File | null } | null) => void;
}

const AdminContext = createContext<AdminContextType>({
  walletAddress: null,
  balance: '0',
  isAdmin: false,
  stampedData: null,
  setStampedData: () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

// ============================================================
//                   ADMIN PATH CONFIG
// ============================================================

const ADMIN_PATH = process.env.NEXT_PUBLIC_ADMIN_PATH || 'admin-qX9vM2pZ';

// ============================================================
//                   SIDEBAR NAVIGATION
// ============================================================

const sidebarLinks = [
  { href: `/${ADMIN_PATH}`, icon: 'lucide:layout-dashboard', label: 'Dashboard', exact: true },
  { href: `/${ADMIN_PATH}/stamper`, icon: 'lucide:qr-code', label: 'QR Stamper' },
  { href: `/${ADMIN_PATH}/register`, icon: 'lucide:file-plus', label: 'Registrasi' },
  { href: `/${ADMIN_PATH}/revoke`, icon: 'lucide:flame', label: 'Pencabutan' },
  { href: `/${ADMIN_PATH}/manage`, icon: 'lucide:users', label: 'Manajemen Staf' },
];

// ============================================================
//                   ADMIN LAYOUT COMPONENT
// ============================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stampedData, setStampedData] = useState<{ documentId: string; pdfFile: File | null } | null>(null);

  // Check existing connection on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const account = await getCurrentAccount();
        if (account) {
          await verifyAccess(account);
        }
      } catch {
        // Silent fail
      } finally {
        setIsChecking(false);
      }
    }
    checkExisting();
  }, []);

  // Listen for account changes
  useEffect(() => {
    const unsubscribe = onAccountChange(async (accounts) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setIsAdmin(false);
      } else {
        await verifyAccess(accounts[0]);
      }
    });
    return unsubscribe;
  }, []);

  const verifyAccess = useCallback(async (address: string) => {
    setWalletAddress(address);
    const [admin, bal] = await Promise.all([
      hasAdminAccess(address),
      getBalance(address),
    ]);
    setIsAdmin(admin);
    setBalance(bal);
    if (!admin) {
      setError('Akses ditolak: Wallet Anda bukan Owner atau Issuer terdaftar.');
    } else {
      setError('');
    }
  }, []);

  async function handleConnect() {
    setIsConnecting(true);
    setError('');
    try {
      const address = await connectWallet();
      await verifyAccess(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal terhubung ke MetaMask.');
    } finally {
      setIsConnecting(false);
    }
  }

  // ====== LOADING STATE ======
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f2f2f7' }}>
        <Icon icon="lucide:loader-2" className="text-[var(--accent)] text-4xl animate-spin" />
      </div>
    );
  }

  // ====== NOT CONNECTED / NOT ADMIN ======
  if (!walletAddress || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f2f2f7' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--accent-glow)] flex items-center justify-center">
            <Icon icon="lucide:shield" className="text-[var(--accent)] text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Admin Dashboard</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-8">
            Hubungkan dompet MetaMask Anda untuk mengakses panel administrasi.
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--danger-bg)] border border-red-200 text-left">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:alert-circle" className="text-[var(--danger)] flex-shrink-0" />
                <p className="text-[var(--danger)] text-sm">{error}</p>
              </div>
            </div>
          )}

          <button
            id="connect-wallet-button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn-primary w-full py-4 text-base"
          >
            {isConnecting ? (
              <>
                <Icon icon="lucide:loader-2" className="text-xl animate-spin" />
                Menghubungkan...
              </>
            ) : (
              <>
                <Icon icon="lucide:wallet" className="text-xl" />
                Connect MetaMask
              </>
            )}
          </button>

          {walletAddress && !isAdmin && (
            <p className="mt-4 text-xs text-[var(--text-muted)] font-mono">
              Terhubung: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ====== ADMIN DASHBOARD LAYOUT (Apple Settings Style) ======
  return (
    <AdminContext.Provider value={{ walletAddress, balance, isAdmin, stampedData, setStampedData }}>
      <div className="min-h-screen flex" style={{ background: '#f2f2f7' }}>
        {/* ====== SIDEBAR ====== */}
        <aside
          className={`${
            sidebarOpen ? 'w-60' : 'w-[72px]'
          } bg-white/80 backdrop-blur-xl border-r border-[var(--surface-border)] flex flex-col transition-all duration-300 fixed h-full z-30`}
        >
          {/* Logo */}
          <div className="p-4 border-b border-[var(--surface-border)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Icon icon="lucide:shield-check" className="text-white text-lg" />
            </div>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-sm font-semibold text-[var(--text-primary)]">AcademicSBT</h1>
                <p className="text-[10px] text-[var(--text-muted)]">Admin Panel</p>
              </motion.div>
            )}
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-3 space-y-0.5">
            {sidebarLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  title={link.label}
                >
                  <Icon icon={link.icon} className="text-lg flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm">{link.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Collapse Toggle */}
          <div className="p-3 border-t border-[var(--surface-border)]">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition rounded-lg hover:bg-black/[0.03]"
            >
              <Icon
                icon={sidebarOpen ? 'lucide:panel-left-close' : 'lucide:panel-left-open'}
                className="text-lg"
              />
            </button>
          </div>
        </aside>

        {/* ====== MAIN CONTENT ====== */}
        <div className={`flex-1 ${sidebarOpen ? 'ml-60' : 'ml-[72px]'} transition-all duration-300`}>
          {/* Top Bar */}
          <header className="sticky top-0 z-20 bg-white/60 backdrop-blur-2xl border-b border-[var(--surface-border)] px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Icon icon="lucide:layout-dashboard" className="text-[var(--accent)]" />
                <span className="font-medium">Admin Dashboard</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Balance */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] text-xs">
                  <Icon icon="lucide:diamond" className="text-[var(--accent)]" />
                  <span className="text-[var(--text-primary)] font-mono font-medium">{balance} ETH</span>
                </div>
                {/* Wallet */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--success-bg)] text-xs">
                  <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                  <span className="text-[var(--text-primary)] font-mono font-medium">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
