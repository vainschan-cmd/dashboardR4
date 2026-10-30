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
  GitBranch
} from 'lucide-react';
import { UserRole } from '@/lib/types';
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
  onExportExcel: () => void;
  onPrint: () => void;
  pendingCount?: number;
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
  onExportExcel,
  onPrint,
  pendingCount = 0,
}: PortSightHeaderProps) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const mainTabs = MAIN_NAVIGATION_TABS;

  const adminTabs = [
    { id: 'data_records', label: 'Data Record Kinerja (Raw)', icon: Database },
    { id: 'master_data', label: 'Master Data & KPI', icon: Layers },
    { id: 'verification', label: `Verifikasi & Monitoring ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
    { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet },
    { id: 'templates', label: 'Template & Mapping', icon: Sliders },
    { id: 'audit_trail', label: 'Audit Trail & Log', icon: History },
  ];

  const terminals = [
    { id: 'ALL', name: 'Semua Cabang (28 Cabang)' },
    ...OFFICIAL_BRANCHES.map(b => ({
      id: b.code,
      name: `[${b.code}] ${b.name}`
    }))
  ];

  const pageHeadings: Record<string, string> = {
    beranda: 'Ringkasan Eksekutif Regional 4',
    keuangan: 'Dashboard Finance (Keuangan) Pelindo R4',
    opkom: 'Dashboard Opkom (Operasi & Komersial) Pelindo R4',
    kinerja: 'Dashboard Kinerja Pelayanan Operasional Pelindo R4',
    utilisasi: 'Dashboard Utilisasi Dermaga & Lapangan (BOR/YOR/SOR)',
    peralatan: 'Dashboard Monitoring Kesiapan & Utilisasi Peralatan',
    fasilitas: 'Dashboard Fasilitas & Infrastruktur Pelabuhan Regional 4',
    data_records: 'Data Record Kinerja Pelabuhan Regional 4',
    master_data: 'Master Data Pelindo Regional 4',
    verification: 'Verifikasi & Pengesahan Data Kinerja',
    import_center: 'Pusat Impor Spreadsheet & Google Sheets',
    templates: 'Konfigurasi Template & Dynamic Mapping',
    audit_trail: 'Audit Trail & Rekam Jejak Sistem',
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="portsight-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Brand */}
          <div className="brand-wrapper" onClick={() => setActiveTab('beranda')} style={{ cursor: 'pointer' }}>
            <span className="brand-title">PELINDO R4</span>
            <span className="brand-accent">PortDash</span>
          </div>

          {/* Navigation Tabs */}
          <nav className="nav-tabs-wrapper">
            {mainTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                    setActiveTab('data_records');
                  }
                  setAdminMenuOpen(!adminMenuOpen);
                }}
                className={`nav-tab-btn ${['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab) ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Layers size={13} />
                <span>Tata Kelola Data</span>
                {pendingCount > 0 && (
                  <span style={{ backgroundColor: '#fbbf24', color: '#0e1b2e', fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '10px', marginLeft: '2px' }}>
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
                    backgroundColor: '#122137',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px',
                    minWidth: '220px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                    zIndex: 60,
                  }}
                  onClick={() => setAdminMenuOpen(false)}
                >
                  {adminTabs.map((adm) => {
                    const Icon = adm.icon;
                    return (
                      <button
                        key={adm.id}
                        onClick={() => setActiveTab(adm.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: activeTab === adm.id ? 'var(--accent-blue)' : 'none',
                          border: 'none',
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={14} color="#38bdf8" />
                        <span>{adm.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right Section */}
        <div className="header-right-tools">
          {/* Role Persona Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#101c2e', border: '1px solid var(--border-subtle)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11.5px' }}>
            <Shield size={12} color="#38bdf8" />
            <span style={{ color: '#94a3b8' }}>Role:</span>
            <select
              style={{ background: 'transparent', border: 'none', color: '#ffffff', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '11.5px' }}
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as UserRole)}
            >
              <option value="super_admin" style={{ background: '#122137' }}>Super Admin</option>
              <option value="admin_regional" style={{ background: '#122137' }}>Admin Regional 4</option>
              <option value="pic_dept_regional" style={{ background: '#122137' }}>PIC Dept Operasi</option>
              <option value="pic_cabang" style={{ background: '#122137' }}>PIC Cabang Makassar</option>
              <option value="viewer" style={{ background: '#122137' }}>BOD Regional 4 (Viewer)</option>
            </select>
          </div>

          <button onClick={onExportExcel} className="btn-dark" style={{ padding: '4px 10px', fontSize: '12px' }} title="Ekspor data Excel (.xlsx)">
            <Download size={13} />
          </button>

          <button onClick={onPrint} className="btn-dark" style={{ padding: '4px 10px', fontSize: '12px' }} title="Cetak Ringkasan">
            <Printer size={13} />
          </button>

          <a
            href="https://github.com/vainschan-cmd/dashboardR4"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-dark"
            style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
            title="Buka Repositori GitHub vainschan-cmd/dashboardR4"
          >
            <GitBranch size={13} color="#38bdf8" />
            <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 600 }}>GitHub</span>
          </a>

          <div className="illustration-pill">
            Data ilustrasi
          </div>
        </div>
      </header>

      {/* Page Subheader */}
      <div className="portsight-subheader">
        <h1 className="page-heading">
          {pageHeadings[activeTab] || 'Dashboard Regional 4'}
        </h1>

        <div className="filter-chips-row">
          {/* Period Chip */}
          <div className="filter-chip">
            <span>📅</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', fontSize: '12px' }}
            >
              <option value="YTD Sep 2026" style={{ background: '#122137', color: '#fff' }}>YTD Sep 2026</option>
              <option value="YTD Jun 2026" style={{ background: '#122137', color: '#fff' }}>YTD Jun 2026</option>
              <option value="YTD Mar 2026" style={{ background: '#122137', color: '#fff' }}>YTD Mar 2026</option>
              <option value="FY 2025" style={{ background: '#122137', color: '#fff' }}>FY 2025</option>
            </select>
          </div>

          {/* Terminal Chip */}
          <div className="filter-chip">
            <span>🏢</span>
            <select
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', fontSize: '12px' }}
            >
              {terminals.map((t) => (
                <option key={t.id} value={t.id} style={{ background: '#122137', color: '#fff' }}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Chip */}
          <div className="filter-chip">
            <span>📊 vs RKAP & 2025</span>
          </div>
        </div>
      </div>
    </>
  );
}
