'use client';

import React, { useState, useRef } from 'react';
import {
  Database,
  Building2,
  Layers,
  Target,
  Wrench,
  CheckCircle2,
  UserCheck,
  UserPlus,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Edit2,
  ArrowDownToLine,
  UploadCloud,
  X,
  Save,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  Sliders,
  Clock,
  Shield,
  Sun,
  Moon,
  Server,
  Key,
  FolderCheck,
  HardDrive,
  Link2,
  Globe,
  FileCheck,
} from 'lucide-react';
import {
  Branch,
  Department,
  KPIIndicator,
  EquipmentItem,
  User,
  UserRole,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import AuthModal from '@/components/auth/AuthModal';

interface MasterDataViewProps {
  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment?: EquipmentItem[];
  users?: User[];
  onRefreshUsers?: () => void;
  systemParams?: SystemParameters;
  onUpdateSystemParams?: (newParams: SystemParameters) => void;
  dbConfig?: DatabaseConfig;
  onUpdateDbConfig?: (newConfig: DatabaseConfig) => void;
  credentials?: IntegrationCredentials;
  onUpdateCredentials?: (newCreds: IntegrationCredentials) => void;
  currentUser?: User | null;
}

export default function MasterDataView({
  branches,
  departments,
  indicators,
  equipment = [],
  users = [],
  onRefreshUsers,
  systemParams,
  onUpdateSystemParams,
  dbConfig,
  onUpdateDbConfig,
  credentials,
  onUpdateCredentials,
  currentUser,
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'branches' | 'departments' | 'equipment' | 'users' | 'parameter'>('users');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // System parameters state (Parameter Sesi & Konfigurasi)
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState<number>(systemParams?.session_timeout_minutes || 30);
  const [autoLogoutInput, setAutoLogoutInput] = useState<boolean>(systemParams?.auto_logout_idle !== false);
  const [warningBeforeInput, setWarningBeforeInput] = useState<number>(systemParams?.warning_before_minutes || 2);
  const [defaultThemeInput, setDefaultThemeInput] = useState<'light' | 'dark'>(systemParams?.default_theme || 'light');

  // Database configuration state
  const [dbEngineInput, setDbEngineInput] = useState<'sqlite' | 'postgres'>(dbConfig?.engine || 'sqlite');
  const [dbSqlitePathInput, setDbSqlitePathInput] = useState<string>(dbConfig?.sqlite_path || 'data/ed_dashboard.db');
  const [dbPgHostInput, setDbPgHostInput] = useState<string>(dbConfig?.pg_host || 'localhost');
  const [dbPgPortInput, setDbPgPortInput] = useState<number>(dbConfig?.pg_port || 5432);
  const [dbPgDatabaseInput, setDbPgDatabaseInput] = useState<string>(dbConfig?.pg_database || 'ed_dashboard');
  const [dbPgUserInput, setDbPgUserInput] = useState<string>(dbConfig?.pg_user || 'postgres');
  const [dbPgPasswordInput, setDbPgPasswordInput] = useState<string>(dbConfig?.pg_password || '');
  const [dbPgSslInput, setDbPgSslInput] = useState<boolean>(dbConfig?.pg_ssl || false);
  const [dbMaxConnInput, setDbMaxConnInput] = useState<number>(dbConfig?.max_connections || 10);

  // Database validation state
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

  // Integration credentials state
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

  React.useEffect(() => {
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
    } catch (err: any) {
      setPathValidationResult({
        success: false,
        message: err.message || 'Gagal memvalidasi path database.',
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
        setParamSuccessMsg('Parameter sistem, konfigurasi lokasi database, dan kredensial integrasi berhasil disimpan!');
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
    } catch (err: any) {
      setParamErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setParamSaving(false);
    }
  };

  // Edit user modal state
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editNipp, setEditNipp] = useState('');
  const [editDivisi, setEditDivisi] = useState('');
  const [editDepartemen, setEditDepartemen] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('pic_cabang');
  const [editBranch, setEditBranch] = useState('R99');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Dual sync state (Ambil dari Drive vs Sinkron ke Drive)
  const [pullingDrive, setPullingDrive] = useState(false);
  const [pushingDrive, setPushingDrive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredIndicators = indicators.filter(i =>
    selectedDeptFilter === 'ALL' || i.department_id === selectedDeptFilter
  );

  // Opsi 1: Ambil Data dari My Drive (Pull / Import dari Spreadsheet)
  const handlePullFromDrive = async () => {
    setPullingDrive(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/users/sync-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: data.message || `Berhasil mengambil data dari spreadsheet My Drive! Total ${data.totalUsers} PIC tersinkronisasi.`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal mengambil data dari spreadsheet: ${data.error}`,
        });
      }
    } catch (e: any) {
      setSyncStatus({
        type: 'error',
        message: `Gagal mengambil data: ${e.message}`,
      });
    } finally {
      setPullingDrive(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Opsi 2: Sinkron ke My Drive (Push / Export ke Spreadsheet)
  const handlePushToDrive = async () => {
    setPushingDrive(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/users/sync-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: `Spreadsheet master_user_pic.xlsx berhasil diperbarui (${data.totalUsers} PIC) dan disalin ke folder Downloads. Siap di-upload ke My Drive (regdashr@gmail.com).`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal sinkron ke My Drive: ${data.error}`,
        });
      }
    } catch (e: any) {
      setSyncStatus({
        type: 'error',
        message: `Gagal sinkron: ${e.message}`,
      });
    } finally {
      setPushingDrive(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Opsional: Upload file spreadsheet .xlsx manual
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPullingDrive(true);
    setSyncStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/users/sync-drive', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: data.message || `Berhasil mengimpor ${file.name}!`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal mengimpor file: ${data.error}`,
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: `Gagal upload file: ${err.message}`,
      });
    } finally {
      setPullingDrive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Buka modal Edit PIC
  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditNipp(u.nipp || u.username);
    setEditDivisi(u.divisi || '');
    setEditDepartemen(u.departemen || '');
    setEditRole(u.role || 'pic_cabang');
    setEditBranch(u.branch_id || 'R99');
    setEditActive(u.active !== undefined ? Boolean(u.active) : true);
    setEditPassword('');
    setShowEditPassword(false);
    setEditError(null);
    setIsEditUserOpen(true);
  };

  // Simpan perubahan Edit PIC
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editDivisi.trim() || !editDepartemen.trim()) {
      setEditError('Nama, Divisi, dan Departemen wajib diisi!');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          name: editName.trim(),
          nipp: editNipp.trim() || editingUser.nipp,
          divisi: editDivisi.trim(),
          departemen: editDepartemen.trim(),
          role: editRole,
          branch_id: editBranch,
          active: editActive,
          password: editPassword.trim() ? editPassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditError(data.error || 'Gagal menyimpan perubahan.');
      } else {
        setIsEditUserOpen(false);
        setEditingUser(null);
        setSyncStatus({
          type: 'success',
          message: `Data PIC ${editName} (NIPP: ${editNipp}) berhasil diperbarui dan disinkronkan ke Spreadsheet My Drive!`,
        });
        if (onRefreshUsers) onRefreshUsers();
        setTimeout(() => setSyncStatus(null), 4500);
      }
    } catch (err: any) {
      setEditError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus user PIC ${name}?`)) return;
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: `User PIC ${name} berhasil dihapus dan spreadsheet diperbarui.`,
        });
        if (onRefreshUsers) onRefreshUsers();
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        alert(data.error || 'Gagal menghapus user');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Database size={20} color="var(--blue-primary)" />
              <span>Manajemen Master Data Pelabuhan</span>
            </h2>
            <p className="card-subtitle">
              Struktur katalog master cabang pelabuhan, departemen, PIC pengguna, serta definisi indikator KPI dan peralatan operasional.
            </p>
          </div>
        </div>

        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('users')}
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <UserCheck size={16} />
            <span>Master User & PIC ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`tab-btn ${activeTab === 'kpi' ? 'active' : ''}`}
          >
            <Target size={16} />
            <span>Master Indikator & KPI ({indicators.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          >
            <Building2 size={16} />
            <span>Master Cabang Pelabuhan ({branches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Master Departemen ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`tab-btn ${activeTab === 'equipment' ? 'active' : ''}`}
          >
            <Wrench size={16} />
            <span>Master Katalog Peralatan ({equipment.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('parameter')}
            className={`tab-btn ${activeTab === 'parameter' ? 'active' : ''}`}
          >
            <Sliders size={16} />
            <span>Parameter Sistem</span>
          </button>
        </div>

        {/* TAB: MASTER USER & PIC */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Toolbar: My Drive Integration & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-inner)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                    Spreadsheet Master PIC (master_user_pic.xlsx)
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Tersedia di folder <strong>Downloads/master_user_pic.xlsx</strong> & data aplikasi • Akun Google: <strong style={{ color: 'var(--accent-blue)' }}>regdashr@gmail.com</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} />
                  <span>Tambah PIC Baru</span>
                </button>

                {/* Opsi 1: Ambil Data dari My Drive */}
                <button
                  type="button"
                  onClick={handlePullFromDrive}
                  disabled={pullingDrive || pushingDrive}
                  className="btn-dark"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    color: '#38bdf8',
                    fontWeight: 600,
                  }}
                  title="Ambil dan sinkronkan data PIC dari file spreadsheet master_user_pic.xlsx di My Drive"
                >
                  <ArrowDownToLine size={13} className={pullingDrive ? 'spin' : ''} />
                  <span>{pullingDrive ? 'Mengambil Data...' : 'Ambil dari My Drive'}</span>
                </button>

                {/* Opsi 2: Sinkron ke My Drive */}
                <button
                  type="button"
                  onClick={handlePushToDrive}
                  disabled={pushingDrive || pullingDrive}
                  className="btn-dark"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    color: '#34d399',
                    fontWeight: 600,
                  }}
                  title="Kirim dan perbarui data PIC ke file master_user_pic.xlsx di My Drive"
                >
                  <UploadCloud size={13} className={pushingDrive ? 'spin' : ''} />
                  <span>{pushingDrive ? 'Menyinkronkan...' : 'Sinkron ke My Drive'}</span>
                </button>

                {/* Unduh Excel */}
                <a
                  href="/api/users/export"
                  download="master_user_pic.xlsx"
                  className="btn-dark"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  title="Unduh file spreadsheet Excel master PIC"
                >
                  <Download size={13} />
                  <span>Download .xlsx</span>
                </a>

                {/* Unggah File Manual */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  onChange={handleUploadFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-dark"
                  disabled={pullingDrive || pushingDrive}
                  style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.85 }}
                  title="Unggah file .xlsx PIC lain dari komputer Anda"
                >
                  <Upload size={12} />
                  <span>Pilih File...</span>
                </button>
              </div>
            </div>

            {/* Sync Notification Banner */}
            {syncStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  backgroundColor: syncStatus.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${syncStatus.type === 'success' ? '#10b981' : '#ef4444'}`,
                  borderRadius: '6px',
                  color: syncStatus.type === 'success' ? '#34d399' : '#f87171',
                  fontSize: '12px',
                }}
              >
                {syncStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{syncStatus.message}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>NIPP (Username)</th>
                    <th>Nama Pegawai</th>
                    <th>Divisi</th>
                    <th>Departemen</th>
                    <th>Hak Akses / Role</th>
                    <th>Penugasan Cabang</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const roleLabels: Record<string, { label: string; badge: string }> = {
                      super_admin: { label: 'Super Admin', badge: 'badge-blue' },
                      admin_regional: { label: 'Admin Regional 4', badge: 'badge-green' },
                      pic_dept_regional: { label: 'PIC Dept Regional', badge: 'badge-yellow' },
                      pic_cabang: { label: 'PIC Cabang', badge: 'badge-neutral' },
                      viewer: { label: 'BOD (Viewer)', badge: 'badge-neutral' },
                    };
                    const roleInfo = roleLabels[u.role] || { label: u.role, badge: 'badge-neutral' };

                    return (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {u.nipp || u.username}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                          {u.name}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {u.divisi || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {u.departemen || '-'}
                        </td>
                        <td>
                          <span className={`badge ${roleInfo.badge}`}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {u.branch_id ? u.branch_id : 'Regional 4 (Pusat)'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${u.active ? 'badge-green' : 'badge-neutral'}`}>
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {/* Tombol Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                borderRadius: '5px',
                                color: '#38bdf8',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={`Edit data PIC ${u.name}`}
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>

                            {/* Tombol Hapus */}
                            {u.username !== '10001' && u.username !== 'superadmin' ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px 6px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '5px',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title={`Hapus user ${u.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sistem</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        Belum ada data PIC yang terdaftar. Klik tombol "Tambah PIC Baru" untuk mendaftarkan akun.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Tambah User PIC Baru */}
            <AuthModal
              isOpen={isAddUserOpen}
              onClose={() => setIsAddUserOpen(false)}
              currentUser={null}
              initialMode="register"
              onLoginSuccess={() => {
                if (onRefreshUsers) onRefreshUsers();
              }}
            />

            {/* Modal Edit Data PIC */}
            {isEditUserOpen && editingUser && (
              <div className="modal-overlay" onClick={() => setIsEditUserOpen(false)}>
                <div
                  className="modal-content"
                  style={{ maxWidth: '580px', width: '100%', overflow: 'hidden' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header Modal */}
                  <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38bdf8',
                        }}
                      >
                        <Edit2 size={18} />
                      </div>
                      <div>
                        <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                          Edit Data Pegawai / PIC
                        </h3>
                        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          NIPP: <strong style={{ color: 'var(--accent-cyan)' }}>{editingUser.nipp || editingUser.username}</strong> • ID Akun: {editingUser.id}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditUserOpen(false)}
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

                  {/* Body Modal Form */}
                  <form onSubmit={handleSaveEdit}>
                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {editError && (
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
                          }}
                        >
                          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{editError}</span>
                        </div>
                      )}

                      {/* Row 1: NIPP & Status */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            NIPP (Username)
                          </label>
                          <input
                            type="text"
                            value={editNipp}
                            onChange={(e) => setEditNipp(e.target.value)}
                            className="form-control"
                            style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            Status Akun
                          </label>
                          <select
                            value={editActive ? 'active' : 'inactive'}
                            onChange={(e) => setEditActive(e.target.value === 'active')}
                            className="form-control"
                          >
                            <option value="active">Aktif (Dapat Login & Akses)</option>
                            <option value="inactive">Nonaktif (Akses Dinonaktifkan)</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Nama Lengkap */}
                      <div className="form-group">
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                          Nama Pegawai & Gelar
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="form-control"
                          placeholder="Contoh: Capt. Rudi Hartono, M.Mar."
                          required
                        />
                      </div>

                      {/* Row 3: Divisi & Departemen */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            Divisi
                          </label>
                          <input
                            type="text"
                            value={editDivisi}
                            onChange={(e) => setEditDivisi(e.target.value)}
                            className="form-control"
                            placeholder="Contoh: Divisi Operasi & Pelayanan Kapal"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            Departemen
                          </label>
                          <input
                            type="text"
                            value={editDepartemen}
                            onChange={(e) => setEditDepartemen(e.target.value)}
                            className="form-control"
                            placeholder="Contoh: Departemen Pelayanan Kapal"
                            required
                          />
                        </div>
                      </div>

                      {/* Row 4: Hak Akses & Penugasan Cabang */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            Hak Akses / Role
                          </label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="form-control"
                          >
                            <option value="super_admin">Super Admin (Akses Penuh)</option>
                            <option value="admin_regional">Admin Regional 4 (Verifikator Regional)</option>
                            <option value="pic_dept_regional">PIC Dept Regional (PIC Departemen Pusat)</option>
                            <option value="pic_cabang">PIC Cabang (PIC Operasional Cabang)</option>
                            <option value="viewer">BOD / Viewer (Eksekutif Read-Only)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                            Penugasan Cabang
                          </label>
                          <select
                            value={editBranch}
                            onChange={(e) => setEditBranch(e.target.value)}
                            className="form-control"
                          >
                            {OFFICIAL_BRANCHES.map((b) => (
                              <option key={b.code} value={b.code}>
                                {b.code} - {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row 5: Reset / Ganti Password (Opsional) */}
                      <div className="form-group" style={{ backgroundColor: 'var(--bg-inner)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={13} color="var(--accent-blue)" />
                            <span>Ubah Kata Sandi (Opsional)</span>
                          </label>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            Kosongkan jika tidak ingin mengubah kata sandi
                          </span>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showEditPassword ? 'text' : 'password'}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="form-control"
                            placeholder="Masukkan kata sandi baru jika ingin mereset..."
                            style={{ paddingRight: '36px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer Modal Actions */}
                    <div
                      className="modal-footer"
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        padding: '14px 20px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        backgroundColor: 'var(--bg-inner)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setIsEditUserOpen(false)}
                        className="btn-dark"
                        disabled={editSaving}
                        style={{ padding: '8px 16px', fontSize: '12.5px' }}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={editSaving}
                        style={{
                          padding: '8px 18px',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Save size={14} />
                        <span>{editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: MASTER KPI */}
        {activeTab === 'kpi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Filter Departemen:</span>
              <select
                className="filter-select"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '220px' }}
              >
                <option value="ALL">Semua Departemen (Semua Indikator)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} style={{ background: '#122137' }}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Indikator</th>
                    <th>Departemen</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'center' }}>Satuan</th>
                    <th style={{ textAlign: 'center' }}>Arah Target</th>
                    <th style={{ textAlign: 'right' }}>Target Standar</th>
                    <th style={{ textAlign: 'center' }}>KPI Utama</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndicators.map((ind) => (
                    <tr key={ind.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>{ind.code}</td>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        <div>{ind.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ind.formula_desc || 'Target operasional tahunan'}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {departments.find(d => d.id === ind.department_id)?.code || ind.department_id}
                        </span>
                      </td>
                      <td>{ind.category}</td>
                      <td style={{ textAlign: 'center' }}>{ind.unit}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                          {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{ind.default_target.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'center' }}>
                        {ind.is_core_kpi ? (
                          <span className="badge badge-green">Core KPI</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER BRANCHES */}
        {activeTab === 'branches' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Wilayah / Regional</th>
                  <th>Alamat Kantor</th>
                  <th>Telepon & Kontak</th>
                  <th>Dermaga (m)</th>
                  <th>Kolam (mLWS)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{b.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.name}</td>
                    <td style={{ color: '#cbd5e1' }}>{b.region}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px' }}>{b.address}</td>
                    <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{b.phone}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{(b.facilities?.dermaga_length_m || 0).toLocaleString('id-ID')} m</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.facilities?.kolam_depth_mlws || 0} mLWS</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: MASTER DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Departemen</th>
                  <th>PIC Penanggung Jawab</th>
                  <th>Email PIC</th>
                  <th>Deskripsi Tugas & Ruang Lingkup</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{d.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.name}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.pic_name}</td>
                    <td style={{ fontSize: '12px', color: '#38bdf8' }}>{d.pic_email}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{d.description}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: MASTER EQUIPMENT */}
        {activeTab === 'equipment' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode Alat</th>
                  <th>Nama Peralatan</th>
                  <th style={{ textAlign: 'center' }}>Singkatan</th>
                  <th>Kategori Operasional</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{eq.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{eq.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {eq.acronym}
                      </span>
                    </td>
                    <td style={{ color: '#cbd5e1' }}>{eq.category}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* TAB 5: PARAMETER SISTEM */}
        {activeTab === 'parameter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header info banner */}
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
                    color: 'var(--blue-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sliders size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                    Konfigurasi Parameter Sistem, Database & Integrasi
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                    Kelola batas waktu sesi, lokasi penyimpanan database (dapat diedit jika lokasi file/server berubah), dan kredensial integrasi cloud.
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
                <span className="badge badge-orange" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}>
                  <UploadCloud size={13} />
                  <span>Sync: {googleDriveEmailInput}</span>
                </span>
              </div>
            </div>

            {/* Notification messages */}
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
                  color: 'var(--accent-green, #16a34a)',
                  fontSize: '13px',
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
                  color: 'var(--accent-red, #dc2626)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={18} />
                <span>{paramErrorMsg}</span>
              </div>
            )}

            {/* SECTION 1: KEAMANAN SESI & TAMPILAN DEFAULT */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Clock size={16} color="var(--blue-primary)" />
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Kebijakan Sesi & Preferensi Tampilan
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
                {/* Card 1: Session Timeout Duration */}
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
                    <Clock size={18} color="var(--blue-primary)" />
                    <h5 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                      Batas Waktu Sesi (Inactivity Timeout)
                    </h5>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    Jika tidak ada aktivitas pengguna selama durasi ini, aplikasi otomatis keluar dan kembali ke menu login.
                  </p>

                  {/* Preset Chips */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Pilihan Preset Waktu:
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
                            fontSize: '11.5px',
                            fontWeight: 700,
                            border: sessionTimeoutInput === mins ? '1px solid var(--blue-primary)' : '1px solid var(--border-subtle)',
                            backgroundColor: sessionTimeoutInput === mins ? 'rgba(2, 132, 199, 0.18)' : 'var(--bg-inner)',
                            color: sessionTimeoutInput === mins ? 'var(--blue-primary)' : 'var(--text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {mins}m {mins === 30 ? '(Default)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Number */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      Kustom Durasi:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={sessionTimeoutInput}
                      onChange={(e) => setSessionTimeoutInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="form-input"
                      style={{ width: '85px', textAlign: 'center', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menit</span>
                  </div>
                </div>

                {/* Card 2: Auto-Logout Policy & Warning */}
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
                    <Shield size={18} color="var(--blue-primary)" />
                    <h5 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                      Kebijakan Logout & Notifikasi
                    </h5>
                  </div>

                  {/* Toggle Auto-Logout */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="chk-auto-logout"
                      checked={autoLogoutInput}
                      onChange={(e) => setAutoLogoutInput(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="chk-auto-logout" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-title)' }}>
                        Aktifkan Auto-Logout saat Idle
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Kembali ke menu login jika tidak ada aktivitas pengguna.
                      </div>
                    </label>
                  </div>

                  {/* Warning Timing */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
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

                {/* Card 3: Default Theme Mode */}
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
                    <Sun size={18} color="var(--accent-orange, #f59e0b)" />
                    <h5 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                      Mode Tampilan Bawaan (Theme)
                    </h5>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    Pilih tema bawaan saat aplikasi pertama kali dibuka oleh pengguna baru.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setDefaultThemeInput('light')}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: defaultThemeInput === 'light' ? '2px solid var(--blue-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: defaultThemeInput === 'light' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-inner)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Sun size={20} color="#f59e0b" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                        Mode Terang
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent-green, #16a34a)', fontWeight: 700 }}>
                        ✓ Rekomendasi
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDefaultThemeInput('dark')}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: defaultThemeInput === 'dark' ? '2px solid var(--blue-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: defaultThemeInput === 'dark' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-inner)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Moon size={20} color="#38bdf8" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                        Mode Gelap
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Opsional
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: LOKASI & KONFIGURASI DATABASE (BISA DIEDIT/DISESUAIKAN) */}
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
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--accent-green, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <HardDrive size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                      2. Lokasi Database & Engine Penyimpanan (Bisa Disesuaikan)
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Konfigurasi lokasi file SQLite atau koneksi database. Jika lokasi database berubah, sesuaikan di sini tanpa perlu restart aplikasi.
                    </p>
                  </div>
                </div>

                {/* Engine Selector Buttons */}
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
                      border: dbEngineInput === 'sqlite' ? '1.5px solid var(--blue-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: dbEngineInput === 'sqlite' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                      color: dbEngineInput === 'sqlite' ? 'var(--blue-primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <HardDrive size={14} />
                    <span>SQLite (File Lokal / NAS)</span>
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
                      border: dbEngineInput === 'postgres' ? '1.5px solid var(--blue-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: dbEngineInput === 'postgres' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                      color: dbEngineInput === 'postgres' ? 'var(--blue-primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    <Server size={14} />
                    <span>PostgreSQL (Enterprise Server)</span>
                  </button>
                </div>
              </div>

              {/* Informational Guidance Box */}
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
                  <FolderCheck size={16} color="var(--accent-green, #10b981)" />
                  <span>Dukungan Relokasi File Database Dinamis</span>
                </div>
                Jika file database SQLite dipindahkan ke folder penyimpanan lain (misal: shared drive, external mount, atau folder backup seperti <code>/mnt/storage/ed_dashboard.db</code>), cukup ganti path di bawah dan klik <strong>Validasi Path</strong>. Sistem akan langsung mendeteksi dan membuka file tersebut secara dinamis.
              </div>

              {/* SQLITE CONFIGURATION VIEW */}
              {dbEngineInput === 'sqlite' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Lokasi File Path Database SQLite (.db):
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
                          fontFamily: 'monospace',
                          fontSize: '13px',
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
                          fontSize: '12.5px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {validatingPath ? <RefreshCw size={14} className="spin" /> : <FileCheck size={14} />}
                        <span>{validatingPath ? 'Memeriksa...' : 'Cek / Validasi Path'}</span>
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Preset Lokasi:</span>
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
                            fontSize: '11px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: dbSqlitePathInput === p ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-inner)',
                            color: dbSqlitePathInput === p ? 'var(--blue-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Path Validation Result Banner */}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: pathValidationResult.success ? 'var(--accent-green, #16a34a)' : 'var(--accent-red, #dc2626)' }}>
                        {pathValidationResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>
                          {pathValidationResult.success
                            ? 'Hasil Validasi: Lokasi Database Valid & Siap Digunakan'
                            : 'Hasil Validasi: Lokasi Database Tidak Valid'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>
                        {pathValidationResult.message || pathValidationResult.error}
                      </div>
                      {pathValidationResult.resolvedPath && (
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          <div><strong>Path Absolut:</strong> <code style={{ color: 'var(--text-main)' }}>{pathValidationResult.resolvedPath}</code></div>
                          <div><strong>Ukuran File:</strong> {pathValidationResult.sizeKb || 0} KB</div>
                          <div><strong>Akses Tulis Folder:</strong> <span style={{ color: pathValidationResult.isWritable ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{pathValidationResult.isWritable ? 'Tersedia (Writable)' : 'Tidak Tersedia'}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* POSTGRESQL CONFIGURATION VIEW */}
              {dbEngineInput === 'postgres' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Host / Server IP:
                      </label>
                      <input
                        type="text"
                        value={dbPgHostInput}
                        onChange={(e) => setDbPgHostInput(e.target.value)}
                        placeholder="localhost atau 10.x.x.x"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Port Database:
                      </label>
                      <input
                        type="number"
                        value={dbPgPortInput}
                        onChange={(e) => setDbPgPortInput(Number(e.target.value) || 5432)}
                        placeholder="5432"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Nama Database:
                      </label>
                      <input
                        type="text"
                        value={dbPgDatabaseInput}
                        onChange={(e) => setDbPgDatabaseInput(e.target.value)}
                        placeholder="ed_dashboard"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Username Database:
                      </label>
                      <input
                        type="text"
                        value={dbPgUserInput}
                        onChange={(e) => setDbPgUserInput(e.target.value)}
                        placeholder="postgres"
                        className="form-input"
                        style={{ width: '100%', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Password Database:
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showSecretCredentials ? 'text' : 'password'}
                          value={dbPgPasswordInput}
                          onChange={(e) => setDbPgPasswordInput(e.target.value)}
                          placeholder="Password database"
                          className="form-input"
                          style={{ width: '100%', fontSize: '12.5px', paddingRight: '32px' }}
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
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Max Pool Connections:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={dbMaxConnInput}
                        onChange={(e) => setDbMaxConnInput(Number(e.target.value) || 10)}
                        className="form-input"
                        style={{ width: '100%', fontSize: '12.5px' }}
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
                      Gunakan Enkripsi Koneksi SSL / TLS (Wajib untuk Cloud DB / AWS RDS / Google Cloud SQL)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: KREDENSIAL & INTEGRASI LAYANAN */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={16} color="var(--blue-primary)" />
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    3. Kredensial & Integrasi Eksternal (Google Cloud & Gateway)
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
                    fontSize: '11.5px',
                  }}
                >
                  {showSecretCredentials ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showSecretCredentials ? 'Sembunyikan Nilai Kunci' : 'Tampilkan Nilai Kunci'}</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Card A: Google Drive Sync */}
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
                        backgroundColor: 'rgba(234, 88, 12, 0.15)',
                        color: 'var(--accent-orange, #ea580c)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UploadCloud size={16} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                        Integrasi Google Drive (My Drive)
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sinkronisasi berkas input Excel</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Email Akun Google Drive:
                    </label>
                    <input
                      type="email"
                      value={googleDriveEmailInput}
                      onChange={(e) => setGoogleDriveEmailInput(e.target.value)}
                      placeholder="regdashr@gmail.com"
                      className="form-input"
                      style={{ width: '100%', fontSize: '12.5px', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Path File Excel Input Terintegrasi:
                    </label>
                    <input
                      type="text"
                      value={googleDriveFilePathInput}
                      onChange={(e) => setGoogleDriveFilePathInput(e.target.value)}
                      placeholder="data/input_data.xlsx"
                      className="form-input"
                      style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      File ini yang disinkronkan langsung dari cloud drive Regional 4 ke server PortDash.
                    </div>
                  </div>
                </div>

                {/* Card B: Google Sheets API */}
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
                        color: 'var(--accent-green, #16a34a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                        Google Sheets API (Spreadsheet Online)
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sinkronisasi data multi-cabang online</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Spreadsheet ID:
                    </label>
                    <input
                      type="text"
                      value={googleSheetsIdInput}
                      onChange={(e) => setGoogleSheetsIdInput(e.target.value)}
                      placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      className="form-input"
                      style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Nama Sheet / Tab:
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
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Google API Key:
                      </label>
                      <input
                        type={showSecretCredentials ? 'text' : 'password'}
                        value={googleApiKeyInput}
                        onChange={(e) => setGoogleApiKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card C: Pelindo Enterprise API Gateway */}
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
                        color: 'var(--blue-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Globe size={16} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                        Pelindo Enterprise API Gateway
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Integrasi sistem holding & regional</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      URL Endpoint Gateway:
                    </label>
                    <input
                      type="url"
                      value={apiGatewayUrlInput}
                      onChange={(e) => setApiGatewayUrlInput(e.target.value)}
                      placeholder="https://api.pelindo.co.id/v1/r4"
                      className="form-input"
                      style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Bearer Token / API Secret:
                    </label>
                    <input
                      type={showSecretCredentials ? 'text' : 'password'}
                      value={apiGatewayTokenInput}
                      onChange={(e) => setApiGatewayTokenInput(e.target.value)}
                      placeholder="Bearer eyJhbGciOi..."
                      className="form-input"
                      style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: STATUS PENYIMPANAN & RINGKASAN AUDIT */}
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
                <Database size={18} color="var(--blue-primary)" />
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                  4. Status Penyimpanan & Ringkasan Audit Sistem
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px', marginTop: '4px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '3px' }}>Engine Database Aktif:</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {dbEngineInput === 'sqlite' ? `SQLite (${dbSqlitePathInput})` : `PostgreSQL (${dbPgHostInput}:${dbPgPortInput}/${dbPgDatabaseInput})`}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '3px' }}>Multi-Tab Sync Listener:</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-green, #16a34a)' }}>
                    Aktif (localStorage portsight_last_activity)
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '3px' }}>Terakhir Diperbarui:</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {systemParams?.updated_at ? new Date(systemParams.updated_at).toLocaleString('id-ID') : 'Bawaan Sistem'}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '3px' }}>Diperbarui Oleh:</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {systemParams?.updated_by || 'Admin Regional'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
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
                style={{ fontSize: '13px' }}
              >
                Reset ke Parameter Rekomendasi
              </button>

              <button
                type="button"
                onClick={handleSaveParams}
                disabled={paramSaving}
                className="btn btn-primary"
                style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {paramSaving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                <span>{paramSaving ? 'Menyimpan...' : 'Simpan Parameter Sistem'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
