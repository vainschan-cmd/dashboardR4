'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Target,
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
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { User, UserRole } from '@/lib/types';
import { MAIN_NAVIGATION_TABS, OFFICIAL_BRANCHES } from '@/lib/constants';

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

const EXECUTIVE_TAB_IDS = new Set(['beranda', 'isu_strategis']);

const TAB_ICONS: Record<string, React.ElementType> = {
  beranda: LayoutDashboard,
  isu_strategis: Target,
  periode: CalendarRange,
  keuangan: Wallet,
  opkom: Ship,
  kinerja: BarChart3,
  utilisasi: Activity,
  peralatan: Wrench,
  fasilitas: Building2,
};

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  pendingCount = 0,
  isBod = false,
  canManageUsers = false,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ label: string; top: number; badge?: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('portsight_sidebar_collapsed');
        if (saved === 'true') {
          setIsCollapsed(true);
        }
      } catch (e) {
        console.warn('[Sidebar] Failed to read collapse preference:', e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('portsight_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('[Sidebar] Failed to persist collapse preference:', e);
      }
      return next;
    });
    setHoveredTooltip(null);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, label: string, badge?: number) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      label,
      top: rect.top + rect.height / 2,
      badge,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const executiveTabs = MAIN_NAVIGATION_TABS.filter((tab) => EXECUTIVE_TAB_IDS.has(tab.id));
  const moduleTabs = MAIN_NAVIGATION_TABS.filter((tab) => !EXECUTIVE_TAB_IDS.has(tab.id));

  const governanceMenus = [
    {
      id: 'verification',
      label: 'Verifikasi & Monitoring',
      icon: CheckCircle2,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { id: 'data_records', label: 'Rekaman Data Kinerja', icon: Database },
    { id: 'import_center', label: 'Penginputan Data', icon: FileSpreadsheet },
    ...(canManageUsers ? [{ id: 'master_data', label: 'Master Data & KPI', icon: Layers }] : []),
    { id: 'templates', label: 'Pemetaan Template', icon: Sliders },
    { id: 'audit_trail', label: 'Jejak Audit Sistem', icon: History },
  ];

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const assignedBranchName =
    currentUser?.branch_id && currentUser.branch_id !== 'R99'
      ? OFFICIAL_BRANCHES.find((b) => b.code === currentUser.branch_id)?.name || currentUser.branch_id
      : 'Regional 4';

  const renderNavItem = (
    id: string,
    label: string,
    Icon: React.ElementType,
    badge?: number
  ) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => handleSelect(id)}
        onMouseEnter={(e) => handleMouseEnter(e, label, badge)}
        onMouseLeave={handleMouseLeave}
        className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        aria-label={isCollapsed ? label : undefined}
        title={isCollapsed ? label : undefined}
      >
        <span className="sidebar-icon-wrap">
          <Icon size={17} className={`sidebar-icon ${isActive ? 'active' : ''}`} aria-hidden="true" />
          {isCollapsed && badge !== undefined && badge > 0 && (
            <span className="sidebar-collapsed-dot" aria-hidden="true" />
          )}
        </span>
        {!isCollapsed && <span className="sidebar-nav-label">{label}</span>}
        {!isCollapsed && badge !== undefined && badge > 0 && (
          <span className="sidebar-badge" aria-label={`${badge} menunggu`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navigasi utama"
        className={`portsight-sidebar ${isOpenMobile ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      >
        {/* Brand Header (Single Source of Brand on Desktop) */}
        <div className="sidebar-brand-header">
          <button
            type="button"
            onClick={() => handleSelect('beranda')}
            onMouseEnter={(e) => handleMouseEnter(e, 'PortDash — Pelindo Regional 4')}
            onMouseLeave={handleMouseLeave}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? '0' : '10px',
              flex: isCollapsed ? 'none' : 1,
              minWidth: 0,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              textAlign: 'left',
            }}
            aria-label="Kembali ke Beranda PortDash"
          >
            <div
              style={{
                width: isCollapsed ? '30px' : '32px',
                height: isCollapsed ? '30px' : '32px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
                flexShrink: 0,
                transition: 'all 0.2s ease',
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

            {!isCollapsed && (
              <div className="sidebar-brand-text" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', lineHeight: 1.15 }}>
                  <span className="brand-title" style={{ fontSize: '13.5px', fontWeight: 800 }}>PELINDO R4</span>
                  <span className="brand-accent" style={{ fontSize: '11.5px', fontWeight: 800 }}>PortDash</span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}
                >
                  Executive Dashboard
                </span>
              </div>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={handleToggleCollapse}
              title={isCollapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
              aria-label={isCollapsed ? 'Lebarkan Sidebar' : 'Ciutkan Sidebar'}
              onMouseEnter={(e) => handleMouseEnter(e, isCollapsed ? 'Lebarkan Menu' : 'Ciutkan Menu')}
              onMouseLeave={handleMouseLeave}
            >
              {isCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
            </button>

            <button
              type="button"
              className="sidebar-close-mobile-btn"
              onClick={onCloseMobile}
              aria-label="Tutup Menu Navigasi"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Hierarchical Navigation */}
        <nav className="sidebar-nav-scroll" aria-label="Menu modul dashboard">
          {/* Group 1: Eksekutif */}
          {!isCollapsed ? (
            <div className="sidebar-section-title">
              <span>EKSEKUTIF</span>
            </div>
          ) : (
            <div className="sidebar-collapsed-divider" />
          )}
          <div className="sidebar-nav-group">
            {executiveTabs.map((tab) =>
              renderNavItem(tab.id, tab.label, TAB_ICONS[tab.id] || LayoutDashboard)
            )}
          </div>

          {/* Group 2: Modul Kinerja */}
          <div style={{ marginTop: isCollapsed ? '8px' : '16px' }}>
            {!isCollapsed ? (
              <div className="sidebar-section-title">
                <span>MODUL KINERJA</span>
              </div>
            ) : (
              <div className="sidebar-collapsed-divider" />
            )}
            <div className="sidebar-nav-group">
              {moduleTabs.map((tab) =>
                renderNavItem(tab.id, tab.label, TAB_ICONS[tab.id] || LayoutDashboard)
              )}
            </div>
          </div>

          {/* Group 3: Tata Kelola (Non-BOD) */}
          {!isBod && (
            <div style={{ marginTop: isCollapsed ? '8px' : '16px' }}>
              {!isCollapsed ? (
                <div
                  className="sidebar-section-title"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>TATA KELOLA</span>
                  {pendingCount > 0 && (
                    <span className="sidebar-section-count" aria-label={`${pendingCount} data menunggu verifikasi`}>
                      {pendingCount}
                    </span>
                  )}
                </div>
              ) : (
                <div className="sidebar-collapsed-divider" />
              )}
              <div className="sidebar-nav-group">
                {governanceMenus.map((adm) =>
                  renderNavItem(adm.id, adm.label, adm.icon, adm.badge)
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Minimal Status Footer (No Duplicate User Card or Logout Button) */}
        <div className="sidebar-footer">
          {!isCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="sidebar-simulation-pill">
                <div className="sidebar-simulation-dot" aria-hidden="true" />
                <span>POSTGRESQL TERINTEGRASI</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  padding: '0 2px',
                }}
              >
                <span>Cakupan</span>
                <strong
                  style={{
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}
                  title={assignedBranchName}
                >
                  {assignedBranchName}
                </strong>
              </div>
            </div>
          ) : (
            <div
              className="sidebar-collapsed-status"
              onMouseEnter={(e) => handleMouseEnter(e, `PostgreSQL Aktif • ${assignedBranchName}`)}
              onMouseLeave={handleMouseLeave}
              title={`PostgreSQL Aktif • ${assignedBranchName}`}
            >
              <div className="sidebar-simulation-dot" aria-hidden="true" />
            </div>
          )}
        </div>
      </aside>

      {/* Floating Tooltip for Collapsed Mode */}
      {isCollapsed && hoveredTooltip && (
        <div
          className="sidebar-floating-tooltip"
          style={{
            position: 'fixed',
            left: '74px',
            top: `${hoveredTooltip.top}px`,
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--bg-dropdown)',
            color: 'var(--text-title)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
            zIndex: 9999,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'sidebarTooltipIn 0.15s ease',
          }}
        >
          <span>{hoveredTooltip.label}</span>
          {hoveredTooltip.badge !== undefined && hoveredTooltip.badge > 0 && (
            <span className="sidebar-badge" style={{ marginLeft: 0 }}>
              {hoveredTooltip.badge}
            </span>
          )}
        </div>
      )}
    </>
  );
}
