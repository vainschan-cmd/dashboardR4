'use client';

import React from 'react';
import {
  Menu,
  Download,
  Printer,
  Calendar,
  Building,
  Shield,
  Layers,
  RefreshCw
} from 'lucide-react';
import { Branch, UserRole } from '@/lib/types';

interface HeaderProps {
  pageTitle: string;
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (v: boolean) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  onRefresh: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onToggleMobileSidebar: () => void;
}

export default function Header({
  pageTitle,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  verifiedOnly,
  setVerifiedOnly,
  userRole,
  setUserRole,
  onRefresh,
  onExportExcel,
  onPrint,
  onToggleMobileSidebar,
}: HeaderProps) {
  const months = [
    { num: 1, name: 'Januari' },
    { num: 2, name: 'Februari' },
    { num: 3, name: 'Maret' },
    { num: 4, name: 'April' },
    { num: 5, name: 'Mei' },
    { num: 6, name: 'Juni' },
    { num: 7, name: 'Juli' },
    { num: 8, name: 'Agustus' },
    { num: 9, name: 'September' },
    { num: 10, name: 'Oktober' },
    { num: 11, name: 'November' },
    { num: 12, name: 'Desember' },
  ];

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    super_admin: { label: 'Super Admin', color: '#7c3aed' },
    admin_regional: { label: 'Admin Regional', color: '#1d4ed8' },
    pic_dept_regional: { label: 'PIC Dept Regional', color: '#0284c7' },
    pic_cabang: { label: 'PIC Cabang', color: '#059669' },
    viewer: { label: 'Direksi / Viewer', color: '#475569' },
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          onClick={onToggleMobileSidebar}
          className="btn btn-secondary btn-sm"
          style={{ display: 'none' }}
          id="mobile-menu-btn"
          aria-label="Buka Menu"
        >
          <Menu size={18} />
        </button>

        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Tingkat: <strong>{selectedBranchId === 'ALL' ? 'Konsolidasi Regional' : branches.find(b => b.id === selectedBranchId)?.name || 'Cabang'}</strong></span>
            <span>•</span>
            <span>Periode: <strong>{months.find(m => m.num === selectedMonth)?.name} {selectedYear}</strong></span>
          </div>
        </div>
      </div>

      <div className="header-filters">
        {/* Cabang Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building size={16} color="#64748b" />
          <select
            className="filter-select"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={userRole === 'pic_cabang'} // PIC cabang locked to their branch
          >
            <option value="ALL">🏢 Konsolidasi Seluruh Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} color="#64748b" />
          <select
            className="filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {months.map((m) => (
              <option key={m.num} value={m.num}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <select
          className="filter-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
        >
          <option value={2026}>2026 (Berjalan)</option>
          <option value={2025}>2025 (Audit)</option>
          <option value={2024}>2024 (Historis)</option>
        </select>

        {/* Verified Only Toggle */}
        <button
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className={`btn btn-sm ${verifiedOnly ? 'btn-secondary' : 'btn-warning'}`}
          title={verifiedOnly ? 'Hanya data berstatus Terverifikasi' : 'Menampilkan seluruh status (termasuk Draft & Menunggu Verifikasi)'}
          style={{ height: '38px', padding: '0 12px' }}
        >
          <Layers size={15} />
          <span>{verifiedOnly ? 'Hanya Terverifikasi' : 'Semua Status'}</span>
        </button>

        {/* Quick Refresh */}
        <button
          onClick={onRefresh}
          className="btn btn-secondary btn-sm"
          title="Refresh Data"
          style={{ height: '38px', width: '38px', padding: 0 }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="header-right">
        {/* Role Switcher */}
        <div className="role-pill">
          <Shield size={14} color="#64748b" />
          <span style={{ color: '#475569', fontSize: '11.5px', fontWeight: 600 }}>Role:</span>
          <select
            style={{
              background: 'transparent',
              border: 'none',
              fontWeight: 700,
              color: roleLabels[userRole].color,
              cursor: 'pointer',
              outline: 'none',
              fontSize: '12px'
            }}
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin_regional">Admin Regional</option>
            <option value="pic_dept_regional">PIC Dept Regional</option>
            <option value="pic_cabang">PIC Cabang Priok</option>
            <option value="viewer">Manajemen / Viewer</option>
          </select>
        </div>

        {/* Export Buttons */}
        <button
          onClick={onExportExcel}
          className="btn btn-secondary btn-sm"
          style={{ height: '38px' }}
          title="Ekspor Laporan ke format Excel (.xlsx)"
        >
          <Download size={15} />
          <span>Excel</span>
        </button>

        <button
          onClick={onPrint}
          className="btn btn-secondary btn-sm"
          style={{ height: '38px' }}
          title="Cetak Tampilan Eksekutif / PDF"
        >
          <Printer size={15} />
          <span>Cetak</span>
        </button>
      </div>
    </header>
  );
}
