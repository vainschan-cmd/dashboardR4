'use client';

import React, { useState } from 'react';
import {
  Download,
  Printer,
  ChevronDown,
  Layers,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  Sliders,
  History,
  Shield,
  GitBranch,
  Sun,
  Moon,
  UserCheck,
  UserPlus,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Anchor,
  Calendar,
  Building2,
  BarChart3,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { OFFICIAL_BRANCHES, MAIN_NAVIGATION_TABS } from '@/lib/constants';

interface PortSightHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedTerminal: string;
  setSelectedTerminal: (t: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (p: string) => void;
  userRole: UserRole;
  setUserRole: (r: UserRole) => void;
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onOpenManualInput?: () => void;
  pendingCount?: number;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export default function PortSightHeader({
  activeTab,
  setActiveTab,
  selectedTerminal,
  setSelectedTerminal,
  selectedPeriod,
  setSelectedPeriod,
  userRole,
  setUserRole,
  currentUser,
  onOpenAuth,
  onLogout,
  onExportExcel,
  onPrint,
  onOpenManualInput,
  pendingCount = 0,
  theme,
  onThemeChange,
}: PortSightHeaderProps) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainTabs = MAIN_NAVIGATION_TABS;

  const isPicCabang = userRole === 'pic_cabang' || (currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99');
  const assignedBranch = currentUser?.branch_id ? OFFICIAL_BRANCHES.find(b => b.code === currentUser?.branch_id) : undefined;
  const currentBranchName = OFFICIAL_BRANCHES.find(b => b.code === selectedTerminal)?.name;
  const isAll = selectedTerminal === 'ALL';

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

  const adminTabs = isPicCabang
    ? [
        { id: 'data_records', label: 'Data Record Kinerja Cabang', icon: Database },
        { id: 'import_center', label: 'Import Data Cabang (.xlsx)', icon: FileSpreadsheet },
        { id: 'verification', label: `Monitoring Status Pengesahan ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
      ]
    : [
        { id: 'data_records', label: 'Data Record Kinerja (Raw)', icon: Database },
        { id: 'master_data', label: 'Master Data & KPI', icon: Layers },
        { id: 'verification', label: `Verifikasi & Monitoring ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
        { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet },
        { id: 'templates', label: 'Template & Mapping', icon: Sliders },
        { id: 'audit_trail', label: 'Audit Trail & Log', icon: History },
      ];

  const terminals = isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99'
    ? [
        {
          id: currentUser.branch_id,
          name: `[${currentUser.branch_id}] ${assignedBranch?.name || currentUser.branch_id} (Cabang Anda)`,
        },
      ]
    : [
        { id: 'ALL', name: 'Semua Cabang (28 Cabang)' },
        ...OFFICIAL_BRANCHES.map(b => ({
          id: b.code,
          name: `[${b.code}] ${b.name}`
        }))
      ];

  const pageHeadings: Record<string, string> = {
    beranda: isAll
      ? 'Ringkasan Eksekutif Regional 4 (Konsolidasi 28 Cabang)'
      : `Ringkasan Eksekutif - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    periode: isAll
      ? 'Data per Periode & Analisis Rentang Waktu (Multi-Modul)'
      : `Data per Periode - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    keuangan: isAll
      ? 'Dashboard Finance (Keuangan) Pelindo R4'
      : `Dashboard Finance - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    opkom: isAll
      ? 'Dashboard Opkom (Operasi & Komersial) Pelindo R4'
      : `Dashboard Opkom - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    kinerja: isAll
      ? 'Dashboard Kinerja Pelayanan Operasional Pelindo R4'
      : `Dashboard Kinerja - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    utilisasi: isAll
      ? 'Dashboard Utilisasi Dermaga & Lapangan (BOR/YOR/SOR)'
      : `Dashboard Utilisasi - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    peralatan: isAll
      ? 'Dashboard Monitoring Kesiapan & Utilisasi Peralatan'
      : `Dashboard Peralatan - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    fasilitas: isAll
      ? 'Dashboard Fasilitas & Infrastruktur Pelabuhan Regional 4'
      : `Dashboard Fasilitas - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    data_records: isAll
      ? 'Data Record Kinerja Pelabuhan Regional 4'
      : `Data Record Kinerja - Cabang [${selectedTerminal}] ${currentBranchName || selectedTerminal}`,
    master_data: 'Master Data Pelindo Regional 4',
    verification: 'Verifikasi & Pengesahan Data Kinerja',
    import_center: 'Pusat Impor Spreadsheet & Google Sheets',
    templates: 'Konfigurasi Template & Dynamic Mapping',
    audit_trail: 'Audit Trail & Rekam Jejak Sistem',
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setAdminMenuOpen(false);
  };

  return (
    <>
      {/* 1. TOP HEADER BAR: Brand, Tools, User, Mobile Toggle */}
      <header className="portsight-header">
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
              background: 'linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              flexShrink: 0,
            }}
          >
            <Anchor size={17} />
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
            >
              <Sun size={12} />
              <span className="hidden-on-mobile">Terang</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              title="Mode Gelap (Dark Mode)"
            >
              <Moon size={12} />
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
              fontSize: '11px',
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
              style={{ color: 'var(--accent-cyan)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
            >
              [{currentUser?.nipp || '-'}]
            </span>
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
                  onLogout();
                }
              }}
              className="btn-dark"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                cursor: 'pointer',
                fontWeight: 700,
              }}
              title="Keluar dari Akun (Logout)"
            >
              <LogOut size={12} color="#f87171" />
              <span className="hidden-on-mobile">Keluar</span>
            </button>
          )}

          {/* Desktop Only Tools (Hidden on Mobile/Tablet) */}
          <div className="header-desktop-tools">
            {onOpenManualInput && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn-primary"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-orange, #f97316)',
                  borderColor: 'var(--accent-orange, #f97316)',
                  color: '#ffffff',
                  boxShadow: '0 2px 6px rgba(249, 115, 22, 0.35)',
                  cursor: 'pointer',
                }}
                title="Input Data Manual (Finance, Opkom, Kinerja, Utilisasi, Peralatan, Fasilitas)"
              >
                <PlusCircle size={12} />
                <span>+ Input Manual</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="btn-primary"
              style={{
                padding: '4px 9px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
              }}
              title="Daftar Akun Baru PIC / Pengguna"
            >
              <UserPlus size={11} />
              <span>Daftar</span>
            </button>

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
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
              }}
              title={`Hak Akses: ${getRoleLabel()}`}
            >
              <Shield size={11} color="var(--accent-cyan)" />
              <span>{getRoleLabel()}</span>
            </div>

            <button onClick={onExportExcel} className="btn-dark" style={{ padding: '4px 8px', fontSize: '11px' }} title="Ekspor data Excel (.xlsx)">
              <Download size={12} />
            </button>

            <button onClick={onPrint} className="btn-dark" style={{ padding: '4px 8px', fontSize: '11px' }} title="Cetak Ringkasan">
              <Printer size={12} />
            </button>
          </div>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: mobileMenuOpen ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: mobileMenuOpen ? '#ffffff' : 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            aria-label="Menu Navigasi Mobile"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            {pendingCount > 0 && !mobileMenuOpen && (
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
      </header>

      {/* 2. DEDICATED NAVIGATION STRIP (Horizontally swipeable on mobile/tablet) */}
      <nav className="portsight-nav-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 'max-content' }}>
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Governance & Admin Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (!['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab)) {
                  handleSelectTab('data_records');
                }
                setAdminMenuOpen(!adminMenuOpen);
              }}
              className={`nav-tab-btn ${['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab) ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Layers size={13} />
              <span>Tata Kelola Data</span>
              {pendingCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#fbbf24',
                    color: '#0e1b2e',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '10px',
                    marginLeft: '2px',
                  }}
                >
                  {pendingCount}
                </span>
              )}
              <ChevronDown size={12} />
            </button>

            {adminMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px',
                  minWidth: '220px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.35)',
                  zIndex: 60,
                }}
                onClick={() => setAdminMenuOpen(false)}
              >
                {adminTabs.map((adm) => {
                  const Icon = adm.icon;
                  return (
                    <button
                      key={adm.id}
                      onClick={() => handleSelectTab(adm.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: activeTab === adm.id ? 'var(--accent-blue)' : 'none',
                        border: 'none',
                        padding: '8px 12px',
                        color: activeTab === adm.id ? '#ffffff' : 'var(--text-main)',
                        fontSize: '12px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={13} color={activeTab === adm.id ? '#ffffff' : 'var(--accent-cyan)'} />
                      <span>{adm.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 3. MOBILE DRAWER OVERLAY (Full responsiveness on HP) */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '52px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderBottom: '2px solid var(--accent-blue)',
              padding: '16px',
              maxHeight: 'calc(100vh - 52px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Profile Card Mobile */}
            <div
              style={{
                backgroundColor: 'var(--bg-inner)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={16} color="var(--accent-blue)" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
                    {currentUser ? currentUser.name : 'Pengguna Tamu'}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  [{currentUser?.nipp || '-'}]
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Role: <strong style={{ color: 'var(--text-main)' }}>{getRoleLabel()}</strong></span>
                <span>Cabang: <strong style={{ color: 'var(--text-main)' }}>{currentUser?.branch_id || 'R99'} {assignedBranch ? `(${assignedBranch.name})` : ''}</strong></span>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('register');
                  }}
                  className="btn-primary"
                  style={{ flex: 1, padding: '7px 10px', fontSize: '11.5px', justifyContent: 'center' }}
                >
                  <UserPlus size={12} />
                  <span>Daftar Akun PIC</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="btn-dark"
                    style={{
                      padding: '7px 12px',
                      fontSize: '11.5px',
                      color: '#f87171',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    }}
                  >
                    <LogOut size={12} color="#f87171" />
                    <span>Keluar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Informasi Hak Akses (Role) Pengguna */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-inner)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hak Akses (Role):</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={12} color="var(--accent-cyan)" />
                {getRoleLabel()}
              </span>
            </div>

            {/* Menu Navigasi Utama */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Menu Utama Dashboard:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                {mainTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        border: 'none',
                        background: isActive ? 'var(--accent-orange)' : 'var(--bg-inner)',
                        color: isActive ? '#ffffff' : 'var(--text-main)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{tab.label}</span>
                      <ChevronRight size={13} opacity={0.6} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tata Kelola Data Submenu */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={12} color="var(--accent-cyan)" />
                <span>Tata Kelola Data & Administrasi:</span>
                {pendingCount > 0 && (
                  <span style={{ backgroundColor: '#fbbf24', color: '#000', fontSize: '10px', padding: '1px 5px', borderRadius: '8px', fontWeight: 800 }}>
                    {pendingCount}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                {adminTabs.map((adm) => {
                  const Icon = adm.icon;
                  const isActive = activeTab === adm.id;
                  return (
                    <button
                      key={adm.id}
                      onClick={() => handleSelectTab(adm.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        border: 'none',
                        background: isActive ? 'var(--accent-blue)' : 'var(--bg-inner)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={13} color={isActive ? '#ffffff' : 'var(--accent-cyan)'} />
                      <span>{adm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Utilities */}
            {onOpenManualInput && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenManualInput();
                  }}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-orange, #f97316)',
                    borderColor: 'var(--accent-orange, #f97316)',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <PlusCircle size={13} />
                  <span>+ Input Data Manual</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', borderTop: onOpenManualInput ? 'none' : '1px solid var(--border-subtle)', paddingTop: onOpenManualInput ? '0' : '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onExportExcel();
                }}
                className="btn-dark"
                style={{ flex: 1, padding: '7px 8px', fontSize: '11px', justifyContent: 'center' }}
              >
                <Download size={12} />
                <span>Ekspor Excel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onPrint();
                }}
                className="btn-dark"
                style={{ flex: 1, padding: '7px 8px', fontSize: '11px', justifyContent: 'center' }}
              >
                <Printer size={12} />
                <span>Cetak</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PAGE SUBHEADER: Heading & Responsive Filter Chips */}
      <div className="portsight-subheader">
        <h1 className="page-heading">
          {pageHeadings[activeTab] || 'Dashboard Regional 4'}
        </h1>

        <div className="filter-chips-row">
          {/* Period Chip */}
          <div className="filter-chip">
            <Calendar size={13} style={{ flexShrink: 0 }} />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                fontSize: '11.5px',
              }}
            >
              <option value="YTD Sep 2026">YTD Sep 2026</option>
              <option value="YTD Jun 2026">YTD Jun 2026</option>
              <option value="YTD Mar 2026">YTD Mar 2026</option>
              <option value="FY 2025">FY 2025</option>
            </select>
          </div>

          {/* Terminal / Cabang Chip */}
          <div className="filter-chip" style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Building2 size={13} style={{ flexShrink: 0 }} />
            <select
              value={selectedTerminal}
              onChange={(e) => {
                if (!isPicCabang) {
                  setSelectedTerminal(e.target.value);
                }
              }}
              disabled={isPicCabang}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                outline: 'none',
                cursor: isPicCabang ? 'default' : 'pointer',
                fontSize: '11.5px',
                maxWidth: '220px',
                textOverflow: 'ellipsis',
                opacity: isPicCabang ? 0.95 : 1,
              }}
              title={isPicCabang ? `Terkunci: Akun PIC Cabang [${currentUser?.branch_id}] ${assignedBranch?.name || ''}` : 'Pilih Cabang Pelabuhan'}
            >
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {isPicCabang && (
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  backgroundColor: 'rgba(2, 132, 199, 0.2)',
                  color: 'var(--accent-cyan)',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  border: '1px solid rgba(2, 132, 199, 0.35)',
                  letterSpacing: '0.02em',
                }}
                title="Filter cabang terkunci sesuai penugasan PIC"
              >
                🔒 Cabang PIC
              </span>
            )}
          </div>

          {/* Comparison Chip */}
          <div className="filter-chip hidden-on-mobile">
            <BarChart3 size={13} />
            <span>vs RKAP & 2025</span>
          </div>
        </div>
      </div>
    </>
  );
}
