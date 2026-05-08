'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { PDFDocument } from 'pdf-lib';
import { getQRCode } from '@/lib/api';
import { useAdmin } from '../layout';

export default function StamperPage() {
  const { setStampedData } = useAdmin();
  const [documentId, setDocumentId] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // QR Position & Size
  const [qrX, setQrX] = useState(50);
  const [qrY, setQrY] = useState(50);
  const [qrSize, setQrSize] = useState(100);

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 595, height: 842 });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStamping, setIsStamping] = useState(false);
  const [stampedPdfUrl, setStampedPdfUrl] = useState<string | null>(null);
  const [stampedPdfBytes, setStampedPdfBytes] = useState<Uint8Array | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

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
    if (file?.type === 'application/pdf') {
      setPdfFile(file);
      generatePdfPreview(file);
    }
  }, []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      generatePdfPreview(file);
    }
  }, []);

  // ============================================================
  //                  PDF PREVIEW GENERATION
  // ============================================================

  async function generatePdfPreview(file: File) {
    const bytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    const page = pdfDoc.getPage(0);
    setPdfDimensions({ width: page.getWidth(), height: page.getHeight() });

    // Create a canvas preview using an object URL
    const blob = new Blob([bytes], { type: 'application/pdf' });
    setPreviewUrl(URL.createObjectURL(blob));
  }

  // ============================================================
  //                  QR CODE GENERATION
  // ============================================================

  async function handleGenerateQR() {
    if (!documentId.trim()) return;
    setIsGenerating(true);
    setQrDataUrl(null);

    try {
      const dataUrl = await getQRCode(documentId.trim());
      setQrDataUrl(dataUrl);
    } catch {
      alert('Gagal menghasilkan QR Code. Pastikan backend server berjalan.');
    } finally {
      setIsGenerating(false);
    }
  }

  // ============================================================
  //              QR DRAG HANDLER (on Preview)
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    const container = previewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left - qrX,
      y: e.clientY - rect.top - qrY,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !container) return;
      const containerRect = container.getBoundingClientRect();
      let newX = ev.clientX - containerRect.left - offsetRef.current.x;
      let newY = ev.clientY - containerRect.top - offsetRef.current.y;

      // Clamp to container bounds
      newX = Math.max(0, Math.min(newX, containerRect.width - qrSize));
      newY = Math.max(0, Math.min(newY, containerRect.height - qrSize));

      setQrX(newX);
      setQrY(newY);
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [qrX, qrY, qrSize]);

  // ============================================================
  //                  STAMP PDF & DOWNLOAD
  // ============================================================

  async function handleStamp() {
    if (!pdfFile || !qrDataUrl) return;
    setIsStamping(true);

    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const page = pdfDoc.getPage(0);

      // Convert data URL to image
      const qrImageBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
      const qrImage = await pdfDoc.embedPng(new Uint8Array(qrImageBytes));

      // Calculate position relative to PDF coordinates
      const container = previewContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scaleX = pdfDimensions.width / containerRect.width;
      const scaleY = pdfDimensions.height / containerRect.height;

      // PDF coordinates: origin at bottom-left
      const pdfX = qrX * scaleX;
      const pdfY = pdfDimensions.height - (qrY * scaleY) - (qrSize * scaleY);
      const pdfQrSize = qrSize * scaleX;

      page.drawImage(qrImage, {
        x: pdfX,
        y: pdfY,
        width: pdfQrSize,
        height: pdfQrSize,
      });

      const resultBytes = await pdfDoc.save();
      setStampedPdfBytes(resultBytes);
      const blob = new Blob([new Uint8Array(resultBytes) as BlobPart], { type: 'application/pdf' });
      setStampedPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      alert('Gagal melakukan stamping: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsStamping(false);
    }
  }

  function handleDownloadStamped() {
    if (!stampedPdfUrl) return;
    const a = document.createElement('a');
    a.href = stampedPdfUrl;
    a.download = `${documentId || 'ijazah'}_stamped.pdf`;
    a.click();
  }

  function handleProceedToRegister() {
    if (!stampedPdfBytes || !documentId) return;
    const file = new File([new Uint8Array(stampedPdfBytes) as BlobPart], `${documentId}_stamped.pdf`, { type: 'application/pdf' });
    setStampedData({ documentId, pdfFile: file });
    window.location.href = `/${process.env.NEXT_PUBLIC_ADMIN_PATH || 'admin-qX9vM2pZ'}/register`;
  }

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (stampedPdfUrl) URL.revokeObjectURL(stampedPdfUrl);
    };
  }, [previewUrl, stampedPdfUrl]);

  // ============================================================
  //                        RENDER
  // ============================================================

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1 flex items-center gap-3">
          <Icon icon="lucide:qr-code" className="text-[var(--success)]" />
          Auto-Stamper QR Code
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Upload PDF ijazah kosong, generate QR Code, lalu tempelkan secara otomatis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ====== LEFT: Controls ====== */}
        <div className="space-y-4">
          {/* Document ID */}
          <div className="glass-card p-6">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              <Icon icon="lucide:file-text" className="inline mr-2 text-[var(--success)]" />
              Nomor Ijazah
            </label>
            <div className="flex gap-2">
              <input
                id="stamper-doc-id"
                type="text"
                placeholder="misal: UMI-2022-13020220166"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="input-field flex-1"
              />
              <button
                id="generate-qr-button"
                onClick={handleGenerateQR}
                disabled={!documentId.trim() || isGenerating}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                {isGenerating ? (
                  <Icon icon="lucide:loader-2" className="animate-spin" />
                ) : (
                  <Icon icon="lucide:qr-code" />
                )}
                Generate
              </button>
            </div>
          </div>

          {/* Upload PDF */}
          <div className="glass-card p-6">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              <Icon icon="lucide:file-check" className="inline mr-2 text-[var(--danger)]" />
              File PDF Ijazah (Belum Ada QR)
            </label>
            <div
              className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => document.getElementById('stamper-file-input')?.click()}
            >
              <input
                id="stamper-file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={onFileSelect}
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
                </div>
              ) : (
                <>
                  <Icon icon="lucide:upload-cloud" className="text-3xl text-[var(--text-muted)] mb-2" />
                  <p className="text-[var(--text-secondary)] text-sm">Drag & Drop PDF atau klik untuk memilih</p>
                </>
              )}
            </div>
          </div>

          {/* QR Position Controls */}
          {qrDataUrl && pdfFile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 space-y-4"
            >
              <h3 className="text-[var(--text-primary)] text-sm font-semibold flex items-center gap-2">
                <Icon icon="lucide:sliders-horizontal" className="text-[var(--success)]" />
                Atur Posisi & Ukuran QR
              </h3>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Posisi X: {Math.round(qrX)}px</label>
                <input
                  type="range"
                  min={0}
                  max={400}
                  value={qrX}
                  onChange={(e) => setQrX(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Posisi Y: {Math.round(qrY)}px</label>
                <input
                  type="range"
                  min={0}
                  max={600}
                  value={qrY}
                  onChange={(e) => setQrY(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Ukuran: {qrSize}px</label>
                <input
                  type="range"
                  min={40}
                  max={200}
                  value={qrSize}
                  onChange={(e) => setQrSize(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  id="stamp-button"
                  onClick={handleStamp}
                  disabled={isStamping}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isStamping ? (
                    <>
                      <Icon icon="lucide:loader-2" className="animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide:stamp" />
                      Stamp QR ke PDF
                    </>
                  )}
                </button>
              </div>

              {/* Download stamped PDF */}
              {stampedPdfUrl && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 pt-2"
                >
                  <button
                    id="download-stamped"
                    onClick={handleDownloadStamped}
                    className="btn-outline flex-1 flex items-center justify-center gap-2"
                  >
                    <Icon icon="lucide:download" />
                    Download PDF
                  </button>
                  <button
                    id="proceed-register"
                    onClick={handleProceedToRegister}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <Icon icon="lucide:arrow-right" />
                    Lanjut Registrasi
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* ====== RIGHT: Preview Area ====== */}
        <div className="glass-card p-6">
          <h3 className="text-[var(--text-primary)] text-sm font-semibold mb-4 flex items-center gap-2">
            <Icon icon="lucide:eye" className="text-[var(--accent)]" />
            Preview Dokumen
          </h3>

          {previewUrl && pdfFile ? (
            <div
              ref={previewContainerRef}
              className="relative bg-white rounded-lg overflow-hidden"
              style={{ aspectRatio: `${pdfDimensions.width} / ${pdfDimensions.height}` }}
            >
              {/* PDF Preview (using iframe) */}
              <iframe
                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-0"
                title="PDF Preview"
              />

              {/* QR Overlay (Draggable) */}
              {qrDataUrl && (
                <div
                  className="absolute cursor-move border-2 border-dashed border-emerald-400/70 rounded-lg bg-white shadow-lg"
                  style={{
                    left: qrX,
                    top: qrY,
                    width: qrSize,
                    height: qrSize,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-full h-full object-contain p-1"
                    draggable={false}
                  />
                  <div className="absolute -top-6 left-0 text-[10px] text-[var(--success)] whitespace-nowrap bg-black/70 px-2 py-0.5 rounded">
                    Klik & geser untuk memindahkan
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-[var(--text-muted)]">
              <Icon icon="lucide:image" className="text-5xl mb-3" />
              <p className="text-sm">Upload PDF dan generate QR untuk melihat preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
