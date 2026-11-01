'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  ArrowRight,
  Anchor,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export default function LoginScreen({
  onLoginSuccess,
  theme,
  onThemeChange,
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
  const [regRole, setRegRole] = useState<UserRole>('pic_cabang');
  const [regBranch, setRegBranch] = useState('R01');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nipp: targetNipp, password: targetPass }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'NIPP atau kata sandi tidak cocok.');
      } else {
        setSuccessMsg(`Login berhasil! Selamat datang, ${data.user.name}.`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
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

    if (!regPassword || regPassword.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nipp: regNipp.trim(),
          name: regName.trim(),
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
        setErrorMsg(data.error || 'Gagal mendaftarkan akun baru.');
      } else {
        setSuccessMsg(`Pendaftaran berhasil! Akun NIPP ${regNipp} telah aktif. Masuk otomatis...`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghubungi server.');
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
      {/* Background Decorative Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(30, 58, 138, 0.22) 0%, rgba(6, 182, 212, 0.08) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

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
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              color: '#ffffff',
            }}
          >
            <Anchor size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-title)' }}>
                PELINDO REGIONAL 4
              </span>
              <span
                style={{
                  fontSize: '10.5px',
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
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
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
                fontSize: '13px',
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
                fontSize: '13px',
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
          </div>

          <div style={{ padding: '24px 28px' }}>
            {/* Notifications */}
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: '#f87171',
                  fontSize: '12.5px',
                  marginBottom: '18px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: '#34d399',
                  fontSize: '12.5px',
                  marginBottom: '18px',
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {mode === 'login' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitLogin();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>NIPP (Nomor Induk Pegawai Pelindo) *</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contoh: 10002, 105515</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Masukkan NIPP Anda"
                      value={loginNipp}
                      onChange={(e) => setLoginNipp(e.target.value)}
                      required
                      autoFocus
                      style={{ paddingLeft: '36px' }}
                    />
                    <UserIcon
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Kata Sandi *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Masukkan kata sandi akun"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      style={{ paddingLeft: '36px', paddingRight: '40px' }}
                    />
                    <KeyRound
                      size={15}
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
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    padding: '11px 18px',
                    fontSize: '13.5px',
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
                      <span>Masuk ke Dashboard PortDash</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: REGISTER */
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label">NIPP (Nomor Induk Pegawai) *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 105515"
                      value={regNipp}
                      onChange={(e) => setRegNipp(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nama Lengkap & Gelar *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Chandra, S.T."
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="responsive-grid-2">
                  <div className="form-group">
                    <label className="form-label">Divisi *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Divisi TI & Sistem Informasi"
                      value={regDivisi}
                      onChange={(e) => setRegDivisi(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Departemen *</label>
                    <input
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
                    <label className="form-label">Hak Akses (Role) *</label>
                    <select
                      className="form-select"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                    >
                      <option value="super_admin">Super Admin (Hak Penuh & Pengaturan)</option>
                      <option value="admin_regional">Admin Regional 4 (Analisis & Verifikasi)</option>
                      <option value="pic_dept_regional">PIC Departemen Regional (Input & Pantau)</option>
                      <option value="pic_cabang">PIC Cabang Pelabuhan (Input Cabang)</option>
                      <option value="viewer">BOD Pelindo Regional 4 (Viewer Eksekutif)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Penugasan Cabang *</label>
                    <select
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
                    <label className="form-label">Kata Sandi (Min 6 Karakter) *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Buat kata sandi"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        style={{ paddingRight: '36px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Konfirmasi Kata Sandi *</label>
                    <input
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
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-inner)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Akun yang didaftarkan akan langsung tersimpan di basis data serta disinkronkan ke file{' '}
                  <strong style={{ color: 'var(--accent-blue)' }}>master_user_pic.xlsx</strong>.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    padding: '11px 18px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Baru & Langsung Masuk'}
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
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        PT Pelabuhan Indonesia (Persero) Regional 4 • 28 Cabang Pelabuhan Terintegrasi • PortDash Enterprise Dashboard
      </footer>
    </div>
  );
}
