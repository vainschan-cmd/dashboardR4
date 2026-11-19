'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  X,
  Save,
  AlertCircle,
  Sparkles,
  Search,
  Globe,
  Building2,
  Anchor,
  Copy,
  Lock,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Permission } from '@/lib/types';
import {
  RoleMetadata,
  PERMISSION_GROUPS,
  PERMISSION_RISK_MAP,
  PERMISSION_LABEL_MAP,
  TOTAL_SYSTEM_PERMISSIONS,
  ROLE_PRESETS,
  applyPermissionWithDependencies,
  PermissionRiskLevel,
} from '@/lib/roleDefinitions';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface RoleFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit' | 'view';
  initialRole: RoleMetadata | null;
  duplicateSource?: RoleMetadata | null;
  existingRoles: RoleMetadata[];
  onClose: () => void;
  onDuplicateAsCustom: (source: RoleMetadata) => void;
  onSuccess: (message: string) => void;
}

interface RoleFieldErrors {
  name?: string;
  id?: string;
  permissions?: string;
}

const SCOPE_OPTIONS: {
  value: 'global' | 'regional' | 'cabang';
  title: string;
  description: string;
  icon: 'global' | 'regional' | 'cabang';
}[] = [
  {
    value: 'global',
    title: 'Global (28 Cabang)',
    description: 'Akses konsolidasi penuh lintas seluruh cabang Regional 4.',
    icon: 'global',
  },
  {
    value: 'regional',
    title: 'Regional 4 (Pusat)',
    description: 'Pengelolaan tingkat kantor pusat regional & verifikasi cabang.',
    icon: 'regional',
  },
  {
    value: 'cabang',
    title: 'Cabang / Terminal',
    description: 'Terbatas khusus pada data operasional cabang penugasan.',
    icon: 'cabang',
  },
];

const RISK_LABELS: Record<PermissionRiskLevel, string> = {
  read: 'Baca',
  write: 'Tulis',
  sensitive: 'Sensitif',
};

function slugifyRoleName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function RoleFormModal(props: RoleFormModalProps) {
  if (!props.isOpen) return null;
  const instanceKey = `${props.mode}_${props.initialRole?.id ?? 'none'}_${props.duplicateSource?.id ?? 'none'}`;
  return <RoleFormModalInner key={instanceKey} {...props} />;
}

