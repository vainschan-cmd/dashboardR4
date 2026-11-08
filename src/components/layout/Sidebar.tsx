'use client';

import React from 'react';
import {
  LayoutDashboard,
  CalendarRange,
  Wallet,
  Ship,
  BarChart3,
  Activity,
  Wrench,
  Building2,
  Database,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  Sliders,
  History,
  PlusCircle,
  LogOut,
  Shield,
  X,
  ChevronRight,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { MAIN_NAVIGATION_TABS } from '@/lib/constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  currentUser: User | null;
  pendingCount?: number;
  isBod?: boolean;
  canManageUsers?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  theme?: 'dark' | 'light';
  onLogout?: () => void;
  onOpenManualInput?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  userRole,
  currentUser,
  pendingCount = 0,
  isBod = false,
  canManageUsers = false,
  isOpenMobile = false,
  onCloseMobile,
  theme = 'light',
  onLogout,
  onOpenManualInput,
}: SidebarProps) {
  // Mapping icons to main tabs
  const tabIcons: Record<string, React.ElementType> = {
    beranda: LayoutDashboard,
    periode: CalendarRange,
    keuangan: Wallet,
    opkom: Ship,
    kinerja: BarChart3,
    utilisasi: Activity,
    peralatan: Wrench,
    fasilitas: Building2,
  };

  const adminMenus = [
    { id: 'data_records', label: 'Data Record Kinerja', icon: Database },
    ...(canManageUsers ? [{ id: 'master_data', label: 'Master Data & KPI', icon: Layers }] : []),
    { id: 'verification', label: 'Verifikasi & Monitoring', icon: CheckCircle2, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'import_center', label: 'Import Spreadsheet', icon: FileSpreadsheet },
    { id: 'templates', label: 'Template Mapping', icon: Sliders },
    { id: 'audit_trail', label: 'Audit Trail & Log', icon: History },
  ];

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const getRoleLabel = () => {
    if (isBod) return 'BOD / Direksi';
    switch (userRole) {
      case 'super_admin': return 'Super Admin';
      case 'admin_regional': return 'Admin Regional 4';
      case 'pic_dept_regional': return 'PIC Dept Regional';
      case 'pic_cabang': return 'PIC Cabang';
      case 'viewer': return 'Viewer';
      default: return userRole;
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Component (Vertikal Berjejer ke Bawah) */}
      <aside className={`portsight-sidebar ${isOpenMobile ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-header">
          <div
            onClick={() => handleSelect('beranda')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}
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
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="brand-title" style={{ fontSize: '14px', fontWeight: 800 }}>PELINDO R4</span>
                <span className="brand-accent" style={{ fontSize: '13px', fontWeight: 800 }}>PortDash</span>
              </div>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Regional 4 Executive Suite
              </span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            className="sidebar-close-mobile-btn"
            onClick={onCloseMobile}
            aria-label="Tutup Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card in Sidebar */}
        <div className="sidebar-user-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name?.split(',')[0] || 'Pengguna'}
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              [{currentUser?.nipp || '-'}]
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isBod ? '#38bdf8' : 'var(--accent-cyan)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                padding: '2px 7px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
              }}
            >
              <Shield size={10} />
              {getRoleLabel()}
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {currentUser?.branch_id || 'R99'}
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="sidebar-nav-scroll">
          {/* Section: Menu Utama Dashboard */}
          <div className="sidebar-section-title">
            <span>MENU UTAMA KINERJA</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {MAIN_NAVIGATION_TABS.map((tab) => {
              const Icon = tabIcons[tab.id] || LayoutDashboard;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelect(tab.id)}
                  className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} className={`sidebar-icon ${isActive ? 'active' : ''}`} />
                  <span className="sidebar-nav-label">{tab.label}</span>
                  {isActive && <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.8 }} />}
                </button>
              );
            })}
          </div>

          {/* Section: Tata Kelola Data (Hidden for BOD) */}
          {!isBod && (
            <div style={{ marginTop: '16px' }}>
              <div className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>PENGELOLAAN & TATA KELOLA</span>
                {pendingCount > 0 && (
                  <span style={{ backgroundColor: '#fbbf24', color: '#0e1b2e', fontSize: '9.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '8px' }}>
                    {pendingCount}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {adminMenus.map((adm) => {
                  const Icon = adm.icon;
                  const isActive = activeTab === adm.id;
                  return (
                    <button
                      key={adm.id}
                      onClick={() => handleSelect(adm.id)}
                      className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={16} className={`sidebar-icon ${isActive ? 'active' : ''}`} />
                      <span className="sidebar-nav-label">{adm.label}</span>
                      {adm.badge !== undefined && (
                        <span className="sidebar-badge">{adm.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Manual Input Action (Hidden for BOD) */}
          {onOpenManualInput && !isBod && (
            <div style={{ marginTop: '16px', padding: '0 2px' }}>
              <button
                type="button"
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                  onOpenManualInput();
                }}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-orange, #f97316)',
                  borderColor: 'var(--accent-orange, #f97316)',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
                  cursor: 'pointer',
                }}
              >
                <PlusCircle size={14} />
                <span>+ Input Data Manual</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-simulation-pill">
            <div className="sidebar-simulation-dot" />
            <span>DATA SIMULASI RESMI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Suite v2.4</span>
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
                    if (onCloseMobile) onCloseMobile();
                    onLogout();
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 4px',
                }}
                title="Keluar dari Akun"
              >
                <LogOut size={12} color="#f87171" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
