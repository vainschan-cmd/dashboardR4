'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SummaryView from '@/components/menus/SummaryView';
import PelangganView from '@/components/menus/PelangganView';
import HSSEView from '@/components/menus/HSSEView';
import KeuanganView from '@/components/menus/KeuanganView';
import KomersialView from '@/components/menus/KomersialView';
import OperasionalView from '@/components/menus/OperasionalView';
import TeknikView from '@/components/menus/TeknikView';
import SDMView from '@/components/menus/SDMView';
import ProfilCabangView from '@/components/menus/ProfilCabangView';
import ImportCenter from '@/components/admin/ImportCenter';
import VerificationQueue from '@/components/admin/VerificationQueue';
import TemplateMapping from '@/components/admin/TemplateMapping';
import MasterDataView from '@/components/admin/MasterDataView';
import AuditTrailView from '@/components/admin/AuditTrailView';
import DetailDrilldownModal from '@/components/ui/DetailDrilldownModal';
import { Branch, Department, KPIIndicator, MonthlyRecord, TemplateConfig, UserRole } from '@/lib/types';

export default function DashboardHome() {
  // Navigation
  const [activeMenu, setActiveMenu] = useState<string>('summary');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // User & RBAC Persona (demonstration & real control)
  const [userRole, setUserRole] = useState<UserRole>('admin_regional');
  const [username, setUsername] = useState<string>('hendra.regional');

  // Master State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<KPIIndicator[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);

  // Filter State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(true);

  // Records
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [allYearRecords, setAllYearRecords] = useState<MonthlyRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<MonthlyRecord | null>(null);

  // Update role persona info
  useEffect(() => {
    switch (userRole) {
      case 'super_admin':
        setUsername('budi.superadmin');
        break;
      case 'admin_regional':
        setUsername('hendra.regional');
        break;
      case 'pic_dept_regional':
        setUsername('rudi.ops_regional');
        break;
      case 'pic_cabang':
        setUsername('ahmad.priok');
        setSelectedBranchId('br_tgprk'); // locked to Priok
        break;
      case 'viewer':
        setUsername('direksi.eksekutif');
        setVerifiedOnly(true);
        break;
    }
  }, [userRole]);

  // 1. Fetch Master Data
  const loadMasterData = async () => {
    try {
      const res = await fetch('/api/master');
      const data = await res.json();
      if (data.success) {
        setBranches(data.branches || []);
        setDepartments(data.departments || []);
        setIndicators(data.indicators || []);
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // 2. Fetch Records based on current filters
  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // Month-specific records
      const params = new URLSearchParams({
        branch_id: selectedBranchId,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        verified_only: verifiedOnly ? 'true' : 'false',
      });

      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }

      // Year-wide records for trends
      const yearParams = new URLSearchParams({
        branch_id: selectedBranchId,
        year: selectedYear.toString(),
        verified_only: verifiedOnly ? 'true' : 'false',
      });
      const resYear = await fetch(`/api/records?${yearParams.toString()}`);
      const dataYear = await resYear.json();
      if (dataYear.success) {
        setAllYearRecords(dataYear.records || []);
      }

      // Check pending count for badge
      const resVer = await fetch(`/api/verification?month=${selectedMonth}&year=${selectedYear}`);
      const dataVer = await resVer.json();
      if (dataVer.success) {
        setPendingCount(dataVer.pendingCount || 0);
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, selectedMonth, selectedYear, verifiedOnly]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Export to Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      type: 'data',
      branch_id: selectedBranchId,
      month: selectedMonth.toString(),
      year: selectedYear.toString(),
      role: userRole,
    });
    window.location.href = `/api/reports/export?${params.toString()}`;
  };

  // Print Dashboard
  const handlePrint = () => {
    window.print();
  };

  // Drilldown from Regional to Branch
  const handleDrilldownBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    setActiveMenu('profil_cabang');
  };

  // Page title mapping
  const titles: Record<string, string> = {
    summary: 'Executive Summary – Kinerja Pelabuhan',
    pelanggan: 'Kinerja Pelanggan & Pelayanan',
    hsse: 'Health, Safety, Security & Environment (HSSE)',
    keuangan: 'Kinerja Keuangan & Realisasi RKAP',
    komersial: 'Kinerja Bisnis & Pendapatan Komersial',
    operasional: 'Kinerja Operasional & Arus Kapal / Kargo',
    teknik: 'Keandalan Fasilitas & Pemeliharaan Teknik',
    sdm: 'Produktivitas & Pengelolaan SDM',
    profil_cabang: 'Profil & Sarana Fasilitas Cabang',
    import_center: 'Pusat Impor Spreadsheet & Google Sheets',
    verification: 'Verifikasi & Pengesahan Data Kinerja',
    templates: 'Konfigurasi Template & Mapping Dinamis',
    master_data: 'Manajemen Master Data Cabang & Indikator',
    audit_trail: 'Audit Trail & Rekam Jejak Sistem',
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        userRole={userRole}
        pendingCount={pendingCount}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main App Layout */}
      <div className="main-wrapper">
        <Header
          pageTitle={titles[activeMenu] || 'Executive Dashboard'}
          branches={branches}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          verifiedOnly={verifiedOnly}
          setVerifiedOnly={setVerifiedOnly}
          userRole={userRole}
          setUserRole={setUserRole}
          onRefresh={loadRecords}
          onExportExcel={handleExportExcel}
          onPrint={handlePrint}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        <main className="content-body">
          {/* Active View Renderer */}
          {activeMenu === 'summary' && (
            <SummaryView
              records={records}
              allYearRecords={allYearRecords}
              branches={branches}
              departments={departments}
              selectedBranchId={selectedBranchId}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onDrilldown={handleDrilldownBranch}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'pelanggan' && (
            <PelangganView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'hsse' && (
            <HSSEView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'keuangan' && (
            <KeuanganView
              records={records}
              allYearRecords={allYearRecords}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'komersial' && (
            <KomersialView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'operasional' && (
            <OperasionalView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'teknik' && (
            <TeknikView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'sdm' && (
            <SDMView
              records={records}
              branches={branches}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'profil_cabang' && (
            <ProfilCabangView
              branches={branches}
              records={records}
              selectedBranchId={selectedBranchId}
              onSelectBranch={setSelectedBranchId}
              onSelectRecord={setSelectedRecord}
            />
          )}

          {activeMenu === 'import_center' && (
            <ImportCenter
              branches={branches}
              departments={departments}
              userRole={userRole}
              username={username}
              onImportSuccess={loadRecords}
            />
          )}

          {activeMenu === 'verification' && (
            <VerificationQueue
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              userRole={userRole}
              username={username}
              onVerificationDone={loadRecords}
            />
          )}

          {activeMenu === 'templates' && (
            <TemplateMapping
              departments={departments}
              templates={templates}
              userRole={userRole}
              username={username}
              onTemplateUpdated={loadMasterData}
            />
          )}

          {activeMenu === 'master_data' && (
            <MasterDataView
              branches={branches}
              departments={departments}
              indicators={indicators}
            />
          )}

          {activeMenu === 'audit_trail' && (
            <AuditTrailView />
          )}
        </main>
      </div>

      {/* Detail & Drilldown Modal */}
      <DetailDrilldownModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        allRecords={allYearRecords}
      />
    </div>
  );
}
