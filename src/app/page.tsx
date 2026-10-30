'use client';

import React, { useState, useEffect } from 'react';
import PortSightHeader from '@/components/layout/PortSightHeader';
import PortSightBeranda from '@/components/portsight/PortSightBeranda';
import PortSightKeuangan from '@/components/portsight/PortSightKeuangan';
import PortSightOpkom from '@/components/portsight/PortSightOpkom';
import PortSightKinerja from '@/components/portsight/PortSightKinerja';
import PortSightUtilisasi from '@/components/portsight/PortSightUtilisasi';
import PortSightPeralatan from '@/components/portsight/PortSightPeralatan';
import PortSightFasilitas from '@/components/portsight/PortSightFasilitas';
import ImportCenter from '@/components/admin/ImportCenter';
import VerificationQueue from '@/components/admin/VerificationQueue';
import TemplateMapping from '@/components/admin/TemplateMapping';
import MasterDataView from '@/components/admin/MasterDataView';
import AuditTrailView from '@/components/admin/AuditTrailView';
import DataRecordsView from '@/components/admin/DataRecordsView';
import AuthModal from '@/components/auth/AuthModal';
import LoginScreen from '@/components/auth/LoginScreen';
import { Branch, Department, KPIIndicator, TemplateConfig, UserRole, EquipmentItem, User } from '@/lib/types';
import { X, Target, CheckCircle2, TrendingUp, Database, Layers, FileSpreadsheet, Sliders, History, Anchor } from 'lucide-react';

