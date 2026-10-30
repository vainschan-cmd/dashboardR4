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
  Shield
} from 'lucide-react';
import { UserRole } from '@/lib/types';

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

  const mainTabs = [
    { id: 'beranda', label: 'Beranda' },
    { id: 'operasional', label: 'Operasional' },
    { id: 'sdm', label: 'SDM' },
    { id: 'teknik', label: 'Teknik' },
    { id: 'hsse', label: 'HSSE' },
    { id: 'keuangan', label: 'Keuangan' },
    { id: 'pelanggan', label: 'Pelanggan' },
  ];

  const adminTabs = [
    { id: 'import_center', label: 'Import Excel / Sheets', icon: FileSpreadsheet },
    { id: 'verification', label: `Verifikasi & Monitoring ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: CheckCircle2 },
    { id: 'templates', label: 'Template & Mapping', icon: Sliders },
    { id: 'master_data', label: 'Master Data & KPI', icon: Database },
    { id: 'audit_trail', label: 'Audit Trail', icon: History },
  ];

  const terminals = [
    { id: 'ALL', name: '8 terminal (Semua)' },
    { id: 'term_new_makassar', name: 'New Makassar' },
    { id: 'term_makassar', name: 'Makassar' },
    { id: 'term_bitung', name: 'Bitung' },
    { id: 'term_ambon', name: 'Ambon' },
    { id: 'term_sorong', name: 'Sorong' },
    { id: 'term_balikpapan', name: 'Balikpapan' },
    { id: 'term_pantoloan', name: 'Pantoloan' },
    { id: 'term_ternate', name: 'Ternate' },
  ];

  const pageHeadings: Record<string, string> = {
    beranda: 'Ringkasan Eksekutif Regional 4',
    operasional: 'Dashboard Operasional',
    sdm: 'Dashboard SDM',
    teknik: 'Dashboard Teknik',
    hsse: 'Dashboard HSSE',
    keuangan: 'Dashboard Keuangan',
    pelanggan: 'Dashboard Bina Pelanggan',
    import_center: 'Pusat Impor Spreadsheet & Google Sheets',
    verification: 'Verifikasi & Pengesahan Data Kinerja',
    templates: 'Konfigurasi Template & Dynamic Mapping',
    master_data: 'Master Data Pelindo Regional 4',
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
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className={`nav-tab-btn ${['import_center', 'verification', 'templates', 'master_data', 'audit_trail'].includes(activeTab) ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Layers size={13} />
                <span>Tata Kelola Data</span>
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
              <option value="pic_cabang" style={{ background: '#122137' }}>PIC New Makassar</option>
              <option value="viewer" style={{ background: '#122137' }}>BOD Regional 4 (Viewer)</option>
            </select>
          </div>

          <button onClick={onExportExcel} className="btn-dark" style={{ padding: '4px 10px', fontSize: '12px' }} title="Ekspor data Excel (.xlsx)">
            <Download size={13} />
          </button>

          <button onClick={onPrint} className="btn-dark" style={{ padding: '4px 10px', fontSize: '12px' }} title="Cetak Ringkasan">
            <Printer size={13} />
          </button>

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
