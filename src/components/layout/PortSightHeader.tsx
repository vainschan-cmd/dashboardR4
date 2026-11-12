'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Download,
  Printer,
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
  PlusCircle,
  KeyRound,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import {
  OFFICIAL_BRANCHES,
  getSelectedBranchLabel,
} from '@/lib/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface PortSightHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedTerminal: string;
  userRole: UserRole;
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onOpenManualInput?: () => void;
  onOpenPasswordChange?: () => void;
  pendingCount?: number;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function PortSightHeader({
  activeTab,
  setActiveTab,
  selectedTerminal,
  userRole,
  currentUser,
  onOpenAuth,
  onLogout,
  onExportExcel,
  onPrint,
  onOpenManualInput,
  onOpenPasswordChange,
  pendingCount = 0,
  theme,
  onThemeChange,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}: PortSightHeaderProps) {
  const [, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutDialogRef = useRef<HTMLDivElement>(null);
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

  // `A11Y-04`: contain Tab inside the confirmation dialog and restore focus.
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
  const isBod = effectiveRole === 'viewer';
  const isPicCabang = effectiveRole === 'pic_cabang' && !!userBranchId && userBranchId !== 'R99';
  const canManageUsers = effectiveRole === 'super_admin' || effectiveRole === 'admin_regional';
  const assignedBranch = userBranchId ? OFFICIAL_BRANCHES.find(b => b.code === userBranchId) : undefined;
  const currentBranchName = OFFICIAL_BRANCHES.find(b => b.code === selectedTerminal)?.name;
  const isAll = !isPicCabang && (!selectedTerminal || selectedTerminal === 'ALL');
  const selectedBranchTitle = isPicCabang
    ? `[${userBranchId}] ${assignedBranch?.name || userBranchId}`
    : isAll
      ? 'Regional 4 (Konsolidasi 28 Cabang)'
      : getSelectedBranchLabel(selectedTerminal);

  const getRoleLabel = () => {
    if (userRole === 'super_admin') return 'Super Admin';
    if (userRole === 'admin_regional') return 'Admin Regional 4';
    if (userRole === 'pic_dept_regional') return 'PIC Dept Operasi';
    if (userRole === 'pic_cabang') {
      const bCode = currentUser?.branch_id || selectedTerminal;
      const bName = assignedBranch?.name || currentBranchName;
      return bCode && bCode !== 'R99'
        ? `PIC Cabang [${bCode}]${bName ? ` • ${bName}` : ''}`
        : 'PIC Cabang';
    }
    return 'BOD Regional 4';
  };

  const pageHeadings: Record<string, string> = {
    beranda: isAll
      ? 'Ringkasan Eksekutif Regional 4 (Konsolidasi 28 Cabang)'
      : `Ringkasan Eksekutif - ${selectedBranchTitle}`,
    periode: isAll
      ? 'Data per Periode & Analisis Rentang Waktu (Multi-Modul)'
      : `Data per Periode - ${selectedBranchTitle}`,
    keuangan: isAll
      ? 'Dashboard Kinerja Keuangan Pelindo R4'
      : `Dashboard Kinerja Keuangan - ${selectedBranchTitle}`,
    opkom: isAll
      ? 'Dashboard Operasi & Komersial Pelindo R4'
      : `Dashboard Operasi & Komersial - ${selectedBranchTitle}`,
    kinerja: isAll
      ? 'Dashboard Kinerja Pelayanan Operasional Pelindo R4'
      : `Dashboard Kinerja - ${selectedBranchTitle}`,
    utilisasi: isAll
      ? 'Dashboard Utilisasi Dermaga & Lapangan (BOR/YOR/SOR)'
      : `Dashboard Utilisasi - ${selectedBranchTitle}`,
    peralatan: isAll
      ? 'Dashboard Monitoring Kesiapan & Utilisasi Peralatan'
      : `Dashboard Peralatan - ${selectedBranchTitle}`,
    fasilitas: isAll
      ? 'Dashboard Fasilitas & Infrastruktur Pelabuhan Regional 4'
      : `Dashboard Fasilitas - ${selectedBranchTitle}`,
    data_records: isAll
      ? 'Rekaman Data Kinerja Pelabuhan Regional 4'
      : `Rekaman Data Kinerja - ${selectedBranchTitle}`,
    master_data: 'Master Data Pelindo Regional 4',
    verification: 'Verifikasi & Pengesahan Data Kinerja',
    import_center: 'Pusat Impor Spreadsheet',
    templates: 'Konfigurasi Template & Pemetaan Kolom',
    audit_trail: 'Jejak Audit & Riwayat Aktivitas Sistem',
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setAdminMenuOpen(false);
  };

  return (
    <>
      {/* 1. TOP HEADER BAR (Collapsible): Brand, Tools, User, Mobile Toggle */}
      <header className={`portsight-header ${isNavbarCollapsed ? 'collapsed' : ''}`}>
        <div className="portsight-header-content">
          {/* Brand Left */}
        <div
          className="brand-wrapper"
          onClick={() => handleSelectTab('beranda')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              flexShrink: 0,
            }}
          >
            <Image
              src="/pelindo-logo.png"
              alt="Logo Pelindo"
              width={32}
              height={32}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1 }}>
            <span className="brand-title">PELINDO R4</span>
            <span className="brand-accent">PortDash</span>
          </div>
        </div>

        {/* Right Section Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Theme Mode Toggle (Terang / Gelap) */}
          <div className="theme-toggle-group" role="group" aria-label="Pilihan Mode Tampilan">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              title="Mode Terang (Light Mode)"
              aria-label="Mode terang"
              aria-pressed={theme === 'light'}
            >
              <Sun size={12} aria-hidden="true" />
              <span className="hidden-on-mobile">Terang</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              title="Mode Gelap (Dark Mode)"
              aria-label="Mode gelap"
              aria-pressed={theme === 'dark'}
            >
              <Moon size={12} aria-hidden="true" />
              <span className="hidden-on-mobile">Gelap</span>
            </button>
          </div>

          {/* User Profile Pill */}
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="btn-dark"
            style={{
              padding: '4px 9px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--bg-inner)',
              border: '1px solid var(--border-subtle)',
              maxWidth: '180px',
            }}
            title="Ganti Akun PIC"
          >
            <UserCheck size={12} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontWeight: 700,
                color: 'var(--text-title)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentUser ? currentUser.name.split(',')[0] : 'Tamu'}
            </span>
            <span
              className="hidden-on-mobile"
              style={{ color: 'var(--accent-cyan)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
            >
              [{currentUser?.nipp || '-'}]
            </span>
          </button>

          {/* Logout Button */}
          {onLogout && (
            <>
              {onOpenPasswordChange && (
                <button
                  type="button"
                  onClick={onOpenPasswordChange}
                  className="btn-dark"
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Ubah kata sandi akun Anda"
                >
                  <KeyRound size={12} strokeWidth={1.75} />
                  <span className="hidden-on-mobile">Kata Sandi</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="btn-dark"
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--status-danger-text)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
                title="Keluar dari Akun (Logout)"
              >
                <LogOut size={12} strokeWidth={1.75} color="#f87171" />
                <span className="hidden-on-mobile">Keluar</span>
              </button>
            </>
          )}

          {/* Desktop Only Tools (Hidden on Mobile/Tablet) */}
          <div className="header-desktop-tools">
            {onOpenManualInput && !isBod && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn-primary"
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-orange-fill, #c2410c)',
                  borderColor: 'var(--accent-orange-fill, #c2410c)',
                  color: 'var(--text-title)',
                  boxShadow: '0 2px 6px rgba(249, 115, 22, 0.35)',
                  cursor: 'pointer',
                }}
                title="Input Data Manual (Finance, Opkom, Kinerja, Utilisasi, Peralatan, Fasilitas)"
              >
                <PlusCircle size={12} />
                <span>+ Input Manual</span>
              </button>
            )}

            {/* Tombol Daftar Akun Baru: Hanya muncul untuk role Super Admin & Administrator */}
            {canManageUsers && (
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="btn-primary"
                style={{
                  padding: '4px 9px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                }}
                title="Daftar Akun Baru PIC / Pengguna (Super Admin & Administrator)"
              >
                <UserPlus size={11} />
                <span>Daftar</span>
              </button>
            )}

            {/* Informasi Role Aktif Pengguna (Sesuai Konfigurasi User) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
              }}
              title={`Hak akses akun: ${getRoleLabel()}`}
            >
              <Shield size={11} color="var(--accent-cyan)" aria-hidden="true" />
              <span className="sr-only">Hak akses: </span>
              <span>{getRoleLabel()}</span>
            </div>

            <button
              type="button"
              onClick={onExportExcel}
              className="btn-dark"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Ekspor data Excel (.xlsx)"
              aria-label="Ekspor data ke Excel"
            >
              <Download size={12} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="btn-dark"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Cetak Ringkasan"
              aria-label="Cetak ringkasan halaman"
            >
              <Printer size={12} aria-hidden="true" />
            </button>
          </div>

          {/* Mobile Menu Hamburger Button to Toggle Sidebar */}
          <button
            type="button"
            onClick={() => {
              if (onToggleMobileMenu) {
                onToggleMobileMenu();
              } else {
                setMobileMenuOpen(!mobileMenuOpen);
              }
            }}
            className="mobile-menu-btn"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: (isMobileMenuOpen || mobileMenuOpen) ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: (isMobileMenuOpen || mobileMenuOpen) ? 'var(--text-on-accent)' : 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            aria-label="Menu navigasi"
            aria-expanded={isMobileMenuOpen || mobileMenuOpen}
          >
            {(isMobileMenuOpen || mobileMenuOpen) ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            {pendingCount > 0 && !(isMobileMenuOpen || mobileMenuOpen) && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#fbbf24',
                }}
              />
            )}
          </button>
        </div>
        </div>

        {/* 1. Tombol Trigger Panah: Chevron Up / Down di Bagian Tengah Bawah Navbar */}
        <div className="navbar-toggle-container">
          <button
            type="button"
            className="navbar-toggle-btn"
            onClick={handleToggleNavbar}
            title={isNavbarCollapsed ? "Tampilkan Seluruh Navbar (v)" : "Ciutkan Navbar ke Atas (^)"}
            aria-label={isNavbarCollapsed ? "Tampilkan Navbar" : "Ciutkan Navbar"}
          >
            {isNavbarCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </header>

      {/* PAGE SUBHEADER: Heading */}
      <div className="portsight-subheader">
        <h1 className="page-heading">
          {pageHeadings[activeTab] || 'Dashboard Regional 4'}
        </h1>
      </div>

      {/* In-App Logout Confirmation Modal (Accessible with Escape & Enter) */}
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
              <LogOut size={18} strokeWidth={1.75} color="#ef4444" aria-hidden="true" />
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
                  // `#ef4444` under white type measured 3.76:1. Red-800 clears AA (5.91:1).
                  backgroundColor: '#b91c1c',
                  color: 'var(--text-title)',
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
