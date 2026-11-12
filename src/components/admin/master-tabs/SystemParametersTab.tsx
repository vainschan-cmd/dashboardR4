'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  UploadCloud,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  Sliders,
  Clock,
  Shield,
  Sun,
  Moon,
  Server,
  Key,
  FolderCheck,
  HardDrive,
  Globe,
  FileCheck,
} from 'lucide-react';
import {
  User,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from '@/lib/types';

interface SystemParametersTabProps {
  systemParams?: SystemParameters;
  onUpdateSystemParams?: (newParams: SystemParameters) => void;
  dbConfig?: DatabaseConfig;
  onUpdateDbConfig?: (newConfig: DatabaseConfig) => void;
  credentials?: IntegrationCredentials;
  onUpdateCredentials?: (newCreds: IntegrationCredentials) => void;
  currentUser?: User | null;
}

export default function SystemParametersTab({
  systemParams,
  onUpdateSystemParams,
  dbConfig,
  onUpdateDbConfig,
  credentials,
  onUpdateCredentials,
  currentUser,
}: SystemParametersTabProps) {
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState<number>(systemParams?.session_timeout_minutes || 30);
  const [autoLogoutInput, setAutoLogoutInput] = useState<boolean>(systemParams?.auto_logout_idle !== false);
  const [warningBeforeInput, setWarningBeforeInput] = useState<number>(systemParams?.warning_before_minutes || 2);
  const [defaultThemeInput, setDefaultThemeInput] = useState<'light' | 'dark'>(systemParams?.default_theme || 'light');

  const [dbEngineInput, setDbEngineInput] = useState<'sqlite' | 'postgres'>(dbConfig?.engine || 'sqlite');
  const [dbSqlitePathInput, setDbSqlitePathInput] = useState<string>(dbConfig?.sqlite_path || 'data/ed_dashboard.db');
  const [dbPgHostInput, setDbPgHostInput] = useState<string>(dbConfig?.pg_host || 'localhost');
  const [dbPgPortInput, setDbPgPortInput] = useState<number>(dbConfig?.pg_port || 5432);
  const [dbPgDatabaseInput, setDbPgDatabaseInput] = useState<string>(dbConfig?.pg_database || 'ed_dashboard');
  const [dbPgUserInput, setDbPgUserInput] = useState<string>(dbConfig?.pg_user || 'postgres');
  const [dbPgPasswordInput, setDbPgPasswordInput] = useState<string>(dbConfig?.pg_password || '');
  const [dbPgSslInput, setDbPgSslInput] = useState<boolean>(dbConfig?.pg_ssl || false);
  const [dbMaxConnInput, setDbMaxConnInput] = useState<number>(dbConfig?.max_connections || 10);

  const [validatingPath, setValidatingPath] = useState<boolean>(false);
  const [pathValidationResult, setPathValidationResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    resolvedPath?: string;
    exists?: boolean;
    isWritable?: boolean;
    sizeKb?: number;
  } | null>(null);

  const [googleDriveEmailInput, setGoogleDriveEmailInput] = useState<string>(credentials?.google_drive_email || 'regdashr@gmail.com');
  const [googleDriveFilePathInput, setGoogleDriveFilePathInput] = useState<string>(credentials?.google_drive_file_path || 'data/input_data.xlsx');
  const [googleSheetsIdInput, setGoogleSheetsIdInput] = useState<string>(credentials?.google_sheets_id || '');
  const [googleSheetsNameInput, setGoogleSheetsNameInput] = useState<string>(credentials?.google_sheets_name || 'Input_Kinerja_Bulanan');
  const [googleApiKeyInput, setGoogleApiKeyInput] = useState<string>(credentials?.google_api_key || '');
  const [apiGatewayUrlInput, setApiGatewayUrlInput] = useState<string>(credentials?.api_gateway_url || 'https://api.pelindo.co.id/v1/r4');
  const [apiGatewayTokenInput, setApiGatewayTokenInput] = useState<string>(credentials?.api_gateway_token || '');
  const [showSecretCredentials, setShowSecretCredentials] = useState<boolean>(false);

  const [paramSaving, setParamSaving] = useState<boolean>(false);
  const [paramSuccessMsg, setParamSuccessMsg] = useState<string | null>(null);
  const [paramErrorMsg, setParamErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (systemParams) {
        setSessionTimeoutInput(systemParams.session_timeout_minutes || 30);
        setAutoLogoutInput(systemParams.auto_logout_idle !== false);
        setWarningBeforeInput(systemParams.warning_before_minutes || 2);
        setDefaultThemeInput(systemParams.default_theme || 'light');
      }
      if (dbConfig) {
        setDbEngineInput(dbConfig.engine || 'sqlite');
        setDbSqlitePathInput(dbConfig.sqlite_path || 'data/ed_dashboard.db');
        setDbPgHostInput(dbConfig.pg_host || 'localhost');
        setDbPgPortInput(dbConfig.pg_port || 5432);
        setDbPgDatabaseInput(dbConfig.pg_database || 'ed_dashboard');
        setDbPgUserInput(dbConfig.pg_user || 'postgres');
        setDbPgPasswordInput(dbConfig.pg_password || '');
        setDbPgSslInput(dbConfig.pg_ssl || false);
        setDbMaxConnInput(dbConfig.max_connections || 10);
      }
      if (credentials) {
        setGoogleDriveEmailInput(credentials.google_drive_email || 'regdashr@gmail.com');
        setGoogleDriveFilePathInput(credentials.google_drive_file_path || 'data/input_data.xlsx');
        setGoogleSheetsIdInput(credentials.google_sheets_id || '');
        setGoogleSheetsNameInput(credentials.google_sheets_name || 'Input_Kinerja_Bulanan');
        setGoogleApiKeyInput(credentials.google_api_key || '');
        setApiGatewayUrlInput(credentials.api_gateway_url || 'https://api.pelindo.co.id/v1/r4');
        setApiGatewayTokenInput(credentials.api_gateway_token || '');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [systemParams, dbConfig, credentials]);

  const handleValidateDbPath = async () => {
    setValidatingPath(true);
    setPathValidationResult(null);
    try {
      const res = await fetch('/api/system-params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_db_path',
          sqlite_path: dbSqlitePathInput,
        }),
      });
      const data = await res.json();
      setPathValidationResult(data);
    } catch (err: unknown) {
      setPathValidationResult({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal memvalidasi lokasi berkas database.',
      });
    } finally {
      setValidatingPath(false);
    }
  };

  const handleSaveParams = async () => {
    setParamSaving(true);
    setParamSuccessMsg(null);
    setParamErrorMsg(null);
    try {
      const res = await fetch('/api/system-params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            session_timeout_minutes: sessionTimeoutInput,
            auto_logout_idle: autoLogoutInput,
            warning_before_minutes: warningBeforeInput,
            default_theme: defaultThemeInput,
          },
          dbConfig: {
            engine: dbEngineInput,
            sqlite_path: dbSqlitePathInput,
            pg_host: dbPgHostInput,
            pg_port: dbPgPortInput,
            pg_database: dbPgDatabaseInput,
            pg_user: dbPgUserInput,
            pg_password: dbPgPasswordInput,
            pg_ssl: dbPgSslInput,
            max_connections: dbMaxConnInput,
          },
          credentials: {
            google_drive_email: googleDriveEmailInput,
            google_drive_file_path: googleDriveFilePathInput,
            google_sheets_id: googleSheetsIdInput,
            google_sheets_name: googleSheetsNameInput,
            google_api_key: googleApiKeyInput,
            api_gateway_url: apiGatewayUrlInput,
            api_gateway_token: apiGatewayTokenInput,
          },
          user_id: currentUser?.id,
          user_name: currentUser?.name || currentUser?.username,
          user_role: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setParamSuccessMsg('Parameter sistem, konfigurasi lokasi database, dan kredensial integrasi telah disimpan.');
        if (data.params && onUpdateSystemParams) {
          onUpdateSystemParams(data.params);
        }
        if (data.dbConfig && onUpdateDbConfig) {
          onUpdateDbConfig(data.dbConfig);
        }
        if (data.credentials && onUpdateCredentials) {
          onUpdateCredentials(data.credentials);
        }
        setTimeout(() => setParamSuccessMsg(null), 5000);
      } else {
        setParamErrorMsg(data.error || 'Gagal menyimpan parameter sistem.');
      }
    } catch (err: unknown) {
      setParamErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setParamSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-inner)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: 'var(--accent-blue-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sliders size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
              Konfigurasi Parameter Sistem, Database & Integrasi
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Kelola batas waktu sesi, lokasi penyimpanan database di direktori data, dan kredensial integrasi layanan.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}>
            <Shield size={13} />
            <span>Sesi: {sessionTimeoutInput} Menit</span>
          </span>
          <span className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}>
            <HardDrive size={13} />
            <span>DB: {dbEngineInput.toUpperCase()}</span>
          </span>
          <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}>
            <UploadCloud size={13} />
            <span>Berkas: {googleDriveFilePathInput}</span>
          </span>
        </div>
      </div>

      {paramSuccessMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-good-text)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{paramSuccessMsg}</span>
        </div>
      )}

      {paramErrorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger-text)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} />
          <span>{paramErrorMsg}</span>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Clock size={16} color="var(--accent-blue)" />
          <h4 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            1. Kebijakan Sesi & Preferensi Tampilan
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="var(--accent-blue)" />
              <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                Batas Waktu Sesi Tidak Aktif
              </h5>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Apabila tidak ada aktivitas pengguna selama durasi ini, sesi akan berakhir secara otomatis.
            </p>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Pilihan Durasi:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[15, 30, 45, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSessionTimeoutInput(mins)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: sessionTimeoutInput === mins ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      backgroundColor: sessionTimeoutInput === mins ? 'rgba(2, 132, 199, 0.18)' : 'var(--bg-inner)',
                      color: sessionTimeoutInput === mins ? 'var(--accent-blue)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    {mins}m {mins === 30 ? '(Standar)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                Durasi Kustom:
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={sessionTimeoutInput}
                onChange={(e) => setSessionTimeoutInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="form-input tabular-nums"
                style={{ width: '85px', textAlign: 'center', fontWeight: 700 }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menit</span>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} color="var(--accent-blue)" />
              <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                Kebijakan Keluar Otomatis & Peringatan
              </h5>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input
                type="checkbox"
                id="chk-auto-logout"
                checked={autoLogoutInput}
                onChange={(e) => setAutoLogoutInput(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="chk-auto-logout" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Aktifkan Keluar Otomatis saat Tidak Aktif
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Kembali ke halaman masuk apabila tidak ada aktivitas pengguna.
                </div>
              </label>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                Peringatan Hitung Mundur:
              </label>
              <select
                value={warningBeforeInput}
                onChange={(e) => setWarningBeforeInput(Number(e.target.value))}
                className="form-select"
                style={{ width: '100%', fontSize: '12px' }}
              >
                <option value={1}>1 Menit Sebelum Sesi Berakhir</option>
                <option value={2}>2 Menit Sebelum Sesi Berakhir (Direkomendasikan)</option>
                <option value={5}>5 Menit Sebelum Sesi Berakhir</option>
              </select>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sun size={18} color="var(--accent-blue)" />
              <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                Mode Tampilan Bawaan
              </h5>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Pilih tema bawaan saat aplikasi pertama kali dibuka oleh pengguna.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDefaultThemeInput('light')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: defaultThemeInput === 'light' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                  backgroundColor: defaultThemeInput === 'light' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-inner)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Sun size={20} color="var(--accent-blue)" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Mode Terang
                </span>
                <span style={{ fontSize: '12px', color: 'var(--status-good-text)', fontWeight: 700 }}>
                  Rekomendasi
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDefaultThemeInput('dark')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: defaultThemeInput === 'dark' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                  backgroundColor: defaultThemeInput === 'dark' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-inner)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Moon size={20} color="var(--accent-blue)" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Mode Gelap
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Opsional
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                color: 'var(--accent-blue-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HardDrive size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                2. Lokasi Database & Mesin Penyimpanan
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Konfigurasi lokasi berkas SQLite di dalam direktori data aplikasi atau parameter koneksi PostgreSQL.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setDbEngineInput('sqlite')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: dbEngineInput === 'sqlite' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                backgroundColor: dbEngineInput === 'sqlite' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                color: dbEngineInput === 'sqlite' ? 'var(--accent-blue)' : 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <HardDrive size={14} />
              <span>SQLite (Berkas Lokal)</span>
            </button>

            <button
              type="button"
              onClick={() => setDbEngineInput('postgres')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: dbEngineInput === 'postgres' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                backgroundColor: dbEngineInput === 'postgres' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                color: dbEngineInput === 'postgres' ? 'var(--accent-blue)' : 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <Server size={14} />
              <span>PostgreSQL (Server Enterprise)</span>
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-inner)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-title)', marginBottom: '4px' }}>
            <FolderCheck size={16} color="var(--accent-blue)" />
            <span>Isolasi Direktori Data Aplikasi</span>
          </div>
          Demi keamanan sistem, berkas SQLite dikunci di dalam direktori <code>data/</code>. Pilih salah satu berkas database dan gunakan tombol <strong>Validasi Lokasi</strong> untuk memastikan akses baca/tulis tersedia.
        </div>

        {dbEngineInput === 'sqlite' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Lokasi Berkas Database SQLite (.db):
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={dbSqlitePathInput}
                  onChange={(e) => {
                    setDbSqlitePathInput(e.target.value);
                    setPathValidationResult(null);
                  }}
                  placeholder="data/ed_dashboard.db"
                  className="form-input"
                  style={{
                    flex: '1 1 340px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-inner)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleValidateDbPath}
                  disabled={validatingPath || !dbSqlitePathInput.trim()}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {validatingPath ? <RefreshCw size={14} className="spin" /> : <FileCheck size={14} />}
                  <span>{validatingPath ? 'Memeriksa...' : 'Validasi Lokasi'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Pilihan Lokasi:</span>
                {['data/ed_dashboard.db', 'data/ed_dashboard_backup.db', 'data/production.db'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDbSqlitePathInput(p);
                      setPathValidationResult(null);
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: dbSqlitePathInput === p ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                      color: dbSqlitePathInput === p ? 'var(--accent-blue)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {pathValidationResult && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: pathValidationResult.success
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                  border: pathValidationResult.success
                    ? '1px solid rgba(34, 197, 94, 0.35)'
                    : '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: pathValidationResult.success ? 'var(--status-good-text)' : 'var(--status-danger-text)' }}>
                  {pathValidationResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>
                    {pathValidationResult.success
                      ? 'Hasil Validasi: Lokasi Database Terverifikasi'
                      : 'Hasil Validasi: Lokasi Database Tidak Valid'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {pathValidationResult.message || pathValidationResult.error}
                </div>
                {pathValidationResult.resolvedPath && (
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div><strong>Lokasi Relatif:</strong> <code style={{ color: 'var(--text-main)' }}>{pathValidationResult.resolvedPath}</code></div>
                    <div><strong>Ukuran Berkas:</strong> {pathValidationResult.sizeKb || 0} KB</div>
                    <div><strong>Akses Tulis:</strong> <span style={{ color: pathValidationResult.isWritable ? 'var(--status-good-text)' : 'var(--status-danger-text)', fontWeight: 700 }}>{pathValidationResult.isWritable ? 'Tersedia' : 'Tidak Tersedia'}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {dbEngineInput === 'postgres' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Host / Alamat IP Server:
                </label>
                <input
                  type="text"
                  value={dbPgHostInput}
                  onChange={(e) => setDbPgHostInput(e.target.value)}
                  placeholder="localhost atau 10.x.x.x"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Port Database:
                </label>
                <input
                  type="number"
                  value={dbPgPortInput}
                  onChange={(e) => setDbPgPortInput(Number(e.target.value) || 5432)}
                  placeholder="5432"
                  className="form-input tabular-nums"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Nama Database:
                </label>
                <input
                  type="text"
                  value={dbPgDatabaseInput}
                  onChange={(e) => setDbPgDatabaseInput(e.target.value)}
                  placeholder="ed_dashboard"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Nama Pengguna Database:
                </label>
                <input
                  type="text"
                  value={dbPgUserInput}
                  onChange={(e) => setDbPgUserInput(e.target.value)}
                  placeholder="postgres"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Kata Sandi Database:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecretCredentials ? 'text' : 'password'}
                    value={dbPgPasswordInput}
                    onChange={(e) => setDbPgPasswordInput(e.target.value)}
                    placeholder="Kata sandi database"
                    className="form-input"
                    style={{ width: '100%', fontSize: '12px', paddingRight: '32px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretCredentials(!showSecretCredentials)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showSecretCredentials ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Batas Maksimum Koneksi:
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={dbMaxConnInput}
                  onChange={(e) => setDbMaxConnInput(Number(e.target.value) || 10)}
                  className="form-input tabular-nums"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="chk-pg-ssl"
                checked={dbPgSslInput}
                onChange={(e) => setDbPgSslInput(e.target.checked)}
                style={{ cursor: 'pointer', width: '15px', height: '15px' }}
              />
              <label htmlFor="chk-pg-ssl" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                Gunakan Enkripsi Koneksi SSL / TLS
              </label>
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} color="var(--accent-blue)" />
            <h4 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              3. Kredensial & Integrasi Eksternal
            </h4>
          </div>

          <button
            type="button"
            onClick={() => setShowSecretCredentials(!showSecretCredentials)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              fontSize: '12px',
            }}
          >
            {showSecretCredentials ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showSecretCredentials ? 'Sembunyikan Nilai Kunci' : 'Tampilkan Nilai Kunci'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(2, 132, 199, 0.15)',
                  color: 'var(--accent-blue-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UploadCloud size={16} />
              </div>
              <div>
                <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                  Berkas Spreadsheet Master Lokal
                </h5>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sinkronisasi berkas input Excel lokal</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Identitas Akun Pengelola:
              </label>
              <input
                type="email"
                value={googleDriveEmailInput}
                onChange={(e) => setGoogleDriveEmailInput(e.target.value)}
                placeholder="regdashr@gmail.com"
                className="form-input"
                style={{ width: '100%', fontSize: '12px', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Lokasi Berkas Excel Input (Di Dalam Direktori Data):
              </label>
              <input
                type="text"
                value={googleDriveFilePathInput}
                onChange={(e) => setGoogleDriveFilePathInput(e.target.value)}
                placeholder="data/input_data.xlsx"
                className="form-input"
                style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Berkas spreadsheet lokal yang menjadi rujukan impor awal sistem.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--status-good-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={16} />
              </div>
              <div>
                <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                  Google Sheets API (Opsional)
                </h5>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Konfigurasi konektor Google Sheets</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                ID Spreadsheet:
              </label>
              <input
                type="text"
                value={googleSheetsIdInput}
                onChange={(e) => setGoogleSheetsIdInput(e.target.value)}
                placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="form-input"
                style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Nama Lembar Kerja:
                </label>
                <input
                  type="text"
                  value={googleSheetsNameInput}
                  onChange={(e) => setGoogleSheetsNameInput(e.target.value)}
                  placeholder="Input_Kinerja_Bulanan"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Kunci API Google:
                </label>
                <input
                  type={showSecretCredentials ? 'text' : 'password'}
                  value={googleApiKeyInput}
                  onChange={(e) => setGoogleApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="form-input"
                  style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(2, 132, 199, 0.15)',
                  color: 'var(--accent-blue-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Globe size={16} />
              </div>
              <div>
                <h5 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                  Pelindo Enterprise API Gateway
                </h5>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Integrasi sistem holding & regional</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                URL Endpoint Gateway:
              </label>
              <input
                type="url"
                value={apiGatewayUrlInput}
                onChange={(e) => setApiGatewayUrlInput(e.target.value)}
                placeholder="https://api.pelindo.co.id/v1/r4"
                className="form-input"
                style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Token Bearer / Rahasia API:
              </label>
              <input
                type={showSecretCredentials ? 'text' : 'password'}
                value={apiGatewayTokenInput}
                onChange={(e) => setApiGatewayTokenInput(e.target.value)}
                placeholder="Bearer eyJhbGciOi..."
                className="form-input"
                style={{ width: '100%', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '18px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={18} color="var(--accent-blue)" />
          <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
            4. Status Penyimpanan & Ringkasan Audit Sistem
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px', marginTop: '4px' }}>
          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px' }}>Mesin Database Aktif:</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {dbEngineInput === 'sqlite' ? `SQLite (${dbSqlitePathInput})` : `PostgreSQL (${dbPgHostInput}:${dbPgPortInput}/${dbPgDatabaseInput})`}
            </div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px' }}>Pemantau Aktivitas Sesi:</div>
            <div style={{ fontWeight: 700, color: 'var(--status-good-text)' }}>
              Aktif (Sinkronisasi Lintas Tab)
            </div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px' }}>Terakhir Diperbarui:</div>
            <div className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {systemParams?.updated_at ? new Date(systemParams.updated_at).toLocaleString('id-ID') : 'Bawaan Sistem'}
            </div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px' }}>Diperbarui Oleh:</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {systemParams?.updated_by || 'Admin Regional'}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setSessionTimeoutInput(30);
            setAutoLogoutInput(true);
            setWarningBeforeInput(2);
            setDefaultThemeInput('light');
            setDbEngineInput('sqlite');
            setDbSqlitePathInput('data/ed_dashboard.db');
            setGoogleDriveEmailInput('regdashr@gmail.com');
            setGoogleDriveFilePathInput('data/input_data.xlsx');
            setGoogleSheetsNameInput('Input_Kinerja_Bulanan');
            setPathValidationResult(null);
          }}
          className="btn btn-secondary"
          style={{ fontSize: '12px' }}
        >
          Kembalikan ke Parameter Standar
        </button>

        <button
          type="button"
          onClick={handleSaveParams}
          disabled={paramSaving}
          className="btn btn-primary"
          style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {paramSaving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
          <span>{paramSaving ? 'Menyimpan...' : 'Simpan Parameter Sistem'}</span>
        </button>
      </div>
    </div>
  );
}

