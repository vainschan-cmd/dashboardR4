'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Search,
  Check,
  RotateCcw,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import {
  OFFICIAL_BRANCHES,
  MAIN_NAVIGATION_TABS,
  parseSelectedBranches,
  isBranchMatch,
  getSelectedBranchLabel,
} from '@/lib/constants';

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
  comparisonMode?: string;
  setComparisonMode?: (mode: string) => void;
  onOpenComparisonModal?: () => void;
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
  comparisonMode = 'all',
  setComparisonMode,
  onOpenComparisonModal,
}: PortSightHeaderProps) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalCompMode, setInternalCompMode] = useState<string>('all');
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
    }
    if (branchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [branchDropdownOpen]);

  const currentCompMode = comparisonMode || internalCompMode;
  const handleCompChange = (val: string) => {
    if (val === 'modal') {
      if (onOpenComparisonModal) onOpenComparisonModal();
      return;
    }
    if (setComparisonMode) setComparisonMode(val);
    else setInternalCompMode(val);
  };

  const mainTabs = MAIN_NAVIGATION_TABS;

  const isPicCabang = userRole === 'pic_cabang' || (currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99');
  const canManageUsers = userRole === 'super_admin' || userRole === 'admin_regional';
  const assignedBranch = currentUser?.branch_id ? OFFICIAL_BRANCHES.find(b => b.code === currentUser?.branch_id) : undefined;
  const currentBranchName = OFFICIAL_BRANCHES.find(b => b.code === selectedTerminal)?.name;
  const isAll = !selectedTerminal || selectedTerminal === 'ALL';
  const selectedBranchTitle = isAll
    ? 'Regional 4 (Konsolidasi 28 Cabang)'
    : getSelectedBranchLabel(selectedTerminal);

  const selectedBranchCodes = useMemo(() => {
    if (selectedTerminal === 'NONE') return [];
    if (!selectedTerminal || selectedTerminal === 'ALL') {
      return OFFICIAL_BRANCHES.map(b => b.code);
    }
    return parseSelectedBranches(selectedTerminal);
  }, [selectedTerminal]);

  const isAllSelected = selectedTerminal === 'ALL' || (selectedBranchCodes.length === OFFICIAL_BRANCHES.length && selectedTerminal !== 'NONE');

  const handleToggleBranch = (code: string) => {
    if (isPicCabang) return;
    let nextCodes: string[];
    if (selectedTerminal === 'NONE') {
      nextCodes = [code];
    } else if (isAllSelected) {
      nextCodes = OFFICIAL_BRANCHES.map(b => b.code).filter(c => c !== code);
    } else if (selectedBranchCodes.includes(code)) {
      nextCodes = selectedBranchCodes.filter(c => c !== code);
    } else {
      nextCodes = [...selectedBranchCodes, code];
    }

    if (nextCodes.length === 0) {
      setSelectedTerminal('NONE');
    } else if (nextCodes.length === OFFICIAL_BRANCHES.length) {
      setSelectedTerminal('ALL');
    } else {
      setSelectedTerminal(nextCodes.join(','));
    }
  };

  const handleSelectOnly = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPicCabang) return;
    setSelectedTerminal(code);
  };

  const handleSelectAll = () => {
    if (isPicCabang) return;
    setSelectedTerminal('ALL');
  };

  const handleResetBranches = () => {
    if (isPicCabang) return;
    setSelectedTerminal('NONE');
    setBranchSearchQuery('');
  };

  const filteredBranchesForPicker = useMemo(() => {
    if (!branchSearchQuery.trim()) return OFFICIAL_BRANCHES;
    const q = branchSearchQuery.toLowerCase();
    return OFFICIAL_BRANCHES.filter(
      b => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
    );
  }, [branchSearchQuery]);

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
    : canManageUsers
    ? [
        { id: 'data_records', label: 'Data Record Kinerja (Raw)', icon: Database },
        { id: 'master_data', label: 'Master Data & KPI', icon: Layers },
        { id: 'verification', label: `Verifikasi & Monitoring ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
        { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet },
        { id: 'templates', label: 'Template & Mapping', icon: Sliders },
        { id: 'audit_trail', label: 'Audit Trail & Log', icon: History },
      ]
    : [
        { id: 'data_records', label: 'Data Record Kinerja (Raw)', icon: Database },
        { id: 'verification', label: `Verifikasi & Monitoring ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
        { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet },
        { id: 'audit_trail', label: 'Audit Trail & Log', icon: History },
      ];

  const pageHeadings: Record<string, string> = {
    beranda: isAll
      ? 'Ringkasan Eksekutif Regional 4 (Konsolidasi 28 Cabang)'
      : `Ringkasan Eksekutif - ${selectedBranchTitle}`,
    periode: isAll
      ? 'Data per Periode & Analisis Rentang Waktu (Multi-Modul)'
      : `Data per Periode - ${selectedBranchTitle}`,
    keuangan: isAll
      ? 'Dashboard Finance (Keuangan) Pelindo R4'
      : `Dashboard Finance - ${selectedBranchTitle}`,
    opkom: isAll
      ? 'Dashboard Opkom (Operasi & Komersial) Pelindo R4'
      : `Dashboard Opkom - ${selectedBranchTitle}`,
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
      ? 'Data Record Kinerja Pelabuhan Regional 4'
      : `Data Record Kinerja - ${selectedBranchTitle}`,
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
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              flexShrink: 0,
            }}
          >
            <img
              src="/pelindo-logo.png"
              alt="Logo Pelindo"
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

            {/* Tombol Daftar Akun Baru: Hanya muncul untuk role Super Admin & Administrator */}
            {canManageUsers && (
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
                {canManageUsers && (
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
                )}
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

          {/* Terminal / Cabang Multi-Select Filter Chip */}
          <div ref={branchDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <div
              className="filter-chip"
              onClick={() => {
                if (!isPicCabang) {
                  setBranchDropdownOpen(prev => !prev);
                }
              }}
              style={{
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isPicCabang ? 'default' : 'pointer',
                opacity: isPicCabang ? 0.95 : 1,
                background: branchDropdownOpen
                  ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)')
                  : undefined,
                borderColor: branchDropdownOpen ? 'var(--accent-cyan)' : undefined,
                userSelect: 'none',
              }}
              title={
                isPicCabang
                  ? `Terkunci: Akun PIC Cabang [${currentUser?.branch_id}] ${assignedBranch?.name || ''}`
                  : 'Klik untuk memilih satu atau beberapa cabang (multi-select centang)'
              }
            >
              <Building2 size={13} style={{ flexShrink: 0, color: 'var(--accent-cyan)' }} />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '11.5px',
                  maxWidth: '190px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isPicCabang
                  ? `[${currentUser?.branch_id}] ${assignedBranch?.name || currentUser?.branch_id}`
                  : getSelectedBranchLabel(selectedTerminal)}
              </span>

              {!isPicCabang && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    background: isAllSelected
                      ? (theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.15)')
                      : (selectedBranchCodes.length === 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--accent-cyan)'),
                    color: isAllSelected
                      ? 'inherit'
                      : (selectedBranchCodes.length === 0 ? '#ef4444' : '#041727'),
                    padding: '1px 5px',
                    borderRadius: '8px',
                    lineHeight: 1.2,
                    flexShrink: 0,
                  }}
                  title={
                    isAllSelected
                      ? 'Semua 28 Cabang terpilih'
                      : (selectedBranchCodes.length === 0 ? 'Belum ada cabang terpilih' : `${selectedBranchCodes.length} dari 28 cabang terpilih`)
                  }
                >
                  {isAllSelected ? '28' : `${selectedBranchCodes.length}/28`}
                </span>
              )}

              {!isPicCabang && (
                <ChevronDown
                  size={12}
                  style={{
                    transform: branchDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                    opacity: 0.7,
                    flexShrink: 0,
                  }}
                />
              )}

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

            {/* Dropdown Popover with Checkboxes */}
            {branchDropdownOpen && !isPicCabang && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 1100,
                  width: '330px',
                  maxWidth: '90vw',
                  background: theme === 'dark' ? '#0b1329' : '#ffffff',
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  border: theme === 'dark' ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: theme === 'dark'
                    ? '0 16px 36px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                    : '0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease-out',
                }}
              >
                {/* Header & Quick Action Buttons */}
                <div
                  style={{
                    padding: '10px 12px 8px 12px',
                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                    background: theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={13} style={{ color: 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Filter Multi-Cabang</span>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--accent-cyan)',
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '1.5px 6px',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      {isAllSelected ? 'Semua (28)' : `${selectedBranchCodes.length} Terpilih`}
                    </span>
                  </div>

                  {/* Search input */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      background: theme === 'dark' ? 'rgba(0, 0, 0, 0.35)' : '#ffffff',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      marginBottom: '8px',
                      gap: '6px',
                    }}
                  >
                    <Search size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={branchSearchQuery}
                      onChange={(e) => setBranchSearchQuery(e.target.value)}
                      placeholder="Cari cabang / kode (cth: Makassar, R01)..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'inherit',
                        fontSize: '11px',
                        width: '100%',
                      }}
                      autoFocus
                    />
                    {branchSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setBranchSearchQuery('')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Quick Action buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: theme === 'dark' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #bae6fd',
                        background: isAllSelected
                          ? 'rgba(56, 189, 248, 0.2)'
                          : (theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#ffffff'),
                        color: theme === 'dark' ? '#f0f9ff' : '#0369a1',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={11} />
                      <span>Pilih Semua (28)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetBranches}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Kosongkan semua centang agar bisa pilih per cabang"
                    >
                      <RotateCcw size={10} />
                      <span>Reset (Kosongkan)</span>
                    </button>
                  </div>
                </div>

                {/* Branch items list */}
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '4px',
                  }}
                >
                  {/* Option 0: Semua Cabang */}
                  {!branchSearchQuery && (
                    <>
                      <div
                        onClick={handleSelectAll}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isAllSelected
                            ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe')
                            : 'transparent',
                          transition: 'background 0.15s ease',
                          marginBottom: '2px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: isAllSelected
                                ? '1.5px solid var(--accent-cyan)'
                                : (theme === 'dark' ? '1.5px solid rgba(255, 255, 255, 0.25)' : '1.5px solid #94a3b8'),
                              background: isAllSelected ? 'var(--accent-cyan)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isAllSelected && <Check size={11} color="#041727" strokeWidth={3} />}
                          </div>
                          <span style={{ fontSize: '11.5px', fontWeight: 700 }}>
                            Semua Cabang (Konsolidasi)
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            color: '#94a3b8',
                            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          28 Cabang
                        </span>
                      </div>
                      <div
                        style={{
                          height: '1px',
                          background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                          margin: '4px 6px',
                        }}
                      />
                    </>
                  )}

                  {/* 28 Official Branches */}
                  {filteredBranchesForPicker.length === 0 ? (
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                      Tidak ada cabang yang cocok dengan pencarian
                    </div>
                  ) : (
                    filteredBranchesForPicker.map((b) => {
                      const isChecked = isAllSelected || selectedBranchCodes.includes(b.code);
                      return (
                        <div
                          key={b.code}
                          onClick={() => handleToggleBranch(b.code)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5.5px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: isChecked && !isAllSelected
                              ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff')
                              : 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isChecked || isAllSelected) {
                              e.currentTarget.style.background =
                                theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              isChecked && !isAllSelected
                                ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff')
                                : 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '4px',
                                border: isChecked
                                  ? '1.5px solid var(--accent-cyan)'
                                  : (theme === 'dark' ? '1.5px solid rgba(255, 255, 255, 0.25)' : '1.5px solid #94a3b8'),
                                background: isChecked ? 'var(--accent-cyan)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isChecked && <Check size={11} color="#041727" strokeWidth={3} />}
                            </div>

                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--accent-cyan)',
                                background: 'rgba(56, 189, 248, 0.1)',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                flexShrink: 0,
                              }}
                            >
                              {b.code}
                            </span>

                            <span
                              style={{
                                fontSize: '11.5px',
                                fontWeight: isChecked ? 600 : 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {b.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleSelectOnly(b.code, e)}
                            style={{
                              padding: '1px 6px',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #cbd5e1',
                              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              color: theme === 'dark' ? '#94a3b8' : '#64748b',
                              cursor: 'pointer',
                              flexShrink: 0,
                              marginLeft: '6px',
                            }}
                            title={`Pilih hanya cabang [${b.code}] ${b.name}`}
                          >
                            Hanya
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer status & Close button */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                    background: theme === 'dark' ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    {isAllSelected
                      ? 'Semua 28 cabang aktif (Konsolidasi Regional 4)'
                      : (selectedBranchCodes.length === 0
                        ? '0 cabang terpilih (Centang cabang yang diinginkan)'
                        : `${selectedBranchCodes.length} cabang aktif`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBranchDropdownOpen(false)}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: 'none',
                      background: 'var(--accent-blue)',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comparison Chip (Active Menu) */}
          <div
            className="filter-chip hidden-on-mobile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <BarChart3 size={13} style={{ flexShrink: 0, color: 'var(--accent-cyan)' }} />
            <select
              value={currentCompMode}
              onChange={(e) => handleCompChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                fontSize: '11.5px',
              }}
              title="Pilih mode pembanding atau buka matriks komparasi lengkap"
            >
              <option value="all">vs RKAP & 2025</option>
              <option value="rkap">vs Target RKAP 2026</option>
              <option value="yoy">vs Realisasi 2025 (YoY)</option>
              <option value="modal">📊 Buka Matriks Komparasi...</option>
            </select>
            <button
              type="button"
              onClick={() => onOpenComparisonModal && onOpenComparisonModal()}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '4px',
                color: 'var(--accent-cyan)',
                padding: '1.5px 6px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                lineHeight: 1.2,
                marginLeft: '2px',
              }}
              title="Buka Matriks Detail Komparasi vs RKAP & 2025"
            >
              Detail
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