export default function DashboardHome() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('beranda');

  // Theme: 'dark' (Mode Gelap) | 'light' (Mode Terang)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Terminal & Period Filters
  const [selectedTerminal, setSelectedTerminal] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('YTD Sep 2026');

  // Role persona & current authenticated user
  const [userRole, setUserRole] = useState<UserRole>('admin_regional');
  const [username, setUsername] = useState<string>('10002');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Auth Modal (Login & Register for internal actions)
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Master data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<KPIIndicator[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Drilldown Modal
  const [drilldownItem, setDrilldownItem] = useState<any | null>(null);

  // Load saved theme & user auth from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('portsight_theme') as 'dark' | 'light' | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      }

      const savedUser = localStorage.getItem('portsight_auth_user');
      if (savedUser) {
        const u = JSON.parse(savedUser) as User;
        if (u && (u.nipp || u.username)) {
          setCurrentUser(u);
          setUserRole(u.role);
          setUsername(u.nipp || u.username);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('portsight_theme', newTheme);
    } catch (e) {
      console.error(e);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Fetch Master Data, Users, and Verification Pending Count
  const loadMasterData = async () => {
    try {
      const [resMaster, resVer, resUsers] = await Promise.all([
        fetch('/api/master'),
        fetch('/api/verification?month=9&year=2026'),
        fetch('/api/users')
      ]);
      const dataMaster = await resMaster.json();
      if (dataMaster.success) {
        setBranches(dataMaster.branches || []);
        setDepartments(dataMaster.departments || []);
        setIndicators(dataMaster.indicators || []);
        setEquipment(dataMaster.equipment || []);
        setTemplates(dataMaster.templates || []);
      }
      const dataVer = await resVer.json();
      if (dataVer.success) {
        setPendingCount(dataVer.pendingCount || 0);
      }
      const dataUsers = await resUsers.json();
      if (dataUsers.success) {
        setUsersList(dataUsers.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setUserRole(user.role);
    setUsername(user.nipp || user.username);
    if (user.branch_id && user.branch_id !== 'R99' && user.role === 'pic_cabang') {
      setSelectedTerminal(user.branch_id);
    }
    try {
      localStorage.setItem('portsight_auth_user', JSON.stringify(user));
    } catch (e) {}
    loadMasterData();
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('portsight_auth_user');
    } catch (e) {}
    setCurrentUser(null);
    setAuthModalOpen(false);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      type: 'data',
      branch_id: selectedTerminal,
      month: '9',
      year: '2026',
      role: userRole,
    });
    window.location.href = `/api/reports/export?${params.toString()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const isGovernanceView = ['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab);

  // 1. Tampilkan loading sebentar saat memeriksa sesi lokal
  if (isAuthChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-main)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
          }}
        >
          <Anchor size={24} />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Memeriksa Sesi Pengguna PortDash Regional 4...
        </div>
      </div>
    );
  }

  // 2. Jika belum login (currentUser === null), tampilkan LoginScreen di awal
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onThemeChange={handleThemeChange}
      />
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* R4 PortSight Top Navigation & Subheader */}
      <PortSightHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedTerminal={selectedTerminal}
        setSelectedTerminal={setSelectedTerminal}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        userRole={userRole}
        setUserRole={setUserRole}
        currentUser={currentUser}
        onOpenAuth={(m) => {
          setAuthModalMode(m || 'login');
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        pendingCount={pendingCount}
        theme={theme}
        onThemeChange={handleThemeChange}
      />

      {/* Main View Body */}
      <main className="portsight-main">
        {/* Sub-navigation bar for Data Governance */}
        {isGovernanceView && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '4px' }}>
            <div className="governance-subnav">
              <button
                onClick={() => setActiveTab('data_records')}
                className={`governance-pill ${activeTab === 'data_records' ? 'active' : ''}`}
              >
                <Database size={13} />
                <span>Data Record Kinerja</span>
              </button>
              <button
                onClick={() => setActiveTab('master_data')}
                className={`governance-pill ${activeTab === 'master_data' ? 'active' : ''}`}
              >
                <Layers size={13} />
                <span>Master Data & KPI</span>
              </button>
              <button
                onClick={() => setActiveTab('verification')}
                className={`governance-pill ${activeTab === 'verification' ? 'active' : ''}`}
              >
                <CheckCircle2 size={13} />
                <span>Verifikasi & Monitoring</span>
                {pendingCount > 0 && (
                  <span style={{ backgroundColor: '#fbbf24', color: '#0e1b2e', fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '10px' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('import_center')}
                className={`governance-pill ${activeTab === 'import_center' ? 'active' : ''}`}
              >
                <FileSpreadsheet size={13} />
                <span>Import Spreadsheet</span>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`governance-pill ${activeTab === 'templates' ? 'active' : ''}`}
              >
                <Sliders size={13} />
                <span>Template Mapping</span>
              </button>
              <button
                onClick={() => setActiveTab('audit_trail')}
                className={`governance-pill ${activeTab === 'audit_trail' ? 'active' : ''}`}
              >
                <History size={13} />
                <span>Audit Trail & Log</span>
              </button>
            </div>
          </div>
        )}

        {/* Beranda */}
        {activeTab === 'beranda' && (
          <PortSightBeranda
            onSelectTerminal={(tId) => {
              setSelectedTerminal(tId);
              setActiveTab('opkom');
            }}
            onOpenDrilldown={(item) => setDrilldownItem(item)}
          />
        )}

        {/* Finance (Keuangan) */}
        {activeTab === 'keuangan' && (
          <PortSightKeuangan selectedTerminal={selectedTerminal} />
        )}

        {/* Opkom (Operasi dan Komersial) */}
        {activeTab === 'opkom' && (
          <PortSightOpkom selectedTerminal={selectedTerminal} />
        )}

        {/* Kinerja */}
        {activeTab === 'kinerja' && (
          <PortSightKinerja selectedTerminal={selectedTerminal} />
        )}

        {/* Utilisasi */}
        {activeTab === 'utilisasi' && (
          <PortSightUtilisasi selectedTerminal={selectedTerminal} />
        )}

        {/* Peralatan */}
        {activeTab === 'peralatan' && (
          <PortSightPeralatan selectedTerminal={selectedTerminal} />
        )}

        {/* Fasilitas */}
        {activeTab === 'fasilitas' && (
          <PortSightFasilitas selectedTerminal={selectedTerminal} />
        )}

        {/* Data Governance & Admin Tools */}
        {activeTab === 'data_records' && (
          <DataRecordsView
            branches={branches}
            departments={departments}
            onRefreshNeeded={loadMasterData}
          />
        )}

        {activeTab === 'import_center' && (
          <ImportCenter
            branches={branches}
            departments={departments}
            userRole={userRole}
            username={username}
            onImportSuccess={loadMasterData}
          />
        )}

        {activeTab === 'verification' && (
          <VerificationQueue
            selectedMonth={9}
            selectedYear={2026}
            userRole={userRole}
            username={username}
            onVerificationDone={loadMasterData}
          />
        )}

        {activeTab === 'templates' && (
          <TemplateMapping
            departments={departments}
            templates={templates}
            userRole={userRole}
            username={username}
            onTemplateUpdated={loadMasterData}
          />
        )}

        {activeTab === 'master_data' && (
          <MasterDataView
            branches={branches}
            departments={departments}
            indicators={indicators}
            equipment={equipment}
            users={usersList}
            onRefreshUsers={loadMasterData}
          />
        )}

        {activeTab === 'audit_trail' && (
          <AuditTrailView />
        )}
      </main>

      {/* Drilldown Modal */}
      {drilldownItem && (
        <div className="modal-overlay" onClick={() => setDrilldownItem(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#132238', borderColor: '#223c63', color: '#ffffff', maxWidth: '580px' }}
          >
            <div className="modal-header" style={{ borderColor: '#1e3557' }}>
              <div>
                <span className="illustration-pill" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  Detail Indikator
                </span>
                <h3 className="modal-title" style={{ color: '#ffffff', marginTop: '6px' }}>
                  {drilldownItem.title}
                </h3>
              </div>
              <button
                onClick={() => setDrilldownItem(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#0e1c30', padding: '16px', borderRadius: '8px', border: '1px solid #1e3557' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target RKAP YTD</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    {drilldownItem.rawTarget || drilldownItem.comp1}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Realisasi Aktual YTD</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {drilldownItem.rawRealization || drilldownItem.value}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#0e1c30', borderRadius: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Performa terhadap Target:</span>
                <strong className={drilldownItem.comp1Good ? 'text-positive' : 'text-alert'}>
                  {drilldownItem.comp1}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#0e1c30', borderRadius: '8px', fontSize: '12.5px' }}>
                <span style={{ color: '#94a3b8' }}>Pertumbuhan Tahunan (YoY):</span>
                <strong className={drilldownItem.comp2Good ? 'text-positive' : 'text-alert'}>
                  {drilldownItem.comp2}
                </strong>
              </div>
            </div>

            <div className="modal-footer" style={{ borderColor: '#1e3557', backgroundColor: '#0e1c30' }}>
              <button onClick={() => setDrilldownItem(null)} className="btn-dark" style={{ fontSize: '12px' }}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Login / Register PIC) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        initialMode={authModalMode}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
