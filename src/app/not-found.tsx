import Link from 'next/link';

/**
 * 404 page.
 *
 * Server component (no client JS needed) so an unknown URL costs almost nothing.
 * The intent is to keep a lost user moving: offer the dashboard and explain that
 * deep links to tabs live under `/?tab=...` rather than as separate paths.
 */
export default function NotFound() {
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
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <p
          style={{
            display: 'inline-block',
            margin: '0 0 16px',
            padding: '6px 12px',
            borderRadius: '999px',
            backgroundColor: 'var(--bg-inner, #f1f5f9)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            color: 'var(--text-muted, #64748b)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Halaman tidak ditemukan
        </p>

        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>
          Alamat ini tidak tersedia
        </h1>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-secondary, #475569)',
          }}
        >
          Tautan mungkin sudah berubah atau salah ketik. Semua modul dashboard
          dibuka dari Beranda, bukan dari alamat terpisah.
        </p>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '10px 18px',
            borderRadius: '8px',
            backgroundColor: 'var(--blue-primary, #0369a1)',
            color: 'var(--text-title)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
