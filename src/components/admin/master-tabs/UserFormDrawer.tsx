'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  UserPlus,
  Edit2,
  X,
  Save,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { User, UserRole, Department } from '@/lib/types';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import {
  checkPasswordStrength,
  evaluatePasswordStrength,
  MIN_PASSWORD_LENGTH,
  MIN_DISTINCT_CHARACTERS,
} from '@/lib/passwordPolicy';
import {
  RoleMetadata,
  PERMISSION_LABEL_MAP,
  TOTAL_SYSTEM_PERMISSIONS,
} from '@/lib/roleDefinitions';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface UserFormDrawerProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  editingUser: User | null;
  existingUsers: User[];
  availableRoles: RoleMetadata[];
  departments?: Department[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FieldErrors {
  name?: string;
  nipp?: string;
  email?: string;
  divisi?: string;
  departemen?: string;
  password?: string;
  confirmPassword?: string;
}

const DEFAULT_DIVISIONS = [
  'Divisi Operasi',
  'Divisi Teknik & Pemeliharaan',
  'Divisi Komersial & Bisnis',
  'Divisi Keuangan & Akuntansi',
  'Divisi SDM & Umum',
  'Divisi Transformasi & TI',
];

const DEFAULT_DEPARTMENTS = [
  'Operasi Terminal & Petikemas',
  'Pemeliharaan Fasilitas & Peralatan',
  'Pelayanan Kapal & Pemanduan',
  'Akuntansi & Anggaran',
  'Sistem Informasi & Manajemen Data',
];

const SCOPE_BADGE_LABELS: Record<'global' | 'regional' | 'cabang', string> = {
  global: 'Global (28 Cabang)',
  regional: 'Regional 4 (Pusat)',
  cabang: 'Cabang / Terminal',
};

function generateStrongPassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = lower + upper + digits + symbols;

  const pick = (pool: string): string => {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return pool[arr[0] % pool.length];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Guarantee variety across all character classes + 16 chars total
  const chars = [
    pick(upper),
    pick(upper),
    pick(lower),
    pick(lower),
    pick(digits),
    pick(digits),
    pick(symbols),
    pick(symbols),
  ];
  while (chars.length < 16) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      j = arr[0] % (i + 1);
    }
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(Capt\.|Ir\.|Dr\.|Drs\.|H\.|Hj\.)\s*/gi, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UserFormDrawer(props: UserFormDrawerProps) {
  if (!props.isOpen) return null;
  const instanceKey = `${props.mode}_${props.editingUser?.id ?? 'new'}`;
  return <UserFormDrawerInner key={instanceKey} {...props} />;
}

function UserFormDrawerInner({
  mode,
  editingUser,
  existingUsers,
  availableRoles,
  departments = [],
  onClose,
  onSuccess,
}: UserFormDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const initialValues = useMemo(() => {
    if (mode === 'edit' && editingUser) {
      const initNipp = editingUser.nipp || editingUser.username || '';
      return {
        name: editingUser.name || '',
        nipp: initNipp,
        email: editingUser.email || (initNipp ? `${initNipp}@pelindo.co.id` : ''),
        emailTouched: true,
        divisi: editingUser.divisi || '',
        departemen: editingUser.departemen || '',
        role: (editingUser.role || 'pic_cabang') as UserRole,
        branchId: editingUser.branch_id || 'R99',
        active: editingUser.active !== undefined ? Boolean(editingUser.active) : true,
        resetExpanded: false,
      };
    }
    return {
      name: '',
      nipp: '',
      email: '',
      emailTouched: false,
      divisi: 'Divisi Operasi',
      departemen: 'Operasi Terminal & Petikemas',
      role: 'pic_cabang' as UserRole,
      branchId: 'R01',
      active: true,
      resetExpanded: true,
    };
  }, [mode, editingUser]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initialValues.name,
        nipp: initialValues.nipp,
        email: initialValues.email,
        divisi: initialValues.divisi,
        departemen: initialValues.departemen,
        role: initialValues.role,
        branchId: initialValues.branchId,
        active: initialValues.active,
      }),
    [initialValues]
  );

  // Form fields
  const [name, setName] = useState(initialValues.name);
  const [nipp, setNipp] = useState(initialValues.nipp);
  const [email, setEmail] = useState(initialValues.email);
  const [emailTouched, setEmailTouched] = useState(initialValues.emailTouched);
  const [divisi, setDivisi] = useState(initialValues.divisi);
  const [departemen, setDepartemen] = useState(initialValues.departemen);
  const [role, setRole] = useState<UserRole>(initialValues.role);
  const [branchId, setBranchId] = useState(initialValues.branchId);
  const [active, setActive] = useState(initialValues.active);

  // Password section
  const [resetExpanded, setResetExpanded] = useState(initialValues.resetExpanded);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requireChange, setRequireChange] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Submission & validation state
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isDirty = useMemo(() => {
    const current = JSON.stringify({
      name,
      nipp,
      email,
      divisi,
      departemen,
      role,
      branchId,
      active,
    });
    return current !== initialSnapshot || password.length > 0;
  }, [name, nipp, email, divisi, departemen, role, branchId, active, password, initialSnapshot]);

  const handleRequestClose = useCallback(() => {
    if (saving) return;
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  }, [saving, isDirty, confirmDiscard, onClose]);

  useFocusTrap(drawerRef, true, handleRequestClose);

  // Merge division & department suggestions from master data + existing users
  const divisionOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_DIVISIONS);
    existingUsers.forEach((u) => {
      if (u.divisi?.trim()) set.add(u.divisi.trim());
    });
    return Array.from(set);
  }, [existingUsers]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_DEPARTMENTS);
    departments.forEach((d) => {
      if (d.name?.trim()) set.add(d.name.trim());
    });
    existingUsers.forEach((u) => {
      if (u.departemen?.trim()) set.add(u.departemen.trim());
    });
    return Array.from(set);
  }, [departments, existingUsers]);

  // Selected role metadata for Role Impact Preview
  const selectedRoleMeta = useMemo(() => {
    return availableRoles.find((r) => r.id === role) || availableRoles[0] || null;
  }, [availableRoles, role]);

  // Instant duplicate NIPP detection
  const duplicateNippUser = useMemo(() => {
    const clean = nipp.trim().toLowerCase();
    if (!clean) return null;
    return (
      existingUsers.find((u) => {
        if (mode === 'edit' && editingUser && u.id === editingUser.id) return false;
        const candidate = (u.nipp || u.username || '').trim().toLowerCase();
        return candidate === clean;
      }) || null
    );
  }, [nipp, existingUsers, mode, editingUser]);

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

  // Contextual branch hint based on role scope
  const branchContextHint = useMemo(() => {
    if (!selectedRoleMeta) return null;
    if ((selectedRoleMeta.scope === 'global' || selectedRoleMeta.scope === 'regional') && branchId !== 'R99') {
      return {
        tone: 'info' as const,
        text: `Peran "${selectedRoleMeta.name}" memiliki cakupan ${SCOPE_BADGE_LABELS[selectedRoleMeta.scope]} — penugasan umum diarahkan ke R99 - Regional 4.`,
      };
    }
    if (selectedRoleMeta.scope === 'cabang' && branchId === 'R99') {
      return {
        tone: 'alert' as const,
        text: 'Peran ini bercakupan Cabang / Terminal. Pilih cabang pelabuhan spesifik (R01–R26) agar akses data tidak melebar.',
      };
    }
    return null;
  }, [selectedRoleMeta, branchId]);

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    const meta = availableRoles.find((r) => r.id === nextRole);
    if (meta && mode === 'add') {
      if (meta.scope === 'global' || meta.scope === 'regional') {
        setBranchId('R99');
      } else if (meta.scope === 'cabang' && branchId === 'R99') {
        setBranchId('R01');
      }
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateStrongPassword();
    setPassword(generated);
    if (mode === 'edit') {
      setConfirmPassword(generated);
      setResetExpanded(true);
    }
    setShowPassword(true);
    setCopiedPassword(false);
    setFieldErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
  };

  const handleCopyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    } catch {
      // Fallback ignored if clipboard permission unavailable
    }
  };

  const validateFields = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Nama lengkap pegawai wajib diisi (minimal 2 karakter).';
    }
    if (!nipp.trim() || nipp.trim().length < 3) {
      errors.nipp = 'NIPP / Username wajib diisi (minimal 3 karakter).';
    } else if (duplicateNippUser) {
      errors.nipp = `NIPP sudah terdaftar atas nama ${duplicateNippUser.name}.`;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Format alamat email tidak valid.';
    }
    if (!divisi.trim()) {
      errors.divisi = 'Divisi pegawai wajib diisi.';
    }
    if (!departemen.trim()) {
      errors.departemen = 'Departemen pegawai wajib diisi.';
    }

    const requiresPassword = mode === 'add' || (mode === 'edit' && resetExpanded && password.trim().length > 0);
    if (mode === 'add' && !password) {
      errors.password = 'Kata sandi awal wajib diisi atau klik "Buat Sandi Kuat".';
    } else if (requiresPassword) {
      const check = checkPasswordStrength(password);
      if (!check.valid) {
        errors.password = check.error || `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
      }
      if (mode === 'edit' && password !== confirmPassword) {
        errors.confirmPassword = 'Konfirmasi kata sandi tidak cocok.';
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setConfirmDiscard(false);

    const errors = validateFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: name.trim(),
            nipp: nipp.trim(),
            email: email.trim() || `${nipp.trim()}@pelindo.co.id`,
            divisi: divisi.trim(),
            departemen: departemen.trim(),
            role,
            branch_id: branchId,
            password: password.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setServerError(data.error || 'Gagal mendaftarkan pengguna baru.');
          return;
        }

        onSuccess(`Pengguna ${name.trim()} (NIPP: ${nipp.trim()}) berhasil didaftarkan ke sistem.`);
        onClose();
      } else if (editingUser) {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: editingUser.id,
            name: name.trim(),
            nipp: nipp.trim() || editingUser.nipp,
            email: email.trim() || undefined,
            divisi: divisi.trim(),
            departemen: departemen.trim(),
            role,
            branch_id: branchId,
            active,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setServerError(data.error || 'Gagal menyimpan perubahan akun.');
          return;
        }

        const wantsPasswordReset = resetExpanded && password.trim().length > 0;
        if (wantsPasswordReset) {
          const resetRes = await fetch('/api/users/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId: editingUser.id,
              newPassword: password,
              requireChangeOnNextLogin: requireChange,
            }),
          });
          const resetData = await resetRes.json();
          if (!resetRes.ok || !resetData.success) {
            setServerError(
              resetData.error ||
                'Profil tersimpan, tetapi reset kata sandi gagal. Silakan ulangi reset kata sandi.'
            );
            return;
          }
        }

        onSuccess(
          wantsPasswordReset
            ? `Profil dan kata sandi PIC ${name.trim()} (NIPP: ${nipp.trim()}) telah diperbarui. Semua sesi lama diakhiri.`
            : `Data PIC ${name.trim()} (NIPP: ${nipp.trim()}) telah diperbarui dan disinkronkan.`
        );
        onClose();
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
  };

  const strengthColorClass =
    passwordStrength.score === 1
      ? 'level-1'
      : passwordStrength.score === 2
        ? 'level-2'
        : passwordStrength.score === 3
          ? 'level-3'
          : passwordStrength.score === 4
            ? 'level-4'
            : '';

  const strengthTextColor =
    passwordStrength.score === 1
      ? 'var(--status-danger-text)'
      : passwordStrength.score === 2
        ? 'var(--status-alert-text)'
        : passwordStrength.score === 3
          ? 'var(--accent-blue-text)'
          : passwordStrength.score === 4
            ? 'var(--status-good-text)'
            : 'var(--text-muted)';

  return (
    <div className="admin-drawer-overlay" onClick={handleRequestClose}>
      <div
        ref={drawerRef}
        className="admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Drawer Header */}
        <div className="admin-drawer-header">
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
              {mode === 'add' ? <UserPlus size={19} /> : <Edit2 size={18} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                id="user-drawer-title"
                style={{
                  margin: 0,
                  fontSize: 'var(--text-md)',
                  fontWeight: 700,
                  color: 'var(--text-title)',
                }}
              >
                {mode === 'add' ? 'Tambah Pengguna & PIC Baru' : 'Ubah Data Pegawai / PIC'}
              </h3>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {mode === 'add'
                  ? 'Registrasi akun resmi Pelindo Regional 4 beserta peran & penugasan.'
                  : `ID Akun: ${editingUser?.id || '-'} • Sinkronisasi otomatis ke master PIC`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="admin-close-btn"
            aria-label="Tutup panel pengguna"
          >
            <X size={18} />
          </button>
        </div>

        {/* Unsaved Changes Inline Confirmation Banner */}
        {confirmDiscard && (
          <div className="admin-dirty-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--status-alert-text)', flexShrink: 0 }} />
              <span>Ada perubahan belum disimpan. Yakin ingin menutup formulir?</span>
            </div>
            <div className="admin-dirty-banner-actions">
              <button
                type="button"
                className="pwd-action-chip"
                onClick={() => setConfirmDiscard(false)}
              >
                Lanjut Mengisi
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

        <form method="post" onSubmit={handleSubmit} className="admin-drawer-form" noValidate>
          <div className="admin-drawer-body">
            {/* Live Profile Identity Preview Strip */}
            <div className="admin-user-preview">
              <div className="admin-user-preview-identity">
                <div className={`admin-avatar ${!active ? 'inactive' : ''}`}>
                  {getInitials(name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                      color: 'var(--text-title)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name.trim() || 'Nama Pegawai Baru'}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nipp.trim() ? `NIPP ${nipp.trim()}` : 'NIPP belum diisi'}
                    {selectedRoleMeta ? ` • ${selectedRoleMeta.name}` : ''}
                  </div>
                </div>
              </div>

              {mode === 'edit' ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setActive((prev) => !prev)}
                  className="admin-status-toggle"
                  title="Klik untuk mengubah status aktif akun"
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: active
                        ? 'var(--status-good-border)'
                        : 'var(--text-muted)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: active ? 'var(--status-good-text)' : 'var(--text-muted)',
                    }}
                  >
                    {active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </button>
              ) : (
                <span className="badge badge-green">Akun Baru</span>
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.45,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{serverError}</span>
              </div>
            )}

            {/* SEKSI 1: IDENTITAS PEGAWAI */}
            <section className="admin-form-section">
              <div className="admin-section-title">
                <UserIcon size={13} />
                <span>1. Identitas Pegawai</span>
              </div>

              <div className="form-group">
                <label htmlFor="user-drawer-name" className="admin-field-label">
                  <span>
                    Nama Lengkap &amp; Gelar <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                  </span>
                </label>
                <input
                  id="user-drawer-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  className={`form-input ${fieldErrors.name ? 'has-error' : ''}`}
                  placeholder="Contoh: Capt. Rudi Hartono, M.Mar."
                  autoComplete="off"
                />
                {fieldErrors.name && (
                  <span className="admin-field-error">
                    <AlertCircle size={13} />
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              <div className="admin-form-grid-2">
                <div className="form-group">
                  <label htmlFor="user-drawer-nipp" className="admin-field-label">
                    <span>
                      NIPP / Username <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                    </span>
                  </label>
                  <input
                    id="user-drawer-nipp"
                    type="text"
                    value={nipp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\s+/g, '');
                      setNipp(val);
                      if (mode === 'add' && !emailTouched) {
                        setEmail(val ? `${val}@pelindo.co.id` : '');
                      }
                      if (fieldErrors.nipp) setFieldErrors((p) => ({ ...p, nipp: undefined }));
                    }}
                    className={`form-input ${fieldErrors.nipp || duplicateNippUser ? 'has-error' : ''}`}
                    placeholder="Contoh: 198503152010121002"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                    autoComplete="off"
                  />
                  {fieldErrors.nipp ? (
                    <span className="admin-field-error">
                      <AlertCircle size={13} />
                      {fieldErrors.nipp}
                    </span>
                  ) : duplicateNippUser ? (
                    <span className="admin-field-error">
                      <AlertCircle size={13} />
                      NIPP sudah dipakai oleh {duplicateNippUser.name}.
                    </span>
                  ) : null}
                </div>

                <div className="form-group">
                  <label htmlFor="user-drawer-email" className="admin-field-label">
                    <span>Email Resmi Pelindo</span>
                  </label>
                  <input
                    id="user-drawer-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmailTouched(true);
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    className={`form-input ${fieldErrors.email ? 'has-error' : ''}`}
                    placeholder="nama@pelindo.co.id"
                    autoComplete="off"
                  />
                  {fieldErrors.email && (
                    <span className="admin-field-error">
                      <AlertCircle size={13} />
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* SEKSI 2: ORGANISASI & KEWENANGAN (RBAC) */}
            <section className="admin-form-section">
              <div className="admin-section-title">
                <Building2 size={13} />
                <span>2. Organisasi &amp; Kewenangan (RBAC)</span>
              </div>

              <div className="admin-form-grid-2">
                <div className="form-group">
                  <label htmlFor="user-drawer-divisi" className="admin-field-label">
                    <span>
                      Divisi <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                    </span>
                  </label>
                  <input
                    id="user-drawer-divisi"
                    type="text"
                    value={divisi}
                    onChange={(e) => {
                      setDivisi(e.target.value);
                      if (fieldErrors.divisi) setFieldErrors((p) => ({ ...p, divisi: undefined }));
                    }}
                    className={`form-input ${fieldErrors.divisi ? 'has-error' : ''}`}
                    placeholder="Contoh: Divisi Operasi"
                    list="user-drawer-divisi-list"
                  />
                  <datalist id="user-drawer-divisi-list">
                    {divisionOptions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  {fieldErrors.divisi && (
                    <span className="admin-field-error">
                      <AlertCircle size={13} />
                      {fieldErrors.divisi}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="user-drawer-dept" className="admin-field-label">
                    <span>
                      Departemen <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                    </span>
                  </label>
                  <input
                    id="user-drawer-dept"
                    type="text"
                    value={departemen}
                    onChange={(e) => {
                      setDepartemen(e.target.value);
                      if (fieldErrors.departemen) setFieldErrors((p) => ({ ...p, departemen: undefined }));
                    }}
                    className={`form-input ${fieldErrors.departemen ? 'has-error' : ''}`}
                    placeholder="Contoh: Operasi Terminal"
                    list="user-drawer-dept-list"
                  />
                  <datalist id="user-drawer-dept-list">
                    {departmentOptions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                  {fieldErrors.departemen && (
                    <span className="admin-field-error">
                      <AlertCircle size={13} />
                      {fieldErrors.departemen}
                    </span>
                  )}
                </div>
              </div>

              <div className="admin-form-grid-2">
                <div className="form-group">
                  <label htmlFor="user-drawer-role" className="admin-field-label">
                    <span>
                      Hak Akses / Peran <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                    </span>
                  </label>
                  <select
                    id="user-drawer-role"
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="form-select"
                  >
                    <optgroup label="Peran Sistem Inti">
                      {availableRoles
                        .filter((r) => r.category === 'system')
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </optgroup>
                    {availableRoles.some((r) => r.category === 'custom') && (
                      <optgroup label="Peran Kustom">
                        {availableRoles
                          .filter((r) => r.category === 'custom')
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.id})
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="user-drawer-branch" className="admin-field-label">
                    <span>
                      Penugasan Cabang <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                    </span>
                  </label>
                  <select
                    id="user-drawer-branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="form-select"
                  >
                    {OFFICIAL_BRANCHES.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contextual Branch Hint */}
              {branchContextHint && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor:
                      branchContextHint.tone === 'alert'
                        ? 'rgba(217, 119, 6, 0.12)'
                        : 'var(--blue-soft)',
                    border:
                      branchContextHint.tone === 'alert'
                        ? '1px solid var(--status-alert-border)'
                        : '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-xs)',
                    color:
                      branchContextHint.tone === 'alert'
                        ? 'var(--status-alert-text)'
                        : 'var(--accent-blue-text)',
                    lineHeight: 1.45,
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{branchContextHint.text}</span>
                </div>
              )}

              {/* Role Impact Preview Callout */}
              {selectedRoleMeta && (
                <div className="admin-role-preview">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        color: 'var(--text-title)',
                      }}
                    >
                      <ShieldCheck size={14} style={{ color: 'var(--accent-blue-text)' }} />
                      <span>Dampak Peran: {selectedRoleMeta.name}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--accent-blue-text)',
                      }}
                    >
                      {SCOPE_BADGE_LABELS[selectedRoleMeta.scope]} • {selectedRoleMeta.permissions.length}/
                      {TOTAL_SYSTEM_PERMISSIONS} izin
                    </span>
                  </div>

                  <p className="admin-field-hint">{selectedRoleMeta.description}</p>

                  {selectedRoleMeta.permissions.length > 0 && (
                    <div className="admin-role-preview-tags">
                      {selectedRoleMeta.permissions.slice(0, 4).map((permKey) => (
                        <span key={permKey} className="admin-role-tag">
                          {PERMISSION_LABEL_MAP[permKey] || permKey}
                        </span>
                      ))}
                      {selectedRoleMeta.permissions.length > 4 && (
                        <span
                          className="admin-role-tag"
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          +{selectedRoleMeta.permissions.length - 4} izin lainnya
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* SEKSI 3: KEAMANAN & KREDENSIAL */}
            <section className="admin-form-section">
              <div className="admin-section-title">
                <Lock size={13} />
                <span>3. Keamanan &amp; Kredensial</span>
              </div>

              <div className="pwd-panel">
                {mode === 'edit' && (
                  <button
                    type="button"
                    className="pwd-panel-toggle"
                    aria-expanded={resetExpanded}
                    onClick={() => {
                      setResetExpanded((prev) => {
                        const next = !prev;
                        if (!next) {
                          setPassword('');
                          setConfirmPassword('');
                          setFieldErrors((p) => ({
                            ...p,
                            password: undefined,
                            confirmPassword: undefined,
                          }));
                        }
                        return next;
                      });
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={15} style={{ color: 'var(--accent-blue-text)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-title)' }}>
                          Atur Ulang Kata Sandi (Opsional)
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {resetExpanded
                            ? 'Mengisi sandi baru akan mengakhiri semua sesi login aktif akun ini.'
                            : 'Klik untuk menetapkan kata sandi baru bagi pengguna ini.'}
                        </div>
                      </div>
                    </div>
                    {resetExpanded ? (
                      <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                )}

                {(mode === 'add' || resetExpanded) && (
                  <div className={`pwd-panel-body ${mode === 'edit' ? 'with-border' : ''}`}>
                    {mode === 'edit' && editingUser?.must_change_password && (
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--status-alert-text)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <AlertCircle size={14} />
                        <span>Akun ini masih wajib mengganti kata sandi pada login berikutnya.</span>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <label htmlFor="user-drawer-pwd" className="admin-field-label">
                        <span>
                          {mode === 'add' ? 'Kata Sandi Awal Akun' : 'Kata Sandi Baru'}{' '}
                          {mode === 'add' && (
                            <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                          )}
                        </span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="pwd-action-chip"
                        >
                          <Sparkles size={13} style={{ color: 'var(--accent-blue-text)' }} />
                          <span>Buat Sandi Kuat</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="pwd-action-chip"
                          disabled={!password}
                          title="Salin kata sandi ke clipboard"
                        >
                          {copiedPassword ? (
                            <>
                              <Check size={13} style={{ color: 'var(--status-good-text)' }} />
                              <span style={{ color: 'var(--status-good-text)' }}>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pwd-input-wrap">
                      <input
                        id="user-drawer-pwd"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setCopiedPassword(false);
                          if (fieldErrors.password) {
                            setFieldErrors((p) => ({ ...p, password: undefined }));
                          }
                        }}
                        className={`form-input ${fieldErrors.password ? 'has-error' : ''}`}
                        placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter acak`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="pwd-eye-btn"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {fieldErrors.password && (
                      <span className="admin-field-error">
                        <AlertCircle size={13} />
                        {fieldErrors.password}
                      </span>
                    )}

                    {/* Password Strength Meter (4 visual bars) + Criteria Checklist */}
                    <div className="pwd-strength-row">
                      <div className="pwd-strength-bars" aria-hidden="true">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`pwd-strength-bar ${
                              passwordStrength.score >= step ? strengthColorClass : ''
                            }`}
                          />
                        ))}
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                          color: strengthTextColor,
                          minWidth: '82px',
                          textAlign: 'right',
                        }}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>

                    <div className="pwd-criteria-grid">
                      <div
                        className={`pwd-criterion ${
                          passwordStrength.criteria.minLength ? 'met' : ''
                        }`}
                      >
                        <Check size={13} />
                        <span>Minimal {MIN_PASSWORD_LENGTH} karakter</span>
                      </div>
                      <div
                        className={`pwd-criterion ${
                          passwordStrength.criteria.distinctChars ? 'met' : ''
                        }`}
                      >
                        <Check size={13} />
                        <span>Min. {MIN_DISTINCT_CHARACTERS} karakter unik</span>
                      </div>
                      <div
                        className={`pwd-criterion ${
                          passwordStrength.criteria.mixedVariety ? 'met' : ''
                        }`}
                      >
                        <Check size={13} />
                        <span>Huruf besar, kecil &amp; angka/simbol</span>
                      </div>
                      <div
                        className={`pwd-criterion ${
                          password.length > 0 && passwordStrength.criteria.noEdgeSpaces ? 'met' : ''
                        }`}
                      >
                        <Check size={13} />
                        <span>Tanpa spasi di awal/akhir</span>
                      </div>
                    </div>

                    {mode === 'edit' && password.length > 0 && (
                      <div className="form-group">
                        <label htmlFor="user-drawer-pwd-confirm" className="admin-field-label">
                          <span>Ulangi Kata Sandi Baru</span>
                          {confirmPassword.length > 0 && (
                            <span
                              style={{
                                color:
                                  confirmPassword === password
                                    ? 'var(--status-good-text)'
                                    : 'var(--status-danger-text)',
                              }}
                            >
                              {confirmPassword === password ? 'Cocok' : 'Belum cocok'}
                            </span>
                          )}
                        </label>
                        <input
                          id="user-drawer-pwd-confirm"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) {
                              setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                            }
                          }}
                          className={`form-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
                          placeholder="Ketik ulang kata sandi baru"
                          autoComplete="new-password"
                        />
                        {fieldErrors.confirmPassword && (
                          <span className="admin-field-error">
                            <AlertCircle size={13} />
                            {fieldErrors.confirmPassword}
                          </span>
                        )}
                      </div>
                    )}

                    {mode === 'add' ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          paddingTop: '4px',
                        }}
                      >
                        <ShieldCheck
                          size={14}
                          style={{ color: 'var(--accent-blue-text)', flexShrink: 0, marginTop: '2px' }}
                        />
                        <span>
                          Kebijakan keamanan: pegawai akan otomatis diminta mengganti kata sandi awal
                          saat login pertama kali.
                        </span>
                      </div>
                    ) : (
                      <label
                        htmlFor="user-drawer-req-change"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          paddingTop: '2px',
                        }}
                      >
                        <input
                          id="user-drawer-req-change"
                          type="checkbox"
                          checked={requireChange}
                          onChange={(e) => setRequireChange(e.target.checked)}
                        />
                        <span>Minta pengguna mengganti kata sandi ini saat login berikutnya</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="admin-drawer-footer">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {isDirty ? 'Perubahan belum disimpan' : 'Siap disimpan'}
            </span>
            <div className="admin-drawer-footer-actions">
              <button
                type="button"
                onClick={handleRequestClose}
                className="btn-dark"
                disabled={saving}
                style={{ padding: '8px 16px', fontSize: 'var(--text-xs)' }}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || Boolean(duplicateNippUser)}
                style={{
                  padding: '8px 18px',
                  fontSize: 'var(--text-xs)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {mode === 'add' ? <UserPlus size={15} /> : <Save size={15} />}
                <span>
                  {saving
                    ? 'Menyimpan...'
                    : mode === 'add'
                      ? 'Daftarkan Pengguna'
                      : 'Simpan Perubahan'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
