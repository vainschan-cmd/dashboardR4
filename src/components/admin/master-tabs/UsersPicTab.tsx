'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  AlertCircle,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { User, Department } from '@/lib/types';
import { CANONICAL_ROLES_METADATA, RoleMetadata } from '@/lib/roleDefinitions';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import UserFormDrawer from './UserFormDrawer';

interface UsersPicTabProps {
  users: User[];
  departments?: Department[];
  onRefreshUsers?: () => void;
  currentUser?: User | null;
  onNavigateToRoles?: () => void;
}

export default function UsersPicTab({
  users,
  departments = [],
  onRefreshUsers,
  currentUser,
  onNavigateToRoles,
}: UsersPicTabProps) {
  const canManageUsers =
    !currentUser || currentUser.role === 'super_admin' || currentUser.role === 'admin_regional';

  // Full role metadata (initialized with canonical system roles, hydrated from /api/roles)
  const [availableRoles, setAvailableRoles] = useState<RoleMetadata[]>(CANONICAL_ROLES_METADATA);

  useEffect(() => {
    let active = true;
    fetch('/api/roles', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.roles) && data.roles.length > 0) {
          setAvailableRoles(data.roles);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Unified Slide-Over Drawer state (Add / Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // In-app delete confirmation state
  const [pendingDeleteUser, setPendingDeleteUser] = useState<{ id: string; name: string } | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(deleteDialogRef, Boolean(pendingDeleteUser), () => {
    if (!deleting) setPendingDeleteUser(null);
  });

  // Dual sync state
  const [pullingDrive, setPullingDrive] = useState(false);
  const [pushingDrive, setPushingDrive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setDrawerMode('add');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleDrawerSuccess = (message: string) => {
    setSyncStatus({ type: 'success', message });
    if (onRefreshUsers) onRefreshUsers();
    setTimeout(() => setSyncStatus(null), 5000);
  };

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
          message:
            data.message ||
            `Data berhasil dimuat dari berkas master_user_pic.xlsx (${data.totalUsers} PIC).`,
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

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(pendingDeleteUser.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
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
              color: 'var(--accent-blue-text)',
            }}
          >
            <FileSpreadsheet size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
              Berkas Master Pengguna &amp; PIC (master_user_pic.xlsx)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Tersimpan di direktori lokal <strong>data/master_user_pic.xlsx</strong> | Siap
              diekspor untuk cadangan eksternal
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {canManageUsers && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              <span>Tambah PIC Baru</span>
            </button>
          )}

          {onNavigateToRoles && (
            <button
              type="button"
              onClick={onNavigateToRoles}
              className="btn-dark"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--border-subtle)',
              }}
              title="Kelola Struktur Peran & Matriks Hak Akses (RBAC)"
            >
              <ShieldCheck size={14} style={{ color: 'var(--accent-blue-text)' }} />
              <span>Kelola Peran &amp; Hak Akses</span>
            </button>
          )}

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
              color: 'var(--accent-blue-text)',
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
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
            }}
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
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              opacity: 0.85,
            }}
            title="Unggah berkas .xlsx PIC dari komputer"
          >
            <Upload size={12} />
            <span>Unggah .xlsx</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 14px',
            backgroundColor:
              syncStatus.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              syncStatus.type === 'success'
                ? 'var(--status-good-border)'
                : 'var(--status-danger-border)'
            }`,
            borderRadius: '6px',
            color:
              syncStatus.type === 'success'
                ? 'var(--status-good-text)'
                : 'var(--status-danger-text)',
            fontSize: '12px',
          }}
        >
          {syncStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{syncStatus.message}</span>
        </div>
      )}

      <div className="table-responsive">
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '120px' }}>
                NIPP
              </th>
              <th scope="col">Nama Pegawai</th>
              <th scope="col">Divisi</th>
              <th scope="col">Departemen</th>
              <th scope="col">Hak Akses / Peran</th>
              <th scope="col">Penugasan Cabang</th>
              <th scope="col" style={{ textAlign: 'center' }}>
                Status
              </th>
              <th scope="col" style={{ textAlign: 'center', width: '120px' }}>
                Aksi
              </th>
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
              const customMatch = availableRoles.find((r) => r.id === u.role);
              const roleInfo = roleLabels[u.role] || {
                label: customMatch ? customMatch.name : u.role,
                badge: 'badge-blue',
              };

              return (
                <tr key={u.id}>
                  <td
                    data-label="NIPP"
                    className="tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--accent-blue-text)',
                    }}
                  >
                    {u.nipp || u.username}
                  </td>
                  <td
                    data-label="Nama Pegawai"
                    style={{ fontWeight: 600, color: 'var(--text-title)' }}
                  >
                    {u.name}
                  </td>
                  <td
                    data-label="Divisi"
                    style={{ color: 'var(--text-secondary)', fontSize: '12px' }}
                  >
                    {u.divisi || '-'}
                  </td>
                  <td
                    data-label="Departemen"
                    style={{ color: 'var(--text-secondary)', fontSize: '12px' }}
                  >
                    {u.departemen || '-'}
                  </td>
                  <td data-label="Hak Akses / Peran">
                    <span className={`badge ${roleInfo.badge}`}>{roleInfo.label}</span>
                  </td>
                  <td
                    data-label="Penugasan Cabang"
                    style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    {u.branch_id ? u.branch_id : 'Regional 4 (Pusat)'}
                  </td>
                  <td data-label="Status" style={{ textAlign: 'center' }}>
                    <span className={`badge ${u.active ? 'badge-green' : 'badge-neutral'}`}>
                      {u.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    {u.must_change_password && (
                      <span
                        className="badge badge-yellow"
                        style={{ marginLeft: '6px' }}
                        title="Kata sandi akun ini dibuat oleh administrator dan harus diganti pengguna saat login berikutnya."
                      >
                        Wajib ganti sandi
                      </span>
                    )}
                  </td>
                  <td data-label="Aksi" style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
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
                          color: 'var(--accent-blue-text)',
                          fontSize: '12px',
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
                          aria-label={`Hapus pengguna ${u.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sistem</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  data-label="Informasi"
                  style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}
                >
                  Belum ada data PIC yang terdaftar. Pilih tombol &ldquo;Tambah PIC Baru&rdquo;
                  untuk mendaftarkan akun.
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
            ref={deleteDialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Penghapusan Akun PIC"
            tabIndex={-1}
            style={{
              maxWidth: '420px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{ borderBottom: '1px solid var(--border-subtle)', padding: '14px 18px' }}
            >
              <h3
                className="modal-title"
                style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}
              >
                Konfirmasi Penghapusan Akun PIC
              </h3>
              <button
                type="button"
                aria-label="Tutup konfirmasi penghapusan"
                onClick={() => setPendingDeleteUser(null)}
                className="admin-close-btn"
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="modal-body"
              style={{
                padding: '18px',
                fontSize: '12px',
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              Apakah Anda yakin ingin menghapus akun PIC <strong>{pendingDeleteUser.name}</strong>{' '}
              dari sistem dan berkas master?
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
                  backgroundColor: 'var(--status-danger-border)',
                  color: 'var(--text-on-accent)',
                  cursor: 'pointer',
                }}
              >
                {deleting ? 'Menghapus...' : 'Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Right Slide-Over Drawer for Add / Edit User */}
      <UserFormDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        editingUser={editingUser}
        existingUsers={users}
        availableRoles={availableRoles}
        departments={departments}
        onClose={() => {
          setDrawerOpen(false);
          setEditingUser(null);
        }}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
}
