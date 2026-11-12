'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, X } from 'lucide-react';
import { checkPasswordStrength, PASSWORD_HINT } from '@/lib/passwordPolicy';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface PasswordChangeModalProps {
  isOpen: boolean;
  /** When true the user cannot dismiss the dialog: a new password is mandatory. */
  required?: boolean;
  userName?: string;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onSignedOut?: () => void;
}

/**
 * Self-service password change. Used in two situations:
 * - Forced: the account still holds an administratively assigned password.
 * - Voluntary: the user opens it from the account menu.
 */
export default function PasswordChangeModal({
  isOpen,
  required = false,
  userName,
  onClose,
  onSuccess,
  onSignedOut,
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // `A11Y-04`: contain Tab inside the dialog and restore focus on close, so a
  // keyboard user cannot tab onto the page behind an open modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !required) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, required, onClose]);

  useFocusTrap(dialogRef, isOpen, required ? undefined : onClose);

  if (!isOpen) return null;

  const strength = checkPasswordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    !submitting &&
    currentPassword.length > 0 &&
    strength.valid &&
    confirmPassword === newPassword &&
    newPassword !== currentPassword;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!strength.valid) {
      setError(strength.error || PASSWORD_HINT);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        if (res.status === 401) {
          setError(
            'Sesi tidak valid atau kata sandi saat ini salah. Silakan masuk kembali bila masalah berlanjut.'
          );
          onSignedOut?.();
        } else {
          setError(data?.error || 'Kata sandi gagal diperbarui.');
        }
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      const message = data?.message || 'Kata sandi berhasil diperbarui.';
      setSuccess(message);
      onSuccess?.(message);
      if (!required) {
        window.setTimeout(onClose, 900);
      }
    } catch {
      setError('Tidak dapat menghubungi server. Periksa koneksi Anda lalu coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1200 }}
      onClick={() => {
        if (!required) onClose();
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-title"
        aria-describedby="password-change-desc"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: required ? 'rgba(217, 119, 6, 0.16)' : 'rgba(2, 132, 199, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: required ? 'var(--status-alert-text)' : 'var(--accent-blue)',
                flexShrink: 0,
              }}
            >
              {required ? <ShieldAlert size={17} /> : <KeyRound size={17} />}
            </div>
            <div>
              <h3 id="password-change-title" className="modal-title" style={{ margin: 0 }}>
                {required ? 'Ganti kata sandi sementara' : 'Ubah kata sandi'}
              </h3>
              <p
                id="password-change-desc"
                style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}
              >
                {required
                  ? 'Akun ini masih memakai kata sandi yang diberikan administrator.'
                  : userName
                    ? `Perbarui kata sandi untuk ${userName}.`
                    : 'Perbarui kata sandi akun Anda.'}
              </p>
            </div>
          </div>

          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog ubah kata sandi"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '6px',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form method="post" onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {required && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--status-alert-border)',
                  backgroundColor: 'var(--status-alert-bg)',
                  color: 'var(--status-alert-text)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                Anda tidak dapat melanjutkan sebelum kata sandi diganti.
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="current-password">
                Kata sandi saat ini
              </label>
              <input
                id="current-password"
                ref={firstInputRef}
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                Kata sandi baru
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  style={{ paddingRight: '40px' }}
                  aria-describedby="password-hint"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p
                id="password-hint"
                style={{
                  margin: '5px 0 0',
                  fontSize: '12px',
                  color: newPassword && !strength.valid ? 'var(--status-alert-text)' : 'var(--text-muted)',
                }}
              >
                {newPassword && !strength.valid ? strength.error : PASSWORD_HINT}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Ulangi kata sandi baru
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                aria-invalid={mismatch}
              />
              {mismatch && (
                <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--status-danger-text)' }}>
                  Konfirmasi belum cocok.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--status-danger-border)',
                  backgroundColor: 'var(--status-danger-bg)',
                  color: 'var(--status-danger-text)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--status-good-border)',
                  backgroundColor: 'var(--status-good-bg)',
                  color: 'var(--status-good-text)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{success}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {!required && (
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Batal
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  <span>Menyimpan…</span>
                </>
              ) : (
                <span>Simpan kata sandi baru</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
