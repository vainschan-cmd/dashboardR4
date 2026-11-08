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
  Lock,
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
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
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
  onToggleMobileMenu,
  isMobileMenuOpen = false,
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

  const isBod =
    userRole === 'viewer' ||
    currentUser?.role === 'viewer' ||
    String(userRole).toLowerCase().includes('bod') ||
    String(currentUser?.role).toLowerCase().includes('bod') ||
    currentUser?.nipp === '10000' ||
    currentUser?.username === '10000' ||
    String(currentUser?.name).toLowerCase().includes('bod');

  const isPicCabang = !isBod && (userRole === 'pic_cabang' || (currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99'));
  const canManageUsers = !isBod && (userRole === 'super_admin' || userRole === 'admin_regional');
  const assignedBranch = currentUser?.branch_id ? OFFICIAL_BRANCHES.find(b => b.code === currentUser?.branch_id) : undefined;
  const currentBranchName = OFFICIAL_BRANCHES.find(b => b.code === selectedTerminal)?.name;
  const isAll = !isPicCabang && (!selectedTerminal || selectedTerminal === 'ALL');
  const selectedBranchTitle = isPicCabang
    ? `[${currentUser?.branch_id}] ${assignedBranch?.name || currentUser?.branch_id}`
    : isAll
      ? 'Regional 4 (Konsolidasi 28 Cabang)'
      : getSelectedBranchLabel(selectedTerminal);

  const selectedBranchCodes = useMemo(() => {
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      return [currentUser.branch_id];
    }
    if (selectedTerminal === 'NONE') return [];
    if (!selectedTerminal || selectedTerminal === 'ALL') {
      return OFFICIAL_BRANCHES.map(b => b.code);
    }
    return parseSelectedBranches(selectedTerminal);
  }, [isPicCabang, currentUser?.branch_id, selectedTerminal]);

  const isAllSelected = !isPicCabang && (selectedTerminal === 'ALL' || (selectedBranchCodes.length === OFFICIAL_BRANCHES.length && selectedTerminal !== 'NONE'));

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
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      const b = OFFICIAL_BRANCHES.find(x => x.code === currentUser.branch_id);
      return b ? [b] : (assignedBranch ? [assignedBranch] : []);
    }
    if (!branchSearchQuery.trim()) return OFFICIAL_BRANCHES;
    const q = branchSearchQuery.toLowerCase();
    return OFFICIAL_BRANCHES.filter(
      b => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
    );
  }, [isPicCabang, currentUser?.branch_id, assignedBranch, branchSearchQuery]);

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
            {onOpenManualInput && !isBod && (
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
              color: (isMobileMenuOpen || mobileMenuOpen) ? '#ffffff' : 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            aria-label="Menu Navigasi Mobile"
          >
            {(isMobileMenuOpen || mobileMenuOpen) ? <X size={16} /> : <Menu size={16} />}
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
      </header>

      {/* PAGE SUBHEADER: Heading & Responsive Filter Chips */}
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
                setBranchDropdownOpen(prev => !prev);
              }}
              style={{
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                background: branchDropdownOpen
                  ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.12)')
                  : undefined,
                borderColor: branchDropdownOpen ? 'var(--accent-cyan)' : undefined,
                userSelect: 'none',
              }}
              title={
                isPicCabang
                  ? `Filter Terkunci: Akun PIC Cabang [${currentUser?.branch_id}] ${assignedBranch?.name || ''} (Klik untuk detail filter)`
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

              {isPicCabang ? (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: 'var(--accent-cyan)',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    lineHeight: 1.2,
                    flexShrink: 0,
                  }}
                  title="Filter cabang penugasan aktif (1/1)"
                >
                  1/1
                </span>
              ) : (
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

              <ChevronDown
                size={12}
                style={{
                  transform: branchDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  opacity: 0.7,
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Dropdown Popover with Checkboxes */}
            {branchDropdownOpen && (
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPicCabang ? '6px' : '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={13} style={{ color: 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>
                        {isPicCabang ? 'Filter Cabang PIC' : 'Filter Multi-Cabang'}
                      </span>
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
                      {isPicCabang ? '1 Cabang (Terkunci)' : (isAllSelected ? 'Semua (28)' : `${selectedBranchCodes.length} Terpilih`)}
                    </span>
                  </div>

                  {isPicCabang ? (
                    <div
                      style={{
                        padding: '7px 9px',
                        borderRadius: '6px',
                        background: theme === 'dark' ? 'rgba(56, 189, 248, 0.08)' : '#f0f9ff',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        fontSize: '11px',
                        lineHeight: 1.4,
                        color: theme === 'dark' ? '#bae6fd' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                      }}
                    >
                      <Lock size={13} style={{ flexShrink: 0, color: 'var(--accent-cyan)' }} />
                      <span>
                        Akses filter terkunci khusus cabang penugasan Anda: <strong>[{currentUser?.branch_id}] {assignedBranch?.name}</strong>.
                      </span>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* Branch items list */}
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '4px',
                  }}
                >
                  {/* Option 0: Semua Cabang (Hanya untuk Admin / Regional) */}
                  {!isPicCabang && !branchSearchQuery && (
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

                  {/* Branches List: For PIC Cabang only their assigned branch is included */}
                  {filteredBranchesForPicker.length === 0 ? (
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                      Tidak ada cabang yang cocok dengan pencarian
                    </div>
                  ) : (
                    filteredBranchesForPicker.map((b) => {
                      const isChecked = isPicCabang || isAllSelected || selectedBranchCodes.includes(b.code);
                      return (
                        <div
                          key={b.code}
                          onClick={() => {
                            if (!isPicCabang) handleToggleBranch(b.code);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5.5px 8px',
                            borderRadius: '6px',
                            cursor: isPicCabang ? 'default' : 'pointer',
                            background: isChecked && (!isAllSelected || isPicCabang)
                              ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff')
                              : 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isPicCabang && (!isChecked || isAllSelected)) {
                              e.currentTarget.style.background =
                                theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isPicCabang) {
                              e.currentTarget.style.background =
                                isChecked && !isAllSelected
                                  ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff')
                                  : 'transparent';
                            }
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

                          {isPicCabang ? (
                            <span
                              style={{
                                padding: '2px 7px',
                                fontSize: '9.5px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--accent-cyan)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                flexShrink: 0,
                                marginLeft: '6px',
                              }}
                            >
                              Cabang Anda (Aktif)
                            </span>
                          ) : (
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
                          )}
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
                    {isPicCabang
                      ? `1 cabang penugasan PIC aktif [${currentUser?.branch_id}]`
                      : (isAllSelected
                        ? 'Semua 28 cabang aktif (Konsolidasi Regional 4)'
                        : (selectedBranchCodes.length === 0
                          ? '0 cabang terpilih (Centang cabang yang diinginkan)'
                          : `${selectedBranchCodes.length} cabang aktif`))}
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
