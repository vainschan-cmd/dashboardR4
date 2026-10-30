'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Wallet,
  Briefcase,
  Ship,
  Wrench,
  UserCheck,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Sliders,
  Database,
  History,
  Anchor,
  X
} from 'lucide-react';
import { UserRole } from '@/lib/types';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  userRole: UserRole;
  pendingCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  activeMenu,
  setActiveMenu,
  userRole,
  pendingCount = 0,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const mainMenus = [
    { id: 'summary', label: 'Summary Eksekutif', icon: LayoutDashboard },
    { id: 'pelanggan', label: 'Pelanggan', icon: Users },
    { id: 'hsse', label: 'HSSE (K3 & Lingkungan)', icon: ShieldAlert },
    { id: 'keuangan', label: 'Keuangan & RKAP', icon: Wallet },
    { id: 'komersial', label: 'Komersial', icon: Briefcase },
    { id: 'operasional', label: 'Operasional', icon: Ship },
    { id: 'teknik', label: 'Teknik & Fasilitas', icon: Wrench },
    { id: 'sdm', label: 'SDM (Human Capital)', icon: UserCheck },
    { id: 'profil_cabang', label: 'Profil Cabang Pelabuhan', icon: Building2 },
  ];

  const adminMenus = [
    { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet, roles: ['super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang'] },
    { id: 'verification', label: 'Verifikasi & Monitoring', icon: CheckCircle2, roles: ['super_admin', 'admin_regional', 'pic_dept_regional'], badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'templates', label: 'Template & Mapping', icon: Sliders, roles: ['super_admin', 'admin_regional'] },
    { id: 'master_data', label: 'Master Data Cabang & KPI', icon: Database, roles: ['super_admin', 'admin_regional'] },
    { id: 'audit_trail', label: 'Audit Trail & Log', icon: History, roles: ['super_admin', 'admin_regional'] },
  ];

  const allowedAdminMenus = adminMenus.filter(m => m.roles.includes(userRole));

  const handleSelect = (id: string) => {
    setActiveMenu(id);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} />
      )}
      <aside className={`sidebar ${isOpenMobile ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-icon">
            <Anchor size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">PORT EXECUTIVE</div>
            <div className="brand-subtitle">Monitoring Pelabuhan</div>
          </div>
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">9 MENU UTAMA KINERJA</div>
          {mainMenus.map((m) => {
            const Icon = m.icon;
            const isActive = activeMenu === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{ width: '100%', textAlign: 'left', background: 'none' }}
              >
                <Icon size={18} className="nav-icon" />
                <span>{m.label}</span>
              </button>
            );
          })}

          {allowedAdminMenus.length > 0 && (
            <>
              <div className="nav-section-title" style={{ marginTop: '12px' }}>PENGELOLAAN & TATA KELOLA</div>
              {allowedAdminMenus.map((m) => {
                const Icon = m.icon;
                const isActive = activeMenu === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{ width: '100%', textAlign: 'left', background: 'none' }}
                  >
                    <Icon size={18} className="nav-icon" />
                    <span>{m.label}</span>
                    {m.badge !== undefined && (
                      <span className="nav-badge">{m.badge} antrean</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="simulation-pill">
            <div className="simulation-dot" />
            <span>MODE: DATA SIMULASI RESMI</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: 1.3 }}>
            Regional Port Analytics Suite v2.4
          </div>
        </div>
      </aside>
    </>
  );
}
