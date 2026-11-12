'use client';

import { Clock } from 'lucide-react';

/**
 * Floating countdown before an idle session is closed (`CODE-02`).
 *
 * The countdown is announced with `role="status"` so it does not interrupt a
 * screen-reader user mid-sentence, and the "Lanjutkan Sesi" button is a real
 * button rather than a clickable div — this banner is the only warning before
 * the user is signed out.
 */
export interface IdleWarningBannerProps {
  secondsRemaining: number;
  onExtend: () => void;
}

export default function IdleWarningBanner({ secondsRemaining, onExtend }: IdleWarningBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        backgroundColor: 'var(--bg-surface)',
        color: 'var(--text-main)',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '2px solid var(--status-alert-text)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        maxWidth: '440px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: 'var(--status-alert-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-alert-text)',
          flexShrink: 0,
        }}
      >
        <Clock size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
          Peringatan Sesi Tidak Aktif
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
          Sesi akan berakhir dalam{' '}
          <strong style={{ color: 'var(--status-alert-text)', fontSize: '12px' }}>
            {secondsRemaining} detik
          </strong>{' '}
          karena tidak ada aktivitas.
        </div>
      </div>

      <button
        type="button"
        onClick={onExtend}
        style={{
          padding: '7px 14px',
          backgroundColor: 'var(--accent-blue)',
          color: 'var(--text-on-accent)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Lanjutkan Sesi
      </button>
    </div>
  );
}
