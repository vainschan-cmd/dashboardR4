'use client';

import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  UserPlus,
  Download,
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
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import AuthModal from '@/components/auth/AuthModal';

interface UsersPicTabProps {
  users: User[];
  onRefreshUsers?: () => void;
}

export default function UsersPicTab({ users, onRefreshUsers }: UsersPicTabProps) {
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

  // In-app delete confirmation state (replacing native confirm/alert)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dual sync state
  const [pullingDrive, setPullingDrive] = useState(false);
  const [pushingDrive, setPushingDrive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          message: data.message || `Data berhasil dimuat dari berkas master_user_pic.xlsx (${data.totalUsers} PIC).`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal memuat data dari spreadsheet: ${data.error}`,
        });
      }
    } catch (e: unknown) {
      setSyncStatus({
        type: 'error',
        message: `Gagal memuat data: ${e instanceof Error ? e.message : 'Kesalahan jaringan'}`,
      });
    } finally {
      setPullingDrive(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

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
          message: `Berkas lokal data/master_user_pic.xlsx telah diperbarui (${data.totalUsers} PIC).`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal mengekspor ke berkas spreadsheet: ${data.error}`,
        });
      }
    } catch (e: unknown) {
      setSyncStatus({
        type: 'error',
        message: `Gagal mengekspor data: ${e instanceof Error ? e.message : 'Kesalahan jaringan'}`,
      });
    } finally {
      setPushingDrive(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

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
          message: data.message || `Berkas ${file.name} berhasil diimpor.`,
        });
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncStatus({
          type: 'error',
          message: `Gagal mengimpor berkas: ${data.error}`,
        });
      }
    } catch (err: unknown) {
      setSyncStatus({
        type: 'error',
        message: `Gagal mengunggah berkas: ${err instanceof Error ? err.message : 'Kesalahan jaringan'}`,
      });
    } finally {
      setPullingDrive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editDivisi.trim() || !editDepartemen.trim()) {
      setEditError('Kolom Nama, Divisi, dan Departemen wajib diisi.');
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
          message: `Data PIC ${editName} (NIPP: ${editNipp}) telah diperbarui dan disinkronkan ke master_user_pic.xlsx.`,
        });
        if (onRefreshUsers) onRefreshUsers();
        setTimeout(() => setSyncStatus(null), 4500);
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(pendingDeleteUser.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: `Akun PIC ${pendingDeleteUser.name} telah dihapus dan berkas master_user_pic.xlsx telah diperbarui.`,
        });
        if (onRefreshUsers) onRefreshUsers();
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        setSyncStatus({
          type: 'error',
          message: data.error || 'Gagal menghapus akun pengguna.',
        });
      }
    } catch (e: unknown) {
      setSyncStatus({
        type: 'error',
        message: e instanceof Error ? e.message : 'Gagal menghapus akun pengguna.',
      });
    } finally {
      setDeleting(false);
      setPendingDeleteUser(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              backgroundColor: 'rgba(2, 132, 199, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
            }}
          >
            <FileSpreadsheet size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
              Berkas Master Pengguna & PIC (master_user_pic.xlsx)
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Tersimpan di direktori lokal <strong>data/master_user_pic.xlsx</strong> | Siap diekspor untuk cadangan eksternal
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
            <UserPlus size={14} strokeWidth={1.75} />
            <span>Tambah PIC Baru</span>
          </button>

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
              borderColor: 'rgba(2, 132, 199, 0.4)',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              color: 'var(--accent-blue)',
              fontWeight: 600,
            }}
            title="Muat ulang daftar PIC dari berkas lokal master_user_pic.xlsx"
          >
            <ArrowDownToLine size={13} className={pullingDrive ? 'spin' : ''} />
            <span>{pullingDrive ? 'Memuat Data...' : 'Muat dari Spreadsheet'}</span>
          </button>

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
              color: 'var(--status-good-text)',
              fontWeight: 600,
            }}
            title="Ekspor daftar PIC aktif ke berkas lokal master_user_pic.xlsx"
          >
            <UploadCloud size={13} className={pushingDrive ? 'spin' : ''} />
            <span>{pushingDrive ? 'Mengekspor...' : 'Ekspor ke Spreadsheet'}</span>
          </button>

          <a
            href="/api/users/export"
            download="master_user_pic.xlsx"
            className="btn-dark"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            title="Unduh berkas spreadsheet Excel master PIC"
          >
            <Download size={13} />
            <span>Unduh .xlsx</span>
          </a>

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
            title="Unggah berkas .xlsx PIC dari komputer"
          >
            <Upload size={12} />
            <span>Unggah .xlsx</span>
          </button>
        </div>
      </div>

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
            color: syncStatus.type === 'success' ? 'var(--status-good-text)' : 'var(--status-danger-text)',
            fontSize: '12px',
          }}
        >
          {syncStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{syncStatus.message}</span>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>NIPP</th>
              <th>Nama Pegawai</th>
              <th>Divisi</th>
              <th>Departemen</th>
              <th>Hak Akses / Peran</th>
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
                  <td className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
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
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          backgroundColor: 'rgba(2, 132, 199, 0.12)',
                          border: '1px solid rgba(2, 132, 199, 0.35)',
                          borderRadius: '5px',
                          color: 'var(--accent-blue)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title={`Ubah data PIC ${u.name}`}
                      >
                        <Edit2 size={12} />
                        <span>Ubah</span>
                      </button>

                      {u.username !== '10001' && u.username !== 'superadmin' ? (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteUser({ id: u.id, name: u.name })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '5px',
                            color: 'var(--status-danger-text)',
                            cursor: 'pointer',
                          }}
                          title={`Hapus pengguna ${u.name}`}
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
                  Belum ada data PIC yang terdaftar. Pilih tombol &ldquo;Tambah PIC Baru&rdquo; untuk mendaftarkan akun.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* In-app Delete Confirmation Dialog */}
      {pendingDeleteUser && (
        <div className="modal-overlay" onClick={() => !deleting && setPendingDeleteUser(null)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Penghapusan Akun PIC"
            style={{ maxWidth: '420px', width: '100%', backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '14px 18px' }}>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-title)' }}>
                Konfirmasi Penghapusan Akun PIC
              </h3>
              <button
                type="button"
                aria-label="Tutup konfirmasi penghapusan"
                onClick={() => setPendingDeleteUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus akun PIC <strong>{pendingDeleteUser.name}</strong> dari sistem dan berkas master?
            </div>
            <div
              className="modal-footer"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                backgroundColor: 'var(--bg-inner)',
              }}
            >
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="btn-dark"
                disabled={deleting}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deleting}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {deleting ? 'Menghapus...' : 'Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        currentUser={null}
        initialMode="register"
        onLoginSuccess={() => {
          if (onRefreshUsers) onRefreshUsers();
        }}
      />

      {isEditUserOpen && editingUser && (
        <div className="modal-overlay" onClick={() => setIsEditUserOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '580px', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
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
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-title)' }}>
                    Ubah Data Pegawai / PIC
                  </h3>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    NIPP: <strong style={{ color: 'var(--accent-blue)' }}>{editingUser.nipp || editingUser.username}</strong> | ID Akun: {editingUser.id}
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
                      color: 'var(--status-danger-text)',
                      fontSize: '12px',
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{editError}</span>
                  </div>
                )}

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
                      <option value="active">Aktif (Dapat Masuk & Akses)</option>
                      <option value="inactive">Nonaktif (Akses Dinonaktifkan)</option>
                    </select>
                  </div>
                </div>

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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', display: 'block', marginBottom: '6px' }}>
                      Hak Akses / Peran
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
                      placeholder="Masukkan kata sandi baru jika ingin mengatur ulang"
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
  );
}

