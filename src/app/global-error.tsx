'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary.
 *
 * `error.tsx` cannot catch failures in the root layout itself; `global-error.tsx`
 * replaces the entire document for those cases (font loading, CSS import,
 * provider crash). It must therefore render its own <html>/<body> and cannot
 * rely on any application CSS variable, so styles here are intentionally inline
 * and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[UI] Kesalahan fatal aplikasi:', error.message, error.digest || '');
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <main role="alert" style={{ maxWidth: '520px', width: '100%' }}>
          <p
            style={{
              display: 'inline-block',
              margin: '0 0 16px',
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#b91c1c',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Aplikasi gagal dimuat
          </p>

          <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>
            Halaman tidak dapat dibuka
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Terjadi kesalahan saat memuat aplikasi. Muat ulang halaman. Bila masalah
            berlanjut, hubungi tim ICT dan sertakan kode referensi di bawah.
          </p>

          {error.digest && (
            <p
              style={{
                margin: '0 0 20px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              Kode referensi: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0369a1',
              color: 'var(--text-title)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  );
}
