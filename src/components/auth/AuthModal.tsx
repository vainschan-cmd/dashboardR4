'use client';

import React, { useState } from 'react';
import {
  X,
  Lock,
  UserCheck,
  UserPlus,
  Shield,
  Building2,
  Layers,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  CloudCheck
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';

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
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

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

  if (!isOpen) return null;

  // Handle Quick Switch demo account
  const handleQuickLogin = (nipp: string, pass: string = 'password123') => {
    setLoginNipp(nipp);
    setLoginPassword(pass);
    submitLogin(nipp, pass);
  };

  const submitLogin = async (nippToUse?: string, passToUse?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetNipp = nippToUse || loginNipp;
    const targetPass = passToUse || loginPassword;

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nipp: targetNipp, password: targetPass }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Login gagal. Periksa kembali NIPP dan kata sandi Anda.');
      } else {
        setSuccessMsg(`Berhasil login sebagai ${data.user.name}`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 600);
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

    if (!regName.trim() || !regNipp.trim() || !regDivisi.trim() || !regDepartemen.trim()) {
      setErrorMsg('Nama, NIPP, Divisi, dan Departemen wajib diisi!');
      return;
    }

    if (!regPassword) {
      setErrorMsg('Kata sandi wajib diisi!');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok!');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          nipp: regNipp.trim(),
          divisi: regDivisi.trim(),
          departemen: regDepartemen.trim(),
          password: regPassword,
          role: regRole,
          branch_id: regRole === 'pic_cabang' ? regBranch : 'R99',
          email: `${regNipp.trim()}@pelindo.co.id`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Pendaftaran gagal.');
      } else {
        setSuccessMsg(`Pendaftaran berhasil! Akun ${data.user.name} (NIPP: ${data.user.nipp}) tersimpan ke Master Data & Spreadsheet My Drive.`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
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
                color: 'var(--accent-blue)',
              }}
            >
              {mode === 'login' ? <Lock size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px' }}>
                {mode === 'login' ? 'Masuk ke Pelindo R4 PortDash' : 'Daftar Akun Baru PIC / Pengguna'}
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {mode === 'login'
                  ? 'Gunakan NIPP sebagai username Anda'
                  : 'Data tersinkron otomatis ke Spreadsheet My Drive (regdashr@gmail.com)'}
              </p>
            </div>
          </div>
          <button
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
              fontSize: '13px',
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
              fontSize: '13px',
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
        </div>

        {/* Body Modal */}
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
          {/* Notifications */}
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #10b981',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: FORM LOGIN */}
          {mode === 'login' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitLogin();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>NIPP (Nomor Induk Pegawai Pelindo)</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>Sebagai Username</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: 10001, 10002, 10003..."
                  value={loginNipp}
                  onChange={(e) => setLoginNipp(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kata Sandi (Password)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Masukkan kata sandi..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
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
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
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
                  fontSize: '13px',
                  fontWeight: 700,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <span className="spin">⏳</span> : <Lock size={15} />}
                <span>{loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
              </button>

              {/* Quick Login Demo Accounts */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Akses Cepat Akun Demo (Klik untuk langsung masuk):
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('10001')}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-inner)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>10001 - Budi Santoso</div>
                    <div style={{ color: 'var(--accent-blue)', fontSize: '10.5px' }}>Super Admin</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('10002')}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-inner)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>10002 - Hendra Wijaya</div>
                    <div style={{ color: '#10b981', fontSize: '10.5px' }}>Admin Regional 4</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('10003')}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-inner)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>10003 - Capt. Rudi H.</div>
                    <div style={{ color: '#f59e0b', fontSize: '10.5px' }}>PIC Dept Operasi</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('10004')}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-inner)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>10004 - Ahmad Dahlan</div>
                    <div style={{ color: '#06b6d4', fontSize: '10.5px' }}>PIC Cabang Makassar</div>
                  </button>
                </div>
              </div>

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
                    color: 'var(--accent-blue)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Daftar Akun Baru
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: FORM DAFTAR AKUN BARU */
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  fontSize: '11.5px',
                  color: 'var(--accent-blue)',
                }}
              >
                <FileSpreadsheet size={15} style={{ flexShrink: 0 }} />
                <span>
                  Data otomatis tersimpan di database & spreadsheet My Drive <strong>regdashr@gmail.com</strong>
                </span>
              </div>

              {/* Input Nama & NIPP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Nama Lengkap Pegawai *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Bambang Sudiro, S.T."
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">NIPP (Username) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: 10025"
                    value={regNipp}
                    onChange={(e) => setRegNipp(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Input Divisi & Departemen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Divisi *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Divisi Operasi Pelabuhan"
                    value={regDivisi}
                    onChange={(e) => setRegDivisi(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departemen / Unit *</label>
                  <input
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
                  <label className="form-label">Hak Akses / Role *</label>
                  <select
                    className="form-select"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                  >
                    <option value="pic_cabang">PIC Cabang (Terminal)</option>
                    <option value="pic_dept_regional">PIC Dept Regional 4</option>
                    <option value="admin_regional">Admin Regional 4</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="viewer">BOD Regional 4 (Viewer)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Penugasan Cabang</label>
                  <select
                    className="form-select"
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    disabled={regRole !== 'pic_cabang'}
                  >
                    <option value="R99">R99 - Regional 4 (Pusat)</option>
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
                  <label className="form-label">Kata Sandi (Password) *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Minimal 6 karakter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Konfirmasi Kata Sandi *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Ulangi kata sandi"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
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
                <label htmlFor="showPassReg" style={{ fontSize: '11.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                  fontSize: '13px',
                  fontWeight: 700,
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? <span className="spin">⏳</span> : <UserPlus size={15} />}
                <span>{loading ? 'Menyimpan ke My Drive...' : 'Daftar Akun Baru & Simpan ke My Drive'}</span>
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
                    color: 'var(--accent-blue)',
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
