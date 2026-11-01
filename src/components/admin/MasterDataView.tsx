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
  Upload
} from 'lucide-react';
import { Branch, Department, KPIIndicator, EquipmentItem, User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import AuthModal from '@/components/auth/AuthModal';

interface MasterDataViewProps {
  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment?: EquipmentItem[];
  users?: User[];
  onRefreshUsers?: () => void;
}

export default function MasterDataView({
  branches,
  departments,
  indicators,
  equipment = [],
  users = [],
  onRefreshUsers,
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'branches' | 'departments' | 'equipment' | 'users'>('users');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

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
      </div>
    </div>
  );
}
