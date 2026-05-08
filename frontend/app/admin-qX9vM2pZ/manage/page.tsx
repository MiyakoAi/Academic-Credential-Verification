'use client';

import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

export default function ManagePage() {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1 flex items-center gap-3">
          <Icon icon="lucide:users" className="text-[#af52de]" />
          Manajemen Staf / Issuer
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Kelola dompet staf dan fakultas yang berwenang menerbitkan ijazah.
        </p>
      </div>

      {/* Coming Soon Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[50vh]"
      >
        <div className="glass-card p-16 max-w-lg w-full text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
              <Icon icon="lucide:code" className="text-[#af52de] text-5xl" />
            </div>
          </motion.div>

          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
            Fitur Ini Masih Dalam Tahap Development
          </h3>
          <p className="text-[var(--text-secondary)] text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            Fitur manajemen staf/issuer akan memungkinkan admin untuk menambahkan
            atau menghapus dompet MetaMask staf kampus yang berwenang menerbitkan ijazah
            melalui Smart Contract.
          </p>

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
            <div className="p-3 rounded-xl bg-black/[0.03] border border-[var(--surface-border)]">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="lucide:user-plus" className="text-[var(--success)] text-sm" />
                <span className="text-[var(--text-primary)] text-xs font-medium">Tambah Issuer</span>
              </div>
              <p className="text-[var(--text-muted)] text-[10px]">Daftarkan wallet staf baru</p>
            </div>
            <div className="p-3 rounded-xl bg-black/[0.03] border border-[var(--surface-border)]">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="lucide:user-remove" className="text-[var(--danger)] text-sm" />
                <span className="text-[var(--text-primary)] text-xs font-medium">Hapus Issuer</span>
              </div>
              <p className="text-[var(--text-muted)] text-[10px]">Cabut hak akses staf</p>
            </div>
            <div className="p-3 rounded-xl bg-black/[0.03] border border-[var(--surface-border)]">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="lucide:list" className="text-[var(--accent)] text-sm" />
                <span className="text-[var(--text-primary)] text-xs font-medium">Daftar Issuer</span>
              </div>
              <p className="text-[var(--text-muted)] text-[10px]">Lihat semua staf terdaftar</p>
            </div>
            <div className="p-3 rounded-xl bg-black/[0.03] border border-[var(--surface-border)]">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="lucide:arrow-left-right" className="text-[#ff9500] text-sm" />
                <span className="text-[var(--text-primary)] text-xs font-medium">Transfer Ownership</span>
              </div>
              <p className="text-[var(--text-muted)] text-[10px]">Pindahkan hak Super Admin</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] px-4 py-2 rounded-full">
            <Icon icon="lucide:clock" />
            Akan tersedia di versi berikutnya
          </div>
        </div>
      </motion.div>
    </div>
  );
}
