'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  UserPlus,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import Alert from '@/components/ui/Alert';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  initialMode = 'login',
}: AuthModalProps) {
  const canRegisterUser =
    currentUser
      ? currentUser.role === 'super_admin' || currentUser.role === 'admin_regional'
      : process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION === 'true';
  const [mode, setMode] = useState<'login' | 'register'>(canRegisterUser ? initialMode : 'login');

  // Login form state
  const [loginNipp, setLoginNipp] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regNipp, setRegNipp] = useState('');
  const [regDivisi, setRegDivisi] = useState('');
  const [regDepartemen, setRegDepartemen] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('pic_cabang');
  const [regBranch, setRegBranch] = useState('R01');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // `A11Y-04`: keep Tab inside the dialog and restore focus to the trigger.
  useFocusTrap(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  const submitLogin = async (nippToUse?: string, passToUse?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetNipp = nippToUse || loginNipp;
    const targetPass = passToUse || loginPassword;

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nipp: targetNipp, password: targetPass }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'NIPP atau kata sandi yang Anda masukkan tidak sesuai.');
      } else {
        setSuccessMsg(`Autentikasi berhasil sebagai ${data.user.name}`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 600);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim() || !regNipp.trim() || !regDivisi.trim() || !regDepartemen.trim()) {
      setErrorMsg('Nama, NIPP, Divisi, dan Departemen wajib diisi.');
      return;
    }

    if (!regPassword) {
      setErrorMsg('Kata sandi wajib diisi.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          nipp: regNipp.trim(),
          divisi: regDivisi.trim(),
          departemen: regDepartemen.trim(),
          password: regPassword,
          role: regRole,
          branch_id: regBranch || 'R99',
          email: `${regNipp.trim()}@pelindo.co.id`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Pendaftaran gagal.');
      } else {
        setSuccessMsg(`Pendaftaran akun ${data.user.name} (NIPP: ${data.user.nipp}) telah disimpan ke Master Data.`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Masuk ke Pelindo R4 PortDash' : 'Daftar Akun Baru PIC / Pengguna'}
        ref={dialogRef}
        tabIndex={-1}
        style={{ maxWidth: '540px', width: '100%', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue-text)',
              }}
            >
              {mode === 'login' ? <Lock size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px' }}>
                {mode === 'login' ? 'Masuk ke Pelindo R4 PortDash' : 'Daftar Akun Baru PIC / Pengguna'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {mode === 'login'
                  ? 'Gunakan NIPP sebagai nama pengguna Anda'
                  : 'Akun baru dapat langsung dipakai setelah formulir ini disimpan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup dialog autentikasi"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher: Masuk vs Daftar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-inner)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            style={{
              flex: 1,
              padding: '11px 16px',
              border: 'none',
              background: mode === 'login' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'login' ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: mode === 'login' ? 700 : 500,
              fontSize: '12px',
              borderBottom: mode === 'login' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Lock size={14} />
            <span>Masuk (Login)</span>
          </button>
          {canRegisterUser && (
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              style={{
                flex: 1,
                padding: '11px 16px',
                border: 'none',
                background: mode === 'register' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'register' ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: mode === 'register' ? 700 : 500,
                fontSize: '12px',
                borderBottom: mode === 'register' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={14} />
              <span>Daftar Akun Baru</span>
            </button>
          )}
        </div>

        {/* Body Modal */}
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
          {/* Notifications */}
          {errorMsg && (
            <Alert tone="error" style={{ marginBottom: '16px' }}>
              {errorMsg}
            </Alert>
          )}

          {successMsg && (
            <Alert tone="success" style={{ marginBottom: '16px' }}>
              {successMsg}
            </Alert>
          )}

          {/* TAB 1: FORM LOGIN */}
          {mode === 'login' ? (
            <form
              // See `LoginScreen`: a native submit before hydration defaults to
              // GET, which would put the password in the URL and the access log.
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                submitLogin();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="modal-login-nipp" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>NIPP (Nomor Induk Pegawai Pelindo)</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>Sebagai Username</span>
                </label>
                <input
                  id="modal-login-nipp"
                  type="text"
                  className="form-input"
                  placeholder="Contoh: 10001, 10002, 10003..."
                  value={loginNipp}
                  onChange={(e) => setLoginNipp(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-login-password">Kata Sandi</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="modal-login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Masukkan kata sandi..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showLoginPassword}
                    className="icon-button-touch"
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showLoginPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <Clock size={15} strokeWidth={1.75} aria-hidden="true" /> : <Lock size={15} strokeWidth={1.75} aria-hidden="true" />}
                <span>{loading ? 'Memverifikasi...' : 'Masuk'}</span>
              </button>

              {canRegisterUser && (
                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Belum memiliki akun PIC? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-blue-text)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Daftar Akun Baru
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* TAB 2: FORM DAFTAR AKUN BARU */
            <form method="post" onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Info Sinkronisasi My Drive */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--accent-blue-text)',
                }}
              >
                <FileSpreadsheet size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span>
                  Data akun tersimpan otomatis dan langsung aktif untuk masuk.
                </span>
              </div>

              {/* Input Nama & NIPP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-name">Nama Lengkap Pegawai *</label>
                  <input
                    id="modal-reg-name"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Bambang Sudiro, S.T."
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-nipp">NIPP (Username) *</label>
                  <input
                    id="modal-reg-nipp"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: 10025"
                    value={regNipp}
                    onChange={(e) => setRegNipp(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Input Divisi & Departemen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-divisi">Divisi *</label>
                  <input
                    id="modal-reg-divisi"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Divisi Operasi Pelabuhan"
                    value={regDivisi}
                    onChange={(e) => setRegDivisi(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-dept">Departemen / Unit *</label>
                  <input
                    id="modal-reg-dept"
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Dept Pelayanan Kapal"
                    value={regDepartemen}
                    onChange={(e) => setRegDepartemen(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Role & Cabang */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-role">Hak Akses / Role *</label>
                  <select
                    id="modal-reg-role"
                    className="form-select"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                  >
                    {/* Only roles the actor may actually grant. `admin_regional`
                        used to be offered `super_admin` here, so the form let them
                        submit a request the server always rejected with 403. */}
                    <option value="pic_cabang">PIC Cabang (Terminal)</option>
                    <option value="pic_dept_regional">PIC Dept Regional 4</option>
                    <option value="admin_regional">Admin Regional 4</option>
                    {currentUser?.role === 'super_admin' && (
                      <option value="super_admin">Super Admin</option>
                    )}
                    <option value="viewer">BOD Regional 4 (Viewer)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-branch">Penugasan Cabang *</label>
                  <select
                    id="modal-reg-branch"
                    className="form-select"
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="R99">R99 - Regional 4 (Pusat / Seluruh Wilayah)</option>
                    {OFFICIAL_BRANCHES.map((b) => (
                      <option key={b.code} value={b.code}>
                        [{b.code}] {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password & Konfirmasi Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-password">Kata Sandi *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Minimal 6 karakter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-reg-password-confirm">Konfirmasi Kata Sandi *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="modal-reg-password-confirm"
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Ulangi kata sandi"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="showPassReg"
                  checked={showRegPassword}
                  onChange={(e) => setShowRegPassword(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="showPassReg" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Tampilkan Kata Sandi
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <Clock size={15} strokeWidth={1.75} aria-hidden="true" /> : <UserPlus size={15} strokeWidth={1.75} aria-hidden="true" />}
                <span>{loading ? 'Menyimpan Data Akun...' : 'Daftar Akun Baru'}</span>
              </button>

              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sudah punya akun PIC? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-blue-text)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Masuk Sekarang
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
