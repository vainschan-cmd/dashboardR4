'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Route-level error boundary.
 *
 * Without this file a render error in any component unmounts the whole React
 * tree and the user sees a blank page. Here the shell stays intact and the user
 * gets a recoverable action plus a correlation id they can quote to ICT without
 * sharing a token or any personal data.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged once per mount; the digest is the only server-side handle we have.
    console.error('[UI] Kesalahan render halaman:', error.message, error.digest || '');
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-surface, #f8fafc)',
        color: 'var(--text-main, #0f172a)',
      }}
    >
      <div style={{ maxWidth: '520px', width: '100%', textAlign: 'left' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '999px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--status-danger-text, #b91c1c)',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          <AlertTriangle size={14} />
          <span>Halaman gagal ditampilkan</span>
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>
          Data Anda tidak hilang
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary, #475569)' }}>
          Terjadi kesalahan saat menampilkan halaman ini. Coba muat ulang. Bila tetap
          gagal, sampaikan kode referensi di bawah kepada tim ICT agar penelusuran
          lebih cepat.
        </p>

        {error.digest && (
          <p
            style={{
              margin: '0 0 20px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-inner, #f1f5f9)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              fontFamily: 'var(--font-jetbrains, monospace)',
              fontSize: '12px',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            Kode referensi: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--blue-primary, #0369a1)',
              color: 'var(--text-title)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            Muat ulang halaman
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              color: 'var(--text-main, #0f172a)',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
