'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import PortSightHeader from '@/components/layout/PortSightHeader';
import Sidebar from '@/components/layout/Sidebar';
import PortSightBeranda from '@/components/portsight/PortSightBeranda';
import type { ModuleType } from '@/components/admin/ManualDataInputModal';
import LoginScreen from '@/components/auth/LoginScreen';
import { Branch, Department, KPIIndicator, TemplateConfig, UserRole, EquipmentItem, User, SystemParameters, DatabaseConfig, IntegrationCredentials } from '@/lib/types';
import { X, CheckCircle2, Database, Layers, FileSpreadsheet, Sliders, History, Anchor, Clock, AlertTriangle } from 'lucide-react';

function ModuleSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
      <div
        className="skeleton-shimmer"
        style={{ height: '56px', borderRadius: 'var(--radius-md)' }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="skeleton-shimmer"
            style={{ height: '104px', borderRadius: 'var(--radius-md)' }}
          />
        ))}
      </div>
      <div
        className="skeleton-shimmer"
        style={{ height: '320px', borderRadius: 'var(--radius-md)' }}
      />
    </div>
  );
}

const PortSightKeuangan = dynamic(() => import('@/components/portsight/PortSightKeuangan'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightOpkom = dynamic(() => import('@/components/portsight/PortSightOpkom'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightKinerja = dynamic(() => import('@/components/portsight/PortSightKinerja'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightUtilisasi = dynamic(() => import('@/components/portsight/PortSightUtilisasi'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightPeralatan = dynamic(() => import('@/components/portsight/PortSightPeralatan'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightFasilitas = dynamic(() => import('@/components/portsight/PortSightFasilitas'), {
  loading: () => <ModuleSkeleton />,
});
const PortSightPeriode = dynamic(() => import('@/components/portsight/PortSightPeriode'), {
  loading: () => <ModuleSkeleton />,
});
const ImportCenter = dynamic(() => import('@/components/admin/ImportCenter'), {
  loading: () => <ModuleSkeleton />,
});
const VerificationQueue = dynamic(() => import('@/components/admin/VerificationQueue'), {
  loading: () => <ModuleSkeleton />,
});
const TemplateMapping = dynamic(() => import('@/components/admin/TemplateMapping'), {
  loading: () => <ModuleSkeleton />,
});
const MasterDataView = dynamic(() => import('@/components/admin/MasterDataView'), {
  loading: () => <ModuleSkeleton />,
});
const AuditTrailView = dynamic(() => import('@/components/admin/AuditTrailView'), {
  loading: () => <ModuleSkeleton />,
});
const DataRecordsView = dynamic(() => import('@/components/admin/DataRecordsView'), {
  loading: () => <ModuleSkeleton />,
});
const ManualDataInputModal = dynamic(() => import('@/components/admin/ManualDataInputModal'));
const ComparisonModal = dynamic(() => import('@/components/modals/ComparisonModal'));
const AuthModal = dynamic(() => import('@/components/auth/AuthModal'));

const VALID_TABS = new Set([
  'beranda',
  'periode',
  'keuangan',
  'opkom',
  'kinerja',
  'utilisasi',
  'peralatan',
  'fasilitas',
  'data_records',
  'master_data',
  'verification',
  'import_center',
  'templates',
  'audit_trail',
]);

export default function DashboardHome() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('beranda');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Theme: 'light' (Mode Terang - Default Resmi) | 'dark' (Mode Gelap)
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  // Terminal & Period Filters
  const [selectedTerminal, setSelectedTerminal] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('YTD Sep 2026');

  // Role persona & current authenticated user
  const [userRole, setUserRole] = useState<UserRole>('admin_regional');
  const [username, setUsername] = useState<string>('10002');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Inactivity Session & System Parameters
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);
  const [systemParams, setSystemParams] = useState<SystemParameters>({
    session_timeout_minutes: 30,
    auto_logout_idle: true,
    warning_before_minutes: 2,
    default_theme: 'light',
  });
  const [dbConfig, setDbConfig] = useState<DatabaseConfig | undefined>();
  const [credentials, setCredentials] = useState<IntegrationCredentials | undefined>();

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
  const [drilldownItem, setDrilldownItem] = useState<{
    title?: string;
    value?: string;
    fullValue?: string;
    rawTarget?: string;
    rawRealization?: string;
    comp1?: string;
    comp1Good?: boolean;
    comp2?: string;
    comp2Good?: boolean;
    [key: string]: unknown;
  } | null>(null);

  // Manual Data Input Modal
  const [manualInputModalOpen, setManualInputModalOpen] = useState<boolean>(false);
  const [manualInputDefaultModule, setManualInputDefaultModule] = useState<ModuleType>('finansial');

  // Executive Comparison Modal & Mode (vs RKAP & 2025)
  const [comparisonMode, setComparisonMode] = useState<string>('all');
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false);

  const handleOpenManualInput = (moduleName?: string) => {
    if (isBod) return;
    if (moduleName && ['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas'].includes(moduleName)) {
      setManualInputDefaultModule(moduleName as ModuleType);
    }
    setManualInputModalOpen(true);
  };

  // Load saved theme, URL search params & validate active HttpOnly JWT session from /api/users/me on mount
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const initTimer = window.setTimeout(() => {
      try {
        const savedTheme = localStorage.getItem('portsight_theme') as 'dark' | 'light' | null;
        if (savedTheme === 'dark') {
          setTheme('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          setTheme('light');
          document.documentElement.setAttribute('data-theme', 'light');
        }
        localStorage.removeItem('portsight_auth_user');
      } catch (e) {
        console.error(e);
      }

      // Read initial URL search params (?tab=...&branch=...&period=...)
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        const branchParam = params.get('branch');
        const periodParam = params.get('period');
        if (tabParam && VALID_TABS.has(tabParam)) {
          setActiveTab(tabParam);
        }
        if (branchParam) {
          setSelectedTerminal(branchParam);
        }
        if (periodParam) {
          setSelectedPeriod(periodParam);
        }
      } catch (e) {
        console.warn('Gagal membaca parameter URL:', e);
      }
    }, 0);

    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        const branchParam = params.get('branch');
        const periodParam = params.get('period');
        if (tabParam && VALID_TABS.has(tabParam)) {
          setActiveTab(tabParam);
        }
        if (branchParam) {
          setSelectedTerminal(branchParam);
        }
        if (periodParam) {
          setSelectedPeriod(periodParam);
        }
      } catch (e) {
        console.warn('Gagal menyinkronkan riwayat navigasi:', e);
      }
    };
    window.addEventListener('popstate', handlePopState);

    const restoreJwtSession = async () => {
      try {
        const res = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && data.authenticated && data.user) {
          const u = data.user as User;
          setCurrentUser(u);
          setUserRole(u.role);
          setUsername(u.nipp || u.username);
          if (u.role === 'pic_cabang' && u.branch_id && u.branch_id !== 'R99') {
            setSelectedTerminal(u.branch_id);
          }
          try {
            localStorage.setItem('portsight_last_activity', String(Date.now()));
          } catch (e) {
            console.warn('Gagal menyimpan waktu aktivitas:', e);
          }
        }
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          // Unauthenticated or network error — remain on LoginScreen
        }
      }
    };

    restoreJwtSession();

    return () => {
      isMounted = false;
      window.clearTimeout(initTimer);
      abortController.abort();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Synchronize activeTab, selectedTerminal, and selectedPeriod with URL search params
  useEffect(() => {
    if (!currentUser) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      url.searchParams.set('branch', selectedTerminal);
      url.searchParams.set('period', selectedPeriod);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Gagal memperbarui parameter URL:', e);
    }
  }, [activeTab, selectedTerminal, selectedPeriod, currentUser]);

  // Close Drilldown Modal on Escape key
  useEffect(() => {
    if (!drilldownItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrilldownItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drilldownItem]);

  // Inactivity Activity Tracker & Auto-Logout Watcher (Default 30 Menit)
  useEffect(() => {
    if (!currentUser) return;

    let lastRecord = Date.now();
    try {
      localStorage.setItem('portsight_last_activity', String(lastRecord));
    } catch (e) {}

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecord > 2000) {
        lastRecord = now;
        try {
          localStorage.setItem('portsight_last_activity', String(now));
        } catch (e) {}
        setIdleWarningSeconds((prev) => (prev !== null ? null : null));
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    const intervalId = setInterval(() => {
      if (!systemParams.auto_logout_idle) return;

      const lastActivityStr = localStorage.getItem('portsight_last_activity');
      const lastActivity = lastActivityStr ? Number(lastActivityStr) : lastRecord;
      const elapsedMs = Date.now() - lastActivity;
      const timeoutMinutes = systemParams.session_timeout_minutes || 30;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMinutes = systemParams.warning_before_minutes || 2;
      const warningWindowMs = warningMinutes * 60 * 1000;

      if (elapsedMs >= timeoutMs) {
        // TIMEOUT EXPIRED: Revoke HttpOnly JWT cookie & return to login screen
        clearInterval(intervalId);
        fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        try {
          localStorage.removeItem('portsight_auth_user');
          localStorage.removeItem('portsight_last_activity');
        } catch (e) {}
        setIdleWarningSeconds(null);
        setCurrentUser(null);
        setSessionExpiredMessage(
          `Sesi Anda telah berakhir karena tidak ada aktivitas selama ${timeoutMinutes} menit. Silakan masuk kembali.`
        );
      } else if (elapsedMs >= timeoutMs - warningWindowMs) {
        // Tampilkan peringatan hitung mundur
        const remainingSec = Math.max(1, Math.round((timeoutMs - elapsedMs) / 1000));
        setIdleWarningSeconds(remainingSec);
      } else {
        setIdleWarningSeconds(null);
      }
    }, 4000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(intervalId);
    };
  }, [currentUser, systemParams]);

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
  const loadMasterData = useCallback(async (signal?: AbortSignal) => {
    try {
      const canReadVerification = currentUser && currentUser.role !== 'viewer';
      const canReadUsers =
        currentUser &&
        (currentUser.role === 'super_admin' || currentUser.role === 'admin_regional');

      const [resMaster, resVer, resUsers] = await Promise.all([
        fetch('/api/master', { credentials: 'include', signal }),
        canReadVerification
          ? fetch('/api/verification?month=9&year=2026', { credentials: 'include', signal })
          : Promise.resolve(null),
        canReadUsers
          ? fetch('/api/users', { credentials: 'include', signal })
          : Promise.resolve(null),
      ]);
      const dataMaster = await resMaster.json();
      if (dataMaster.success) {
        setBranches(dataMaster.branches || []);
        setDepartments(dataMaster.departments || []);
        setIndicators(dataMaster.indicators || []);
        setEquipment(dataMaster.equipment || []);
        setTemplates(dataMaster.templates || []);
        if (dataMaster.systemParams) {
          setSystemParams(dataMaster.systemParams);
        }
        if (dataMaster.dbConfig) {
          setDbConfig(dataMaster.dbConfig);
        }
        if (dataMaster.credentials) {
          setCredentials(dataMaster.credentials);
        }
      }
      if (resVer && resVer.ok) {
        const dataVer = await resVer.json();
        if (dataVer.success) {
          setPendingCount(dataVer.pendingCount || 0);
        }
      } else {
        setPendingCount(0);
      }
      if (resUsers && resUsers.ok) {
        const dataUsers = await resUsers.json();
        if (dataUsers.success) {
          setUsersList(dataUsers.users || []);
        }
      } else {
        setUsersList([]);
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        console.error(e);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      void loadMasterData(abortController.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [currentUser, loadMasterData]);

  const handleLoginSuccess = (user: User) => {
    setSessionExpiredMessage(null);
    setIdleWarningSeconds(null);
    setCurrentUser(user);
    setUserRole(user.role);
    setUsername(user.nipp || user.username);
    if (user.role === 'pic_cabang' && user.branch_id && user.branch_id !== 'R99') {
      setSelectedTerminal(user.branch_id);
    } else {
      setSelectedTerminal('ALL');
    }
    try {
      localStorage.removeItem('portsight_auth_user');
      localStorage.setItem('portsight_last_activity', String(Date.now()));
    } catch (e) {
      console.warn('Gagal membersihkan penyimpanan sesi lama:', e);
    }
  };

  const handleLogout = () => {
    fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch((e) => {
      console.warn('Gagal memanggil endpoint logout:', e);
    });
    try {
      localStorage.removeItem('portsight_auth_user');
      localStorage.removeItem('portsight_last_activity');
    } catch (e) {
      console.warn('Gagal menghapus penyimpanan aktivitas:', e);
    }
    setSessionExpiredMessage(null);
    setIdleWarningSeconds(null);
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
    });
    window.location.href = `/api/reports/export?${params.toString()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  // Pure RBAC role checks based on authenticated session role
  const effectiveRole: UserRole = currentUser?.role || userRole;
  const isBod = effectiveRole === 'viewer';
  const canManageUsers = effectiveRole === 'super_admin' || effectiveRole === 'admin_regional';
  const isPicCabang = effectiveRole === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99';
  const isGovernanceView = !isBod && ['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab);

  useEffect(() => {
    if (isBod && ['data_records', 'master_data', 'verification', 'import_center', 'templates', 'audit_trail'].includes(activeTab)) {
      const timer = window.setTimeout(() => setActiveTab('beranda'), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isBod, activeTab]);

  const handleSelectTerminal = (t: string) => {
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      setSelectedTerminal(currentUser.branch_id);
      return;
    }
    setSelectedTerminal(t);
  };

  useEffect(() => {
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      const branchId = currentUser.branch_id;
      if (selectedTerminal !== branchId) {
        const timer = window.setTimeout(() => setSelectedTerminal(branchId), 0);
        return () => window.clearTimeout(timer);
      }
    }
  }, [isPicCabang, currentUser?.branch_id, selectedTerminal]);

  // 2. Jika belum login (currentUser === null), tampilkan LoginScreen di awal
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onThemeChange={handleThemeChange}
        sessionExpiredMessage={sessionExpiredMessage}
      />
    );
  }

  return (
    <div
      className="portsight-layout-container"
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* 1. Sidebar Komponen Navigasi Vertikal di Sebelah Kiri */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        currentUser={currentUser}
        pendingCount={pendingCount}
        isBod={isBod}
        canManageUsers={canManageUsers}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        theme={theme}
        onLogout={handleLogout}
        onOpenManualInput={isBod ? undefined : () => handleOpenManualInput()}
      />

      {/* 2. Layout Halaman Utama (CSS Flexbox bergeser ke kanan) */}
      <div
        className="portsight-content-area"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
      >
        {/* R4 PortSight Top Navigation & Subheader */}
        <PortSightHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedTerminal={selectedTerminal}
          setSelectedTerminal={handleSelectTerminal}
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
          onOpenManualInput={isBod ? undefined : () => handleOpenManualInput()}
          pendingCount={pendingCount}
          theme={theme}
          onThemeChange={handleThemeChange}
          comparisonMode={comparisonMode}
          setComparisonMode={setComparisonMode}
          onOpenComparisonModal={() => setIsComparisonModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
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
                <span>Rekaman Data Kinerja</span>
              </button>
              {canManageUsers && (
                <button
                  onClick={() => setActiveTab('master_data')}
                  className={`governance-pill ${activeTab === 'master_data' ? 'active' : ''}`}
                >
                  <Layers size={13} />
                  <span>Master Data & KPI</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('verification')}
                className={`governance-pill ${activeTab === 'verification' ? 'active' : ''}`}
              >
                <CheckCircle2 size={13} />
                <span>Verifikasi & Pemantauan</span>
                {pendingCount > 0 && (
                  <span style={{ backgroundColor: 'var(--status-alert-text)', color: '#0f172a', fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '10px' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('import_center')}
                className={`governance-pill ${activeTab === 'import_center' ? 'active' : ''}`}
              >
                <FileSpreadsheet size={13} />
                <span>Impor Spreadsheet</span>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`governance-pill ${activeTab === 'templates' ? 'active' : ''}`}
              >
                <Sliders size={13} />
                <span>Pemetaan Templat</span>
              </button>
              <button
                onClick={() => setActiveTab('audit_trail')}
                className={`governance-pill ${activeTab === 'audit_trail' ? 'active' : ''}`}
              >
                <History size={13} />
                <span>Jejak Audit & Log</span>
              </button>
            </div>
          </div>
        )}

        {/* Beranda */}
        {activeTab === 'beranda' && (
          <PortSightBeranda
            selectedTerminal={selectedTerminal}
            selectedPeriod={selectedPeriod}
            onSelectTerminal={(tId) => {
              if (currentUser?.role === 'pic_cabang' && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
                return;
              }
              setSelectedTerminal(tId);
            }}
            onNavigateTab={(tabId, branchCode) => {
              if (currentUser?.role === 'pic_cabang' && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
                setSelectedTerminal(currentUser.branch_id);
                setActiveTab(tabId);
                return;
              }
              if (branchCode) setSelectedTerminal(branchCode);
              setActiveTab(tabId);
            }}
            onOpenDrilldown={(item) => setDrilldownItem(item)}
            currentUser={currentUser}
            userRole={userRole}
            comparisonMode={comparisonMode}
            onOpenComparisonModal={() => setIsComparisonModalOpen(true)}
          />
        )}

        {/* Data per Periode (Range Waktu Multi-Modul) */}
        {activeTab === 'periode' && (
          <PortSightPeriode
            selectedTerminal={selectedTerminal}
            selectedPeriod={selectedPeriod}
            currentUser={currentUser}
            userRole={userRole}
          />
        )}

        {/* Finance (Keuangan) */}
        {activeTab === 'keuangan' && (
          <PortSightKeuangan
            selectedTerminal={selectedTerminal}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('finansial')}
          />
        )}

        {/* Opkom (Operasi dan Komersial) */}
        {activeTab === 'opkom' && (
          <PortSightOpkom
            selectedTerminal={selectedTerminal}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('opkom')}
          />
        )}

        {/* Kinerja */}
        {activeTab === 'kinerja' && (
          <PortSightKinerja
            selectedTerminal={selectedTerminal}
            selectedPeriod={selectedPeriod}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('kinerja')}
            onSelectTerminal={(tId) => setSelectedTerminal(tId)}
          />
        )}

        {/* Utilisasi */}
        {activeTab === 'utilisasi' && (
          <PortSightUtilisasi
            selectedTerminal={selectedTerminal}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('utilisasi')}
          />
        )}

        {/* Peralatan */}
        {activeTab === 'peralatan' && (
          <PortSightPeralatan
            selectedTerminal={selectedTerminal}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('peralatan')}
          />
        )}

        {/* Fasilitas */}
        {activeTab === 'fasilitas' && (
          <PortSightFasilitas
            selectedTerminal={selectedTerminal}
            onOpenManualInput={isBod ? undefined : () => handleOpenManualInput('fasilitas')}
          />
        )}

        {/* Data Governance & Admin Tools */}
        {activeTab === 'data_records' && (
          <DataRecordsView
            branches={branches}
            departments={departments}
            userRole={userRole}
            currentUser={currentUser}
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
          canManageUsers ? (
            <MasterDataView
              branches={branches}
              departments={departments}
              indicators={indicators}
              equipment={equipment}
              users={usersList}
              onRefreshUsers={loadMasterData}
              systemParams={systemParams}
              onUpdateSystemParams={(newParams) => {
                setSystemParams(newParams);
                if (newParams.default_theme && !localStorage.getItem('portsight_theme')) {
                  handleThemeChange(newParams.default_theme);
                }
              }}
              dbConfig={dbConfig}
              onUpdateDbConfig={(newCfg) => setDbConfig(newCfg)}
              credentials={credentials}
              onUpdateCredentials={(newCreds) => setCredentials(newCreds)}
              currentUser={currentUser}
            />
          ) : (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              Menu Master Data Pengguna & PIC hanya dapat diakses oleh Super Admin dan Administrator Regional.
            </div>
          )
        )}

        {activeTab === 'audit_trail' && (
          <AuditTrailView />
        )}

        {/* Footer */}
        <footer
          style={{
            marginTop: 'auto',
            padding: '16px 24px',
            textAlign: 'center',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          © 2026 | ICT PT. Pelabuhan Indonesia (Persero) Regional 4. All Rights Reserved
        </footer>
      </main>
      </div>

      {/* Drilldown Modal */}
      {drilldownItem && (
        <div className="modal-overlay" onClick={() => setDrilldownItem(null)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={drilldownItem.title || 'Detail Indikator'}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-main)',
              maxWidth: '580px',
            }}
          >
            <div className="modal-header" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <span className="illustration-pill" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  Detail Indikator
                </span>
                <h3 className="modal-title" style={{ color: 'var(--text-title)', marginTop: '6px' }}>
                  {drilldownItem.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup detail indikator"
                onClick={() => setDrilldownItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  backgroundColor: 'var(--bg-inner)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target RKAP YTD</div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-title)', marginTop: '4px' }}
                  >
                    {drilldownItem.rawTarget || drilldownItem.comp1}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Realisasi Aktual YTD</div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px' }}
                  >
                    {drilldownItem.fullValue || drilldownItem.rawRealization || drilldownItem.value}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: 'var(--bg-inner)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12.5px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Pencapaian terhadap Target:</span>
                <strong className={`tabular-nums ${drilldownItem.comp1Good ? 'text-positive' : 'text-alert'}`}>
                  {drilldownItem.comp1}
                </strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: 'var(--bg-inner)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12.5px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Pertumbuhan Tahunan (YoY):</span>
                <strong className={`tabular-nums ${drilldownItem.comp2Good ? 'text-positive' : 'text-alert'}`}>
                  {drilldownItem.comp2}
                </strong>
              </div>
            </div>

            <div className="modal-footer" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-inner)' }}>
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

      {/* Manual Data Input Modal (Finance, Opkom, Kinerja, Utilisasi, Peralatan, Fasilitas) - Hidden for BOD */}
      {manualInputModalOpen && !isBod && (
        <ManualDataInputModal
          isOpen={manualInputModalOpen}
          onClose={() => setManualInputModalOpen(false)}
          defaultModule={manualInputDefaultModule}
          selectedTerminal={selectedTerminal}
          isBranchLocked={currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99'}
          currentUser={currentUser}
          onSuccess={() => {
            loadMasterData();
          }}
        />
      )}

      {/* Executive Comparison Matrix Modal (vs RKAP & 2025) */}
      <ComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        selectedPeriod={selectedPeriod}
        selectedTerminal={selectedTerminal}
      />

      {/* Floating Inactivity Session Warning Banner */}
      {idleWarningSeconds !== null && currentUser && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-main)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '2px solid #f59e0b',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            maxWidth: '440px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              flexShrink: 0,
            }}
          >
            <Clock size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-title)' }}>
              Peringatan Sesi Tidak Aktif
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              Sesi akan berakhir dalam <strong style={{ color: '#f59e0b', fontSize: '13px' }}>{idleWarningSeconds} detik</strong> karena tidak ada aktivitas.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('portsight_last_activity', String(Date.now()));
              } catch (e) {}
              setIdleWarningSeconds(null);
            }}
            style={{
              padding: '7px 14px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            Lanjutkan Sesi
          </button>
        </div>
      )}
    </div>
  );
}