function RoleFormModalInner({
  mode,
  initialRole,
  duplicateSource,
  existingRoles,
  onClose,
  onDuplicateAsCustom,
  onSuccess,
}: RoleFormModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isReadOnly = mode === 'view';

  const initialValues = useMemo(() => {
    if (mode === 'add' && duplicateSource) {
      const clonedName = `${duplicateSource.name} (Kustom)`;
      const baseSlug = `${duplicateSource.id}_kustom`;
      const existingIds = new Set(existingRoles.map((r) => r.id));
      let uniqueSlug = baseSlug;
      let counter = 2;
      while (existingIds.has(uniqueSlug)) {
        uniqueSlug = `${baseSlug}_${counter++}`;
      }
      return {
        name: clonedName,
        slugId: uniqueSlug,
        slugManuallyEdited: false,
        description: duplicateSource.description || '',
        scope: duplicateSource.scope,
        permissions: [...duplicateSource.permissions] as Permission[],
      };
    }
    if ((mode === 'edit' || mode === 'view') && initialRole) {
      return {
        name: initialRole.name,
        slugId: initialRole.id,
        slugManuallyEdited: true,
        description: initialRole.description || '',
        scope: initialRole.scope,
        permissions: [...initialRole.permissions] as Permission[],
      };
    }
    return {
      name: '',
      slugId: '',
      slugManuallyEdited: false,
      description: '',
      scope: 'regional' as const,
      permissions: ['dashboard:read', 'records:read', 'reports:export'] as Permission[],
    };
  }, [mode, initialRole, duplicateSource, existingRoles]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initialValues.name,
        slugId: initialValues.slugId,
        description: initialValues.description,
        scope: initialValues.scope,
        permissions: [...initialValues.permissions].sort(),
      }),
    [initialValues]
  );

  // Form state
  const [name, setName] = useState(initialValues.name);
  const [slugId, setSlugId] = useState(initialValues.slugId);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(initialValues.slugManuallyEdited);
  const [description, setDescription] = useState(initialValues.description);
  const [scope, setScope] = useState<'global' | 'regional' | 'cabang'>(initialValues.scope);
  const [permissions, setPermissions] = useState<Permission[]>(initialValues.permissions);

  // Right-pane filter & dependency helper state
  const [permSearch, setPermSearch] = useState('');
  const [permFilter, setPermFilter] = useState<'all' | 'active' | 'sensitive'>('all');
  const [depNotice, setDepNotice] = useState<string | null>(null);

  // Submission & validation
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RoleFieldErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isDirty = useMemo(() => {
    if (isReadOnly) return false;
    const current = JSON.stringify({
      name,
      slugId,
      description,
      scope,
      permissions: [...permissions].sort(),
    });
    return current !== initialSnapshot;
  }, [isReadOnly, name, slugId, description, scope, permissions, initialSnapshot]);

  const handleRequestClose = useCallback(() => {
    if (saving) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  }, [saving, isDirty, confirmDiscard, onClose]);

  useFocusTrap(modalRef, true, handleRequestClose);

  // Instant slug conflict check (only in Add mode)
  const slugConflictRole = useMemo(() => {
    if (mode !== 'add') return null;
    const clean = slugId.trim().toLowerCase();
    if (!clean) return null;
    return existingRoles.find((r) => r.id.toLowerCase() === clean) || null;
  }, [mode, slugId, existingRoles]);

  const sensitiveActiveCount = useMemo(
    () => permissions.filter((p) => PERMISSION_RISK_MAP[p] === 'sensitive').length,
    [permissions]
  );

  const totalSensitiveCount = useMemo(
    () =>
      PERMISSION_GROUPS.reduce(
        (acc, g) =>
          acc + g.permissions.filter((p) => PERMISSION_RISK_MAP[p.key] === 'sensitive').length,
        0
      ),
    []
  );

  const activePresetId = useMemo(() => {
    const sorted = [...permissions].sort().join('|');
    const matched = ROLE_PRESETS.find((preset) => [...preset.permissions].sort().join('|') === sorted);
    return matched ? matched.id : null;
  }, [permissions]);

  const filteredGroups = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    return PERMISSION_GROUPS.map((group) => {
      const perms = group.permissions.filter((perm) => {
        if (permFilter === 'active' && !permissions.includes(perm.key)) return false;
        if (permFilter === 'sensitive' && PERMISSION_RISK_MAP[perm.key] !== 'sensitive') return false;
        if (!q) return true;
        return (
          group.name.toLowerCase().includes(q) ||
          perm.label.toLowerCase().includes(q) ||
          perm.description.toLowerCase().includes(q) ||
          perm.key.toLowerCase().includes(q)
        );
      });
      return { ...group, permissions: perms };
    }).filter((g) => g.permissions.length > 0);
  }, [permSearch, permFilter, permissions]);

  const handleTogglePermission = (perm: Permission) => {
    if (isReadOnly) return;
    const { next, autoAdded } = applyPermissionWithDependencies(permissions, perm);
    setPermissions(next);
    if (fieldErrors.permissions) setFieldErrors((p) => ({ ...p, permissions: undefined }));

    if (autoAdded.length > 0) {
      const labels = autoAdded.map((k) => PERMISSION_LABEL_MAP[k] || k).join(', ');
      setDepNotice(`Izin prasyarat diaktifkan otomatis: ${labels}.`);
    } else {
      setDepNotice(null);
    }
  };

  const handleToggleGroup = (groupKeys: Permission[]) => {
    if (isReadOnly) return;
    const allSelected = groupKeys.every((k) => permissions.includes(k));
    if (allSelected) {
      setPermissions((prev) => prev.filter((k) => !groupKeys.includes(k)));
      setDepNotice(null);
    } else {
      let working = [...permissions];
      const addedDeps = new Set<Permission>();
      for (const key of groupKeys) {
        if (!working.includes(key)) {
          const res = applyPermissionWithDependencies(working, key);
          working = res.next;
          res.autoAdded.forEach((d) => {
            if (!groupKeys.includes(d)) addedDeps.add(d);
          });
        }
      }
      setPermissions(working);
      if (addedDeps.size > 0) {
        const labels = Array.from(addedDeps)
          .map((k) => PERMISSION_LABEL_MAP[k] || k)
          .join(', ');
        setDepNotice(`Izin prasyarat lintas modul ikut diaktifkan: ${labels}.`);
      } else {
        setDepNotice(null);
      }
    }
    if (fieldErrors.permissions) setFieldErrors((p) => ({ ...p, permissions: undefined }));
  };

  const handleApplyPreset = (presetId: 'auditor' | 'operator' | 'verifikator' | 'clear') => {
    if (isReadOnly) return;
    setDepNotice(null);
    if (presetId === 'clear') {
      setPermissions([]);
      return;
    }
    const found = ROLE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setPermissions([...found.permissions]);
      if (mode === 'add') {
        setScope(found.scope);
      }
      if (fieldErrors.permissions) setFieldErrors((p) => ({ ...p, permissions: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setServerError(null);
    setConfirmDiscard(false);

    const errors: RoleFieldErrors = {};
    if (!name.trim() || name.trim().length < 3) {
      errors.name = 'Nama peran wajib diisi (minimal 3 karakter).';
    }

    const cleanId = slugId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    if (mode === 'add') {
      if (cleanId.length < 3) {
        errors.id = 'Kode unik minimal 3 karakter huruf kecil, angka, atau garis bawah.';
      } else if (slugConflictRole) {
        errors.id = `Kode '${cleanId}' sudah digunakan oleh peran "${slugConflictRole.name}".`;
      }
    }

    if (permissions.length === 0) {
      errors.permissions = 'Pilih minimal 1 hak akses untuk peran ini.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/roles', {
        method: mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: mode === 'add' ? cleanId : initialRole?.id,
          name: name.trim(),
          description: description.trim(),
          scope,
          permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error || 'Gagal menyimpan konfigurasi peran.');
        return;
      }

      onSuccess(data.message || `Peran '${name.trim()}' berhasil disimpan.`);
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = Math.round((permissions.length / TOTAL_SYSTEM_PERMISSIONS) * 100);

  return (
    <div className="modal-overlay" onClick={handleRequestClose}>
      <div
        ref={modalRef}
        className="role-split-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--blue-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue-text)',
                flexShrink: 0,
              }}
            >
              {isReadOnly ? <Lock size={18} /> : <ShieldCheck size={20} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  id="role-modal-title"
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-md)',
                    fontWeight: 700,
                    color: 'var(--text-title)',
                  }}
                >
                  {mode === 'add'
                    ? duplicateSource
                      ? `Duplikasi Peran: ${duplicateSource.name}`
                      : 'Tambah Peran (Role) Baru'
                    : isReadOnly
                      ? `Detail Peran Sistem: ${initialRole?.name || ''}`
                      : `Ubah Peran Kustom: ${initialRole?.name || ''}`}
                </h3>
                {isReadOnly && <span className="badge badge-blue">Sistem Inti • Read-Only</span>}
                {mode === 'edit' && <span className="badge badge-yellow">Peran Kustom</span>}
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {isReadOnly
                  ? 'Tinjau matriks kewenangan bawaan sistem atau duplikasi sebagai peran kustom baru.'
                  : 'Atur identitas, cakupan data, dan izin granular per modul secara berdampingan.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="admin-close-btn"
            aria-label="Tutup modal peran"
          >
            <X size={18} />
          </button>
        </div>

        {/* Read-Only System Core Banner with 1-Click Duplicate */}
        {isReadOnly && initialRole && (
          <div className="role-info-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} style={{ color: 'var(--accent-blue-text)', flexShrink: 0 }} />
              <span>
                Peran sistem inti dilindungi agar kebijakan keamanan dasar tetap utuh. Ingin
                memodifikasi izinnya?
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDuplicateAsCustom(initialRole)}
              className="btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: 'var(--text-xs)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Copy size={13} />
              <span>Duplikasi sebagai Peran Kustom</span>
            </button>
          </div>
        )}

        {/* Unsaved Changes Inline Confirmation Banner */}
        {confirmDiscard && (
          <div className="admin-dirty-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--status-alert-text)', flexShrink: 0 }} />
              <span>Konfigurasi peran belum disimpan. Yakin ingin membatalkan perubahan?</span>
            </div>
            <div className="admin-dirty-banner-actions">
              <button
                type="button"
                className="pwd-action-chip"
                onClick={() => setConfirmDiscard(false)}
              >
                Lanjut Mengedit
              </button>
              <button
                type="button"
                className="pwd-action-chip"
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
                style={{
                  borderColor: 'var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                }}
              >
                Buang Perubahan
              </button>
            </div>
          </div>
        )}

        <form method="post" onSubmit={handleSubmit} className="role-split-form" noValidate>
          <div className="role-split-grid">
            {/* LEFT PANE: Sticky Identity, Scope Radio Cards, Presets & Live Summary */}
            <div className="role-split-left">
              {serverError && (
                <div
                  role="alert"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid var(--status-danger-border)',
                    color: 'var(--status-danger-text)',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="role-modal-name" className="admin-field-label">
                  <span>
                    Nama Peran <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                  </span>
                </label>
                <input
                  id="role-modal-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (mode === 'add' && !slugManuallyEdited) {
                      setSlugId(slugifyRoleName(val));
                    }
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  className={`form-input ${fieldErrors.name ? 'has-error' : ''}`}
                  placeholder="Contoh: Auditor Operasional Regional"
                  disabled={isReadOnly}
                />
                {fieldErrors.name && (
                  <span className="admin-field-error">
                    <AlertCircle size={13} />
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="role-modal-slug" className="admin-field-label">
                  <span>
                    Kode Unik (Slug ID) <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                  </span>
                  {mode !== 'add' && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Terkunci</span>
                  )}
                </label>
                <input
                  id="role-modal-slug"
                  type="text"
                  value={slugId}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlugId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    if (fieldErrors.id) setFieldErrors((p) => ({ ...p, id: undefined }));
                  }}
                  className={`form-input ${fieldErrors.id || slugConflictRole ? 'has-error' : ''}`}
                  placeholder="Contoh: auditor_ops"
                  disabled={mode !== 'add'}
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                />
                {fieldErrors.id ? (
                  <span className="admin-field-error">
                    <AlertCircle size={13} />
                    {fieldErrors.id}
                  </span>
                ) : slugConflictRole ? (
                  <span className="admin-field-error">
                    <AlertCircle size={13} />
                    Kode ini sudah dipakai oleh &ldquo;{slugConflictRole.name}&rdquo;.
                  </span>
                ) : (
                  <p className="admin-field-hint">
                    Kunci sistem permanen (huruf kecil &amp; garis bawah), tidak dapat diubah
                    setelah dibuat.
                  </p>
                )}
              </div>

              {/* Visual Scope Selector (Radio Cards) */}
              <div className="form-group">
                <span className="admin-field-label">Cakupan Penugasan (Scope)</span>
                <div className="scope-cards-grid" role="radiogroup" aria-label="Cakupan penugasan peran">
                  {SCOPE_OPTIONS.map((opt) => {
                    const selected = scope === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isReadOnly}
                        onClick={() => setScope(opt.value)}
                        className={`scope-card ${selected ? 'selected' : ''}`}
                      >
                        <span className="scope-card-icon">
                          {opt.icon === 'global' && <Globe size={15} />}
                          {opt.icon === 'regional' && <Building2 size={15} />}
                          {opt.icon === 'cabang' && <Anchor size={15} />}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              color: 'var(--text-title)',
                            }}
                          >
                            {opt.title}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-muted)',
                              lineHeight: 1.35,
                            }}
                          >
                            {opt.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="role-modal-desc" className="admin-field-label">
                  <span>Deskripsi Tugas &amp; Tanggung Jawab</span>
                </label>
                <textarea
                  id="role-modal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-textarea"
                  rows={2}
                  disabled={isReadOnly}
                  placeholder="Jelaskan peran ini digunakan untuk tugas apa dan oleh unit mana..."
                  style={{ resize: 'vertical', minHeight: '68px' }}
                />
              </div>

              {/* Quick Presets (Editable modes only) */}
              {!isReadOnly && (
                <div className="form-group">
                  <span className="admin-field-label">Template Cepat (Preset)</span>
                  <div className="role-preset-grid">
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`role-preset-chip ${activePresetId === preset.id ? 'active' : ''}`}
                        title={preset.description}
                      >
                        <Sparkles size={12} />
                        <span>
                          {preset.label} · {preset.permissions.length} izin
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('clear')}
                      className="role-preset-chip"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
              )}

              {/* Live Impact Summary Card */}
              <div className="role-live-summary">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--text-title)',
                    }}
                  >
                    Ringkasan Hak Akses
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--accent-blue-text)',
                    }}
                  >
                    {permissions.length} / {TOTAL_SYSTEM_PERMISSIONS} Izin ({progressPercent}%)
                  </span>
                </div>

                <div className="role-progress-track" aria-hidden="true">
                  <div className="role-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-xs)',
                    color: sensitiveActiveCount > 0 ? 'var(--status-alert-text)' : 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldAlert size={13} />
                    <span>Izin Sensitif Aktif</span>
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>
                    {sensitiveActiveCount} / {totalSensitiveCount}
                  </strong>
                </div>

                {fieldErrors.permissions && (
                  <span className="admin-field-error">
                    <AlertCircle size={13} />
                    {fieldErrors.permissions}
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT PANE: Sticky Search/Filter Toolbar + Scrollable Permission Matrix */}
            <div className="role-split-right">
              <div className="perm-toolbar">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ position: 'relative', flex: '1 1 220px' }}>
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
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      className="form-input"
                      placeholder="Cari modul atau nama izin (cth: ekspor, audit, verifikasi)..."
                      style={{ paddingLeft: '36px' }}
                      aria-label="Cari hak akses"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPermFilter('all')}
                      className={`role-preset-chip ${permFilter === 'all' ? 'active' : ''}`}
                    >
                      Semua ({TOTAL_SYSTEM_PERMISSIONS})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermFilter('active')}
                      className={`role-preset-chip ${permFilter === 'active' ? 'active' : ''}`}
                    >
                      Aktif ({permissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermFilter('sensitive')}
                      className={`role-preset-chip ${permFilter === 'sensitive' ? 'active' : ''}`}
                    >
                      Sensitif ({totalSensitiveCount})
                    </button>
                  </div>
                </div>

                {depNotice && (
                  <div className="role-dep-note" role="status">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={14} style={{ flexShrink: 0 }} />
                      <span>{depNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDepNotice(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-blue-text)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'inline-flex',
                      }}
                      aria-label="Tutup pemberitahuan"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="perm-scroll-list">
                {filteredGroups.length === 0 ? (
                  <div
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    Tidak ada hak akses yang cocok dengan filter aktif.
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const groupKeys = group.permissions.map((p) => p.key);
                    const selectedInGroup = groupKeys.filter((k) => permissions.includes(k)).length;
                    const allSelected = selectedInGroup === groupKeys.length;

                    return (
                      <div key={group.name} className="perm-group-card">
                        <div className="perm-group-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                fontWeight: 700,
                                color: 'var(--text-title)',
                              }}
                            >
                              {group.name}
                            </span>
                            <span
                              style={{
                                fontSize: 'var(--text-xs)',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color:
                                  selectedInGroup > 0
                                    ? 'var(--accent-blue-text)'
                                    : 'var(--text-muted)',
                              }}
                            >
                              {selectedInGroup}/{groupKeys.length}
                            </span>
                          </div>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(groupKeys)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-blue-text)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '4px 6px',
                              }}
                            >
                              {allSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                            </button>
                          )}
                        </div>

                        <div className="perm-group-list">
                          {group.permissions.map((perm) => {
                            const isChecked = permissions.includes(perm.key);
                            const risk = PERMISSION_RISK_MAP[perm.key] || 'read';

                            return (
                              <div
                                key={perm.key}
                                className={`perm-row ${isChecked ? 'checked' : ''}`}
                              >
                                <div className="perm-row-meta">
                                  <div className="perm-row-title-line">
                                    <span
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-title)',
                                      }}
                                    >
                                      {perm.label}
                                    </span>
                                    <span className={`perm-risk-badge ${risk}`}>
                                      {RISK_LABELS[risk]}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--text-muted)',
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {perm.description}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isChecked}
                                  aria-label={perm.label}
                                  disabled={isReadOnly}
                                  onClick={() => handleTogglePermission(perm.key)}
                                  className="perm-switch"
                                >
                                  <span className="perm-switch-thumb" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div
            className="modal-footer"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              borderRadius: 0,
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {isReadOnly
                ? `${initialRole?.user_count || 0} pengguna menggunakan peran sistem ini`
                : isDirty
                  ? 'Perubahan belum disimpan'
                  : 'Siap disimpan'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleRequestClose}
                className="btn-dark"
                disabled={saving}
                style={{ padding: '8px 16px', fontSize: 'var(--text-xs)' }}
              >
                {isReadOnly ? 'Tutup' : 'Batal'}
              </button>

              {isReadOnly && initialRole ? (
                <button
                  type="button"
                  onClick={() => onDuplicateAsCustom(initialRole)}
                  className="btn-primary"
                  style={{
                    padding: '8px 18px',
                    fontSize: 'var(--text-xs)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Copy size={14} />
                  <span>Duplikasi sebagai Peran Kustom</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || Boolean(slugConflictRole)}
                  style={{
                    padding: '8px 18px',
                    fontSize: 'var(--text-xs)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={14} />
                  <span>
                    {saving
                      ? 'Menyimpan...'
                      : mode === 'add'
                        ? 'Simpan Role Baru'
                        : 'Perbarui Role'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
