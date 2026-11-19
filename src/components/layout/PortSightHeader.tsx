'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Sun,
  Moon,
  UserCheck,
  UserPlus,
  LogOut,
  Menu,
  X,
  KeyRound,
  Bell,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES, getSelectedBranchLabel } from '@/lib/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface PortSightHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedTerminal: string;
  userRole: UserRole;
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
  onOpenPasswordChange?: () => void;
  pendingCount?: number;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

const TAB_CONTEXT_META: Record<string, { section: string; title: string }> = {
  beranda: { section: 'Eksekutif', title: 'Ringkasan Eksekutif' },
  isu_strategis: { section: 'Eksekutif', title: 'Isu Strategis & Program Prioritas' },
  periode: { section: 'Modul Kinerja', title: 'Analisis Rentang Periode' },
  keuangan: { section: 'Modul Kinerja', title: 'Kinerja Keuangan & Konsolidasi' },
  opkom: { section: 'Modul Kinerja', title: 'Operasi & Komersial (Opkom)' },
  kinerja: { section: 'Modul Kinerja', title: 'Kinerja Pelayanan Operasional' },
  utilisasi: { section: 'Modul Kinerja', title: 'Utilisasi Dermaga & Lapangan' },
  peralatan: { section: 'Modul Kinerja', title: 'Kesiapan & Utilisasi Peralatan' },
  fasilitas: { section: 'Modul Kinerja', title: 'Fasilitas & Infrastruktur' },
  data_records: { section: 'Tata Kelola', title: 'Rekaman Data Kinerja' },
  master_data: { section: 'Tata Kelola', title: 'Master Data & Akses' },
  verification: { section: 'Tata Kelola', title: 'Verifikasi & Monitoring' },
  import_center: { section: 'Tata Kelola', title: 'Penginputan Data' },
  templates: { section: 'Tata Kelola', title: 'Pemetaan Template' },
  audit_trail: { section: 'Tata Kelola', title: 'Jejak Audit Sistem' },
};

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const clean = name.split(',')[0].trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function PortSightHeader({
  activeTab,
  setActiveTab,
  selectedTerminal,
  userRole,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenPasswordChange,
  pendingCount = 0,
  theme,
  onThemeChange,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}: PortSightHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const logoutDialogRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const accountContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('portsight_navbar_collapsed');
        if (saved === 'true') {
          setIsNavbarCollapsed(true);
        }
      } catch (e) {
        console.warn('[PortSightHeader] Failed to read navbar collapse state:', e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Dismiss popovers on outside click or Escape
  useEffect(() => {
    if (!notificationsOpen && !accountMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificationsOpen && notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (accountMenuOpen && accountContainerRef.current && !accountContainerRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotificationsOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, accountMenuOpen]);

  useEffect(() => {
    if (!showLogoutConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirm(false);
      } else if (e.key === 'Enter' && onLogout) {
        setShowLogoutConfirm(false);
        onLogout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm, onLogout]);

  useFocusTrap(logoutDialogRef, showLogoutConfirm, () => setShowLogoutConfirm(false));

  const handleToggleNavbar = () => {
    setIsNavbarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('portsight_navbar_collapsed', String(next));
      } catch (e) {
        console.warn('[PortSightHeader] Failed to persist navbar collapse state:', e);
      }
      return next;
    });
  };

  const effectiveRole = currentUser?.role || userRole;
  const userBranchId = currentUser?.branch_id;
  const isPicCabang = effectiveRole === 'pic_cabang' && !!userBranchId && userBranchId !== 'R99';
  const canManageUsers = effectiveRole === 'super_admin' || effectiveRole === 'admin_regional';
  const assignedBranch = userBranchId ? OFFICIAL_BRANCHES.find((b) => b.code === userBranchId) : undefined;
  const currentBranchName = OFFICIAL_BRANCHES.find((b) => b.code === selectedTerminal)?.name;
  const isAll = !isPicCabang && (!selectedTerminal || selectedTerminal === 'ALL');
  const selectedBranchTitle = isPicCabang
    ? `[${userBranchId}] ${assignedBranch?.name || userBranchId}`
    : isAll
      ? 'Regional 4 (Konsolidasi 28 Cabang)'
      : getSelectedBranchLabel(selectedTerminal);

  const getRoleLabel = () => {
    if (effectiveRole === 'super_admin') return 'Super Admin';
    if (effectiveRole === 'admin_regional') return 'Admin Regional 4';
    if (effectiveRole === 'pic_dept_regional') return 'PIC Dept Regional';
    if (effectiveRole === 'pic_cabang') {
      const bCode = currentUser?.branch_id || selectedTerminal;
      const bName = assignedBranch?.name || currentBranchName;
      return bCode && bCode !== 'R99'
        ? `PIC Cabang [${bCode}]${bName ? ` • ${bName}` : ''}`
        : 'PIC Cabang';
    }
    return 'BOD Regional 4';
  };

  const pageContext = TAB_CONTEXT_META[activeTab] || {
    section: 'Dashboard',
    title: 'Dashboard Regional 4',
  };

  const displayName = currentUser ? currentUser.name.split(',')[0] : 'Tamu';
  const initials = getInitials(currentUser?.name);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <>
      <header className={`portsight-header ${isNavbarCollapsed ? 'collapsed' : ''}`}>
        <div className="portsight-header-content">
          {/* LEFT: Mobile Menu + Compact Mobile Brand + Desktop Active Page Context */}
          <div className="header-context-left">
            <button
              type="button"
              onClick={() => onToggleMobileMenu?.()}
              className="mobile-menu-btn"
              aria-label="Buka menu navigasi"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={17} aria-hidden="true" /> : <Menu size={17} aria-hidden="true" />}
              {pendingCount > 0 && !isMobileMenuOpen && (
                <span className="header-mobile-dot" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className="header-mobile-brand"
              onClick={() => setActiveTab('beranda')}
              aria-label="Kembali ke Beranda PortDash"
            >
              <span className="header-mobile-logo">
                <Image
                  src="/pelindo-logo.png"
                  alt="Logo Pelindo"
                  width={26}
                  height={26}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </span>
              <span className="brand-title" style={{ fontSize: '13px', fontWeight: 800 }}>PortDash</span>
            </button>

            <div className="header-page-context">
              <div className="header-breadcrumb-row">
                <span className="header-section-label">{pageContext.section}</span>
                <span className="header-breadcrumb-sep" aria-hidden="true">/</span>
                <h1 className="header-page-title">{pageContext.title}</h1>
              </div>
              <span className="header-scope-subtitle" title={selectedBranchTitle}>
                {selectedBranchTitle}
              </span>
            </div>
          </div>

          {/* RIGHT: Utility Icon Cluster (Notif + Theme) + Unified Account Dropdown */}
          <div className="header-actions-right">
            <div className="header-utility-cluster">
              {/* Notifications */}
              <div ref={notifContainerRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev);
                    setAccountMenuOpen(false);
                  }}
                  className={`header-icon-btn ${notificationsOpen ? 'active' : ''}`}
                  title="Notifikasi Verifikasi & Status Data"
                  aria-label={`Notifikasi: ${pendingCount} menunggu verifikasi`}
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={15} aria-hidden="true" />
                  {pendingCount > 0 && (
                    <span className="header-notif-badge" aria-hidden="true">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    role="dialog"
                    aria-label="Daftar notifikasi verifikasi"
                    className="header-popover"
                    style={{ width: '290px' }}
                  >
                    <div className="header-popover-head">
                      <span>Pemberitahuan Verifikasi</span>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="header-popover-close"
                        aria-label="Tutup panel notifikasi"
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>

                    {pendingCount > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Terdapat <strong style={{ color: 'var(--text-title)' }}>{pendingCount} data</strong> yang menunggu verifikasi atau tindak lanjut revisi.
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setActiveTab('verification');
                            setNotificationsOpen(false);
                          }}
                          style={{ fontSize: '12px', padding: '6px 10px', width: '100%', justifyContent: 'center' }}
                        >
                          Buka Modul Verifikasi
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 4px' }}>
                        Tidak ada rekaman menunggu verifikasi saat ini. Seluruh data telah konsisten.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onThemeChange(nextTheme)}
                className="header-icon-btn"
                title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                aria-label={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              >
                {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
              </button>
            </div>

            <span className="header-divider" aria-hidden="true" />

            {/* Unified Account Profile Menu */}
            <div ref={accountContainerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                className={`header-account-trigger ${accountMenuOpen ? 'active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={`Menu akun ${displayName}`}
              >
                <span className="header-avatar" aria-hidden="true">
                  {initials}
                </span>
                <span className="header-account-summary hidden-on-mobile">
                  <span className="header-account-name">{displayName}</span>
                  <span className="header-account-role">{getRoleLabel()}</span>
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  style={{
                    color: 'var(--text-muted)',
                    transform: accountMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {accountMenuOpen && (
                <div role="menu" aria-label="Menu akun pengguna" className="header-popover header-account-menu">
                  {/* Account Identity Header */}
                  <div className="header-account-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-title)' }}>{displayName}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-blue-text)',
                          fontWeight: 700,
                        }}
                      >
                        [{currentUser?.nipp || '-'}]
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span className="header-role-chip">
                        <Shield size={10} aria-hidden="true" />
                        {getRoleLabel()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {currentUser?.branch_id || 'R99'}
                      </span>
                    </div>
                  </div>

                  {/* Account Management Actions */}
                  {onOpenPasswordChange && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-account-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenPasswordChange();
                      }}
                    >
                      <KeyRound size={14} aria-hidden="true" />
                      <span>Ubah Kata Sandi</span>
                    </button>
                  )}

                  {canManageUsers && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-account-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAuth('register');
                      }}
                    >
                      <UserPlus size={14} aria-hidden="true" />
                      <span>Daftar Akun Baru</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    className="header-account-item"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenAuth('login');
                    }}
                  >
                    <UserCheck size={14} aria-hidden="true" />
                    <span>Ganti Akun PIC</span>
                  </button>

                  {onLogout && (
                    <>
                      <div className="header-menu-separator" />
                      <button
                        type="button"
                        role="menuitem"
                        className="header-account-item danger"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                      >
                        <LogOut size={14} aria-hidden="true" />
                        <span>Keluar dari Akun</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Central Bottom Collapse Handle */}
        <div className="navbar-toggle-container">
          <button
            type="button"
            className="navbar-toggle-btn"
            onClick={handleToggleNavbar}
            title={isNavbarCollapsed ? 'Tampilkan Header' : 'Ciutkan Header'}
            aria-label={isNavbarCollapsed ? 'Tampilkan Header' : 'Ciutkan Header'}
          >
            {isNavbarCollapsed ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Single Accessible Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100000 }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="header-logout-title"
            aria-describedby="header-logout-desc"
            ref={logoutDialogRef}
            tabIndex={-1}
            style={{ maxWidth: '380px', padding: '20px', borderRadius: 'var(--radius-md)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <LogOut size={18} strokeWidth={1.75} color="var(--status-danger-text)" aria-hidden="true" />
              <h4 id="header-logout-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
                Konfirmasi Keluar Sesi
              </h4>
            </div>
            <p id="header-logout-desc" style={{ margin: '0 0 18px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Sesi aktif pada perangkat ini akan diakhiri. Data yang sudah tersimpan tidak terpengaruh.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                }}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  backgroundColor: '#b91c1c',
                  color: 'var(--text-on-accent)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
