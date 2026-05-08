'use client';

/**
 * /verify route — Entry point for QR Code scans.
 *
 * QR Code URLs point to: /verify?data=<AES-256-CBC encrypted documentId>
 * This page re-exports the main VerificationPage component from the root page.
 * The component's useEffect automatically reads ?data= or ?id= from the URL
 * and triggers verification.
 */
export { default } from '../page';
