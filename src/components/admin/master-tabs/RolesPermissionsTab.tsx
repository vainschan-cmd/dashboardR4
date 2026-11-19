'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  Users,
  Check,
  Minus,
  Edit2,
  Eye,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import { User } from '@/lib/types';
import {
  RoleMetadata,
  CANONICAL_ROLES_METADATA,
  PERMISSION_GROUPS,
  TOTAL_SYSTEM_PERMISSIONS,
} from '@/lib/roleDefinitions';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import RoleFormModal from './RoleFormModal';

interface RolesPermissionsTabProps {
  currentUser?: User | null;
  onRolesUpdated?: () => void;
}

export default function RolesPermissionsTab({
  currentUser,
  onRolesUpdated,
}: RolesPermissionsTabProps) {
  const canManageRoles =
    !currentUser || currentUser.role === 'super_admin' || currentUser.role === 'admin_regional';
  const [roles, setRoles] = useState<RoleMetadata[]>(CANONICAL_ROLES_METADATA);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'system' | 'custom'>('all');

  // Split-Pane Role Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [activeRole, setActiveRole] = useState<RoleMetadata | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<RoleMetadata | null>(null);

  // Delete confirmation
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RoleMetadata | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(deleteDialogRef, Boolean(pendingDeleteRole), () => {
    if (!deleting) setPendingDeleteRole(null);
  });

  // Load roles from API
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.roles)) {
        setRoles(data.roles);
      } else {
        setError(data.error || 'Gagal memuat data peran.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kesalahan jaringan saat memuat data peran.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/roles', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.roles) && data.roles.length > 0) {
          setRoles(data.roles);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Kesalahan jaringan.');
      });
    return () => {
      active = false;
    };
  }, []);

  const totalUsersAssigned = useMemo(() => {
    return roles.reduce((acc, r) => acc + (r.user_count || 0), 0);
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return roles.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [roles, searchTerm, selectedCategory]);

  const handleOpenAdd = () => {
    setActiveRole(null);
    setDuplicateSource(null);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenRole = (role: RoleMetadata) => {
    setDuplicateSource(null);
    setActiveRole(role);
    setModalMode(role.category === 'system' || !canManageRoles ? 'view' : 'edit');
    setIsModalOpen(true);
  };

  const handleDuplicateAsCustom = (source: RoleMetadata) => {
    setActiveRole(null);
    setDuplicateSource(source);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleModalSuccess = async (message: string) => {
    setSuccessBanner(message);
    await fetchRoles();
    if (onRolesUpdated) onRolesUpdated();
    setTimeout(() => setSuccessBanner(null), 4500);
  };

  const handleDeleteRole = async () => {
    if (!pendingDeleteRole) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/roles?id=${encodeURIComponent(pendingDeleteRole.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Gagal menghapus peran.');
        return;
      }

      setSuccessBanner(`Peran '${pendingDeleteRole.name}' berhasil dihapus.`);
      setPendingDeleteRole(null);
      await fetchRoles();
      if (onRolesUpdated) onRolesUpdated();
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kesalahan jaringan saat menghapus peran.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Notification Banners */}
      {successBanner && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--status-good-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-title)',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--status-good-text)' }} />
          <span style={{ fontWeight: 600 }}>{successBanner}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger-text)',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--status-danger-text)',
              cursor: 'pointer',
            }}
            aria-label="Tutup pesan galat"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: 'var(--bg-inner)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(2, 132, 199, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue-text)',
            }}
          >
            <ShieldCheck size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
              Struktur Peran &amp; Hak Akses (Role-Based Access Control)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Kelola definisi peran, batas cakupan kewenangan regional/cabang, serta konfigurasi
              matriks izin per modul.
            </div>
          </div>
        </div>

        {canManageRoles && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
          >
            <ShieldPlus size={15} strokeWidth={2} />
            <span>Tambah Role Baru</span>
          </button>
        )}
      </div>

      {/* Stat KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--bg-inner)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Peran Terdaftar
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-title)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {roles.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--accent-blue-text)', marginTop: '2px' }}>
            {roles.filter((r) => r.category === 'system').length} Sistem Inti +{' '}
            {roles.filter((r) => r.category === 'custom').length} Kustom
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--bg-inner)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Pengguna Aktif
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-title)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalUsersAssigned}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--status-good-text)', marginTop: '2px' }}>
            Terpetakan ke akun resmi Pelindo
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--bg-inner)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Hak Akses Sistem
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-title)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {TOTAL_SYSTEM_PERMISSIONS} Izin Granular
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tersebar di {PERMISSION_GROUPS.length} kelompok modul operasional
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1',
            minWidth: '260px',
            maxWidth: '420px',
          }}
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Cari peran, kode unik, atau deskripsi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px' }}
              aria-label="Cari peran"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`role-preset-chip ${selectedCategory === 'all' ? 'active' : ''}`}
          >
            Semua ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('system')}
            className={`role-preset-chip ${selectedCategory === 'system' ? 'active' : ''}`}
          >
            Sistem Inti ({roles.filter((r) => r.category === 'system').length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('custom')}
            className={`role-preset-chip ${selectedCategory === 'custom' ? 'active' : ''}`}
          >
            Kustom ({roles.filter((r) => r.category === 'custom').length})
          </button>
        </div>
      </div>

      {/* Roles Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '14px',
        }}
      >
        {filteredRoles.map((role) => {
          const isSystem = role.category === 'system';
          const scopeLabels = {
            global: 'Seluruh Cabang (Global)',
            regional: 'Regional 4 (Pusat)',
            cabang: 'Penugasan Cabang / Terminal',
          };

          return (
            <div
              key={role.id}
              style={{
                backgroundColor: 'var(--bg-inner)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                position: 'relative',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
                      {role.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--accent-blue-text)',
                        marginTop: '2px',
                        fontWeight: 600,
                      }}
                    >
                      {role.id}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span className={`badge ${isSystem ? 'badge-blue' : 'badge-yellow'}`}>
                      {isSystem ? 'Sistem Inti' : 'Peran Kustom'}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginTop: '8px',
                    lineHeight: '1.45',
                    minHeight: '36px',
                  }}
                >
                  {role.description || 'Tidak ada deskripsi rinci.'}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '10px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>
                    Cakupan:{' '}
                    <strong style={{ color: 'var(--text-title)' }}>{scopeLabels[role.scope]}</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Users size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-title)', fontWeight: 600 }}>
                    {role.user_count || 0} Pengguna
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    • {role.permissions.length} Izin
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenRole(role)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      border: '1px solid rgba(2, 132, 199, 0.3)',
                      color: 'var(--accent-blue-text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title={isSystem ? 'Lihat Detail Izin Peran Sistem' : 'Ubah Peran Kustom'}
                  >
                    {isSystem ? <Eye size={12} /> : <Edit2 size={12} />}
                    <span>{isSystem ? 'Lihat' : 'Edit'}</span>
                  </button>

                  {isSystem && canManageRoles && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateAsCustom(role)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '5px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      title={`Duplikasi ${role.name} menjadi peran kustom baru`}
                    >
                      <Copy size={12} />
                      <span>Duplikasi</span>
                    </button>
                  )}

                  {!isSystem && canManageRoles && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteRole(role)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '5px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: 'var(--status-danger-text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      title="Hapus Peran Kustom"
                    >
                      <Trash2 size={12} />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RBAC Permission Matrix Section */}
      <div
        style={{
          marginTop: '10px',
          backgroundColor: 'var(--bg-inner)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
              Matriks Hak Akses Granular (Permission Matrix)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Pemetaan lengkap kewenangan akses setiap peran terhadap {TOTAL_SYSTEM_PERMISSIONS}{' '}
              izin pada {PERMISSION_GROUPS.length} modul PortSight.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={12} style={{ color: 'var(--status-good-text)' }} strokeWidth={2.5} />
              </div>
              <span style={{ color: 'var(--text-secondary)' }}>Diizinkan</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(148, 163, 184, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Minus size={12} style={{ color: 'var(--text-muted)' }} />
              </div>
              <span style={{ color: 'var(--text-muted)' }}>Ditolak</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
          <table
            className="card-table data-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
          >
            <thead
              style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}
            >
              <tr>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    minWidth: '220px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'var(--bg-card)',
                    zIndex: 3,
                  }}
                >
                  Kelompok &amp; Nama Hak Akses
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    scope="col"
                    style={{
                      textAlign: 'center',
                      padding: '10px 12px',
                      minWidth: '110px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>{r.name}</div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {r.id}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <React.Fragment key={group.name}>
                  <tr style={{ backgroundColor: 'rgba(2, 132, 199, 0.05)' }}>
                    <td
                      colSpan={roles.length + 1}
                      data-label="Kategori Modul"
                      style={{
                        padding: '8px 14px',
                        fontWeight: 700,
                        color: 'var(--accent-blue-text)',
                        borderTop: '1px solid var(--border-subtle)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      {group.name} —{' '}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                        {group.description}
                      </span>
                    </td>
                  </tr>

                  {group.permissions.map((perm) => (
                    <tr key={perm.key}>
                      <td
                        data-label="Hak Akses"
                        style={{
                          padding: '10px 14px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: 'var(--bg-inner)',
                          zIndex: 1,
                          borderRight: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                          {perm.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {perm.description}
                        </div>
                      </td>

                      {roles.map((r) => {
                        const granted = r.permissions.includes(perm.key);
                        return (
                          <td
                            key={`${r.id}_${perm.key}`}
                            data-label={r.name}
                            style={{ textAlign: 'center', padding: '10px 12px' }}
                          >
                            {granted ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                                  color: 'var(--status-good-text)',
                                }}
                                title={`${r.name}: Diizinkan`}
                              >
                                <Check size={14} strokeWidth={2.5} />
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '6px',
                                  color: 'var(--text-muted)',
                                }}
                                title={`${r.name}: Ditolak`}
                              >
                                <Minus size={14} />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wide Split-Pane Role Modal (Add / Edit / View Read-Only) */}
      <RoleFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialRole={activeRole}
        duplicateSource={duplicateSource}
        existingRoles={roles}
        onClose={() => {
          setIsModalOpen(false);
          setActiveRole(null);
          setDuplicateSource(null);
        }}
        onDuplicateAsCustom={handleDuplicateAsCustom}
        onSuccess={handleModalSuccess}
      />

      {/* Modal Konfirmasi Hapus Role */}
      {pendingDeleteRole && (
        <div className="modal-overlay" onClick={() => !deleting && setPendingDeleteRole(null)}>
          <div
            ref={deleteDialogRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi Hapus Peran"
            tabIndex={-1}
            style={{ maxWidth: '440px', width: '100%', backgroundColor: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--status-danger-text)',
                  }}
                >
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--text-title)',
                    }}
                  >
                    Konfirmasi Hapus Peran
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteRole(null)}
                className="admin-close-btn"
                aria-label="Tutup konfirmasi hapus peran"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: 'var(--text-title)',
                  lineHeight: '1.5',
                }}
              >
                Apakah Anda yakin ingin menghapus peran kustom{' '}
                <strong>{pendingDeleteRole.name}</strong> ({pendingDeleteRole.id})?
              </p>
              {pendingDeleteRole.user_count && pendingDeleteRole.user_count > 0 ? (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--status-danger-text)',
                  }}
                >
                  Peran ini masih digunakan oleh {pendingDeleteRole.user_count} pengguna dan tidak
                  dapat dihapus sebelum pengguna dialihkan.
                </div>
              ) : null}
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setPendingDeleteRole(null)}
                className="btn-dark"
                disabled={deleting}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                disabled={
                  deleting ||
                  (pendingDeleteRole.user_count ? pendingDeleteRole.user_count > 0 : false)
                }
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  backgroundColor: 'var(--status-danger-border)',
                  color: 'var(--text-on-accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Peran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
