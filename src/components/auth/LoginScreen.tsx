'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  UserCheck,
  UserPlus,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowRight,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import { User } from '@/lib/types';
import { checkPasswordStrength, PASSWORD_HINT } from '@/lib/passwordPolicy';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import Alert from '@/components/ui/Alert';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  sessionExpiredMessage?: string | null;
}

export default function LoginScreen({
  onLoginSuccess,
  theme,
  onThemeChange,
  sessionExpiredMessage,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form states - Login
  const [loginNipp, setLoginNipp] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states - Register
  const [regName, setRegName] = useState('');
  const [regNipp, setRegNipp] = useState('');
  const [regDivisi, setRegDivisi] = useState('');
  const [regDepartemen, setRegDepartemen] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regBranch, setRegBranch] = useState('R01');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Public self-registration is disabled unless explicitly enabled at build time.
  const allowPublicRegistration = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION === 'true';

  const submitLogin = async (nippToUse?: string, passToUse?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetNipp = (nippToUse || loginNipp).trim();
    const targetPass = passToUse || loginPassword;

    if (!targetNipp) {
      setErrorMsg('Harap masukkan NIPP / Username Anda.');
      setLoading(false);
      return;
    }

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
        setSuccessMsg(`Autentikasi berhasil. Selamat bertugas, ${data.user.name}.`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 500);
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

    if (!regNipp.trim() || !regName.trim() || !regDivisi.trim() || !regDepartemen.trim()) {
      setErrorMsg('Semua field bertanda (*) wajib diisi.');
      return;
    }

    const strength = checkPasswordStrength(regPassword);
    if (!strength.valid) {
      setErrorMsg(strength.error || PASSWORD_HINT);
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
          nipp: regNipp.trim(),
          name: regName.trim(),
          divisi: regDivisi.trim(),
          departemen: regDepartemen.trim(),
          password: regPassword,
          role: 'pic_cabang',
          branch_id: regBranch || 'R01',
          email: `${regNipp.trim()}@pelindo.co.id`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Gagal mendaftarkan akun baru.');
      } else {
        setSuccessMsg(`Pendaftaran akun NIPP ${regNipp} selesai. Mengalihkan ke beranda...`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 800);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Top Bar / Brand Header */}
      <header
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          backdropFilter: 'blur(12px)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.25)',
              flexShrink: 0,
            }}
          >
            <Image
              src="/pelindo-logo.png"
              alt="Logo Pelindo"
              width={44}
              height={44}
              loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-title)' }}>
                PELINDO REGIONAL 4
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(2, 132, 199, 0.15)',
                  color: 'var(--accent-cyan)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                }}
              >
                PortDash R4
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Portal Eksekutif & Manajemen Kinerja Pelabuhan Terintegrasi
            </div>
          </div>
        </div>

        {/* Theme Mode Toggle (Terang / Gelap) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="theme-toggle-group" role="group" aria-label="Pilihan Mode Tampilan">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              title="Mode Terang (Light Mode)"
            >
              <Sun size={13} />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              title="Mode Gelap (Dark Mode)"
            >
              <Moon size={13} />
              <span>Gelap</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Login / Register Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: mode === 'login' ? '480px' : '580px',
            transition: 'max-width 0.25s ease',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }}
        >
          {/* Card Tabs: Masuk / Daftar */}
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
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                background: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
                color: mode === 'login' ? 'var(--accent-blue)' : 'var(--text-muted)',
                borderBottom: mode === 'login' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UserCheck size={16} />
              <span>Masuk (Login NIPP)</span>
            </button>

            {allowPublicRegistration && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  background: mode === 'register' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'register' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  borderBottom: mode === 'register' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <UserPlus size={16} />
                <span>Daftar Akun Baru</span>
              </button>
            )}
          </div>

          <div style={{ padding: '24px 28px' }}>
            {/* Session Timeout Banner */}
            {sessionExpiredMessage && (
              <Alert tone="warning" style={{ marginBottom: '18px' }}>
                {sessionExpiredMessage}
              </Alert>
            )}

            {/* Notifications */}
            {errorMsg && (
              <Alert tone="error" style={{ marginBottom: '18px' }}>
                {errorMsg}
              </Alert>
            )}

            {successMsg && (
              <Alert tone="success" style={{ marginBottom: '18px' }}>
                {successMsg}
              </Alert>
            )}

            {/* TAB 1: LOGIN */}
            {mode === 'login' || !allowPublicRegistration ? (
              <form
                // No `action` and no `method="get"` on purpose. React's
                // `onSubmit` only runs after hydration; before that the browser
                // performs a NATIVE submit, and with a default GET that put
                // "/?nipp=10002&password=…" into the address bar, the browser
                // history, and the server access log. Removing the inputs'
                // `name` attributes is what actually stops the serialisation
                // (a native submit only sends NAMED controls); `method="post"`
                // is a second line of defence for any future named field.
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitLogin();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div className="form-group">
                  {/* The hint sits outside the <label> on purpose: text inside a label
                      becomes part of the input's accessible name, which produced
                      "NIPP (Nomor Induk Pegawai Pelindo) * Contoh: 10002, 105515" as the
                      name read by screen readers. Now it is a description instead. */}
                  <label className="form-label" htmlFor="login-nipp">
                    NIPP (Nomor Induk Pegawai Pelindo) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-nipp"
                      type="text"
                      className="form-input"
                      placeholder="Masukkan NIPP Anda"
                      value={loginNipp}
                      onChange={(e) => setLoginNipp(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      aria-describedby="login-nipp-hint"
                      style={{ paddingLeft: '36px' }}
                    />
                    <UserIcon
                      size={15}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                  </div>
                  <span id="login-nipp-hint" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Nomor induk pegawai, misalnya 10002 atau 105515
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="login-password">Kata Sandi *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Masukkan kata sandi akun"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      style={{ paddingLeft: '36px', paddingRight: '44px' }}
                    />
                    <KeyRound
                      size={15}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      aria-pressed={showLoginPassword}
                      className="icon-button-touch"
                      style={{
                        position: 'absolute',
                        right: '6px',
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
                    padding: '11px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '6px',
                  }}
                >
                  {loading ? (
                    <span>Memverifikasi Akun...</span>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: REGISTER */
              <form method="post" onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-nipp">NIPP (Nomor Induk Pegawai) *</label>
                    <input
                      id="register-nipp"
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 105515"
                      value={regNipp}
                      onChange={(e) => setRegNipp(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-name">Nama Lengkap & Gelar *</label>
                    <input
                      id="register-name"
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Chandra, S.T."
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-divisi">Divisi *</label>
                    <input
                      id="register-divisi"
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Divisi TI & Sistem Informasi"
                      value={regDivisi}
                      onChange={(e) => setRegDivisi(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-departemen">Departemen *</label>
                    <input
                      id="register-departemen"
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Departemen Solusi TI"
                      value={regDepartemen}
                      onChange={(e) => setRegDepartemen(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-role">Hak Akses (Role) *</label>
                    <select
                      id="register-role"
                      className="form-select"
                      value="pic_cabang"
                      disabled
                      title="Pendaftaran mandiri dikunci pada role PIC Cabang. Penetapan role Admin dilakukan oleh Super Admin."
                    >
                      <option value="pic_cabang">PIC Cabang Pelabuhan (Input Cabang)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-branch">Penugasan Cabang *</label>
                    <select
                      id="register-branch"
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

                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-password">Kata Sandi *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="register-password"
                        type={showRegPassword ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Buat kata sandi"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        aria-describedby="register-password-hint"
                        style={{ paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        aria-label={showRegPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        aria-pressed={showRegPassword}
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
                        {showRegPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                      </button>
                    </div>
                    <p
                      id="register-password-hint"
                      style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}
                    >
                      {PASSWORD_HINT}
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-confirm-password">Konfirmasi Kata Sandi *</label>
                    <input
                      id="register-confirm-password"
                      type="password"
                      className="form-input"
                      placeholder="Ulangi kata sandi"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-inner)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Akun yang didaftarkan akan langsung aktif dan dapat digunakan untuk masuk.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    padding: '11px 18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? 'Mendaftarkan Akun...' : 'Buat Akun dan Masuk'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '12px 28px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        © 2026 PT Pelabuhan Indonesia (Persero) Regional 4 — Divisi ICT
      </footer>
    </div>
  );
}
