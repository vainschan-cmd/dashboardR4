'use client';

import React from 'react';
import { Loader2, AlertTriangle, Inbox, Lock, RefreshCw } from 'lucide-react';

export type ModuleState = 'loading' | 'empty' | 'error' | 'no-access' | 'success';

export interface ModuleStateViewProps {
  state: ModuleState;
  title?: string;
  message?: string;
  onRetry?: () => void;
  actionText?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export default function ModuleStateView({
  state,
  title,
  message,
  onRetry,
  actionText,
  onAction,
  children,
}: ModuleStateViewProps) {
  if (state === 'success') {
    return <>{children}</>;
  }

  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '48px 16px',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        <Loader2 size={28} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-blue-text)' }} />
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{title || 'Memuat data modul…'}</span>
        {message && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{message}</span>}
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '48px 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <Inbox size={28} aria-hidden="true" />
        </div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
          {title || 'Tidak ada data'}
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '360px' }}>
          {message || 'Data tidak ditemukan untuk periode atau filter yang dipilih. Silakan sesuaikan kriteria pencarian.'}
        </p>
        {(onAction || onRetry) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAction || onRetry}
            style={{ marginTop: '8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>{actionText || 'Muat Ulang'}</span>
          </button>
        )}
      </div>
    );
  }

  if (state === 'no-access') {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '48px 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            border: '1px solid var(--status-danger-border)',
          }}
        >
          <Lock size={28} aria-hidden="true" />
        </div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-danger-text)', margin: 0 }}>
          {title || 'Akses Terbatas'}
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, maxWidth: '400px' }}>
          {message || 'Anda tidak memiliki hak akses untuk melihat data modul ini. Hubungi Administrator untuk mengajukan otorisasi.'}
        </p>
      </div>
    );
  }

  // State === 'error'
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '48px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          padding: '12px',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--status-alert-bg)',
          color: 'var(--status-alert-text)',
          border: '1px solid var(--status-alert-border)',
        }}
      >
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-alert-text)', margin: 0 }}>
        {title || 'Gagal Memuat Data'}
      </h4>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, maxWidth: '400px' }}>
        {message || 'Terjadi gangguan saat mengambil data dari server. Silakan coba kembali.'}
      </p>
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRetry}
          style={{ marginTop: '8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} />
          <span>Coba Lagi</span>
        </button>
      )}
    </div>
  );
}

