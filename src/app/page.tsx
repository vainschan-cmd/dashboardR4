'use client';

import { useCallback, useEffect, useState } from 'react';
import PortSightHeader from '@/components/layout/PortSightHeader';
import Sidebar from '@/components/layout/Sidebar';
import LoginScreen from '@/components/auth/LoginScreen';
import DashboardModuleView from '@/components/dashboard/DashboardModuleView';
import DashboardOverlays from '@/components/dashboard/DashboardOverlays';
import GovernanceSubnav from '@/components/dashboard/GovernanceSubnav';
import type { DrilldownItem } from '@/components/dashboard/DrilldownModal';
import type { ModuleType } from '@/components/admin/ManualDataInputModal';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';
import { useDashboardData } from '@/hooks/useDashboardData';
import { resolvePeriodRange } from '@/lib/period';
import { isGovernanceTab } from '@/lib/tabs';

/** Modules the manual-entry modal can open on directly. */
const MANUAL_MODULES = ['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas'];

/**
 * Dashboard shell (`CODE-02`).
 *
 * This file used to be 1,143 lines: session restore, idle timer, URL sync,
 * master-data fetching, a 380-line module switch, five modals, and the layout,
 * all in one function body. It is now the composition root only — roughly 200
 * lines wiring three hooks and three presentational components together.
 * Nothing here computes a figure; every number still comes from the module
 * components and the same APIs as before.
 */
export default function DashboardHome() {
  const session = useDashboardSession();

  const effectiveRole = session.currentUser?.role ?? session.userRole;
  const isBod = effectiveRole === 'viewer';
  const canManageUsers = effectiveRole === 'super_admin' || effectiveRole === 'admin_regional';

  const filters = useDashboardFilters({
    currentUser: session.currentUser,
    signIn: session.signIn,
    isBod,
  });

  const data = useDashboardData({
    currentUser: session.currentUser,
    selectedPeriod: filters.selectedPeriod,
    setSystemParams: session.setSystemParams,
    onThemeChange: session.handleThemeChange,
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [drilldownItem, setDrilldownItem] = useState<DrilldownItem | null>(null);
  const [manualInputModalOpen, setManualInputModalOpen] = useState(false);
  const [manualInputDefaultModule, setManualInputDefaultModule] = useState<ModuleType>('finansial');
  const [comparisonMode] = useState('all');
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Escape closes the drill-down; every other overlay handles its own keys.
  useEffect(() => {
    if (!drilldownItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrilldownItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drilldownItem]);

  const handleOpenManualInput = useCallback(
    (moduleName?: string) => {
      if (isBod) return;
      if (moduleName && MANUAL_MODULES.includes(moduleName)) {
        setManualInputDefaultModule(moduleName as ModuleType);
      }
      setManualInputModalOpen(true);
    },
    [isBod]
  );

  // Export uses the period selected in the UI. A real anchor click is used
  // instead of `window.location.href` so the browser treats the response as a
  // download and Next.js does not intercept the navigation.
  const handleExportExcel = useCallback(() => {
    const range = resolvePeriodRange(filters.selectedPeriod);
    const params = new URLSearchParams({
      type: 'data',
      branch_id: filters.selectedTerminal,
      month: String(range.endMonth),
      year: String(range.endYear),
    });
    const link = document.createElement('a');
    link.href = `/api/reports/export?${params.toString()}`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [filters.selectedPeriod, filters.selectedTerminal]);

  const handlePrint = useCallback(() => window.print(), []);

  if (!session.currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={session.handleLoginSuccess}
        theme={session.theme}
        onThemeChange={session.handleThemeChange}
        sessionExpiredMessage={session.sessionExpiredMessage}
      />
    );
  }

  const currentUser = session.currentUser;
  const showGovernanceSubnav = !isBod && isGovernanceTab(filters.activeTab);

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
      <Sidebar
        activeTab={filters.activeTab}
        setActiveTab={filters.setActiveTab}
        userRole={session.userRole}
        currentUser={currentUser}
        pendingCount={data.pendingCount}
        isBod={isBod}
        canManageUsers={canManageUsers}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        theme={session.theme}
        onLogout={session.handleLogout}
        onOpenManualInput={isBod ? undefined : () => handleOpenManualInput()}
      />

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
        <PortSightHeader
          activeTab={filters.activeTab}
          setActiveTab={filters.setActiveTab}
          selectedTerminal={filters.selectedTerminal}
          userRole={session.userRole}
          currentUser={currentUser}
          onOpenAuth={session.openAuthModal}
          onLogout={session.handleLogout}
          onExportExcel={handleExportExcel}
          onPrint={handlePrint}
          onOpenManualInput={isBod ? undefined : () => handleOpenManualInput()}
          onOpenPasswordChange={session.openPasswordModal}
          pendingCount={data.pendingCount}
          theme={session.theme}
          onThemeChange={session.handleThemeChange}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main className="portsight-main">
          {showGovernanceSubnav && (
            <GovernanceSubnav
              activeTab={filters.activeTab}
              onSelectTab={filters.setActiveTab}
              canManageUsers={canManageUsers}
              pendingCount={data.pendingCount}
            />
          )}

          <DashboardModuleView
            activeTab={filters.activeTab}
            selectedTerminal={filters.selectedTerminal}
            selectedPeriod={filters.selectedPeriod}
            userRole={session.userRole}
            username={session.username}
            currentUser={currentUser}
            canManageUsers={canManageUsers}
            isBod={isBod}
            comparisonMode={comparisonMode}
            branches={data.branches}
            departments={data.departments}
            indicators={data.indicators}
            equipment={data.equipment}
            templates={data.templates}
            usersList={data.usersList}
            systemParams={session.systemParams}
            dbConfig={data.dbConfig}
            credentials={data.credentials}
            onSelectTerminal={filters.selectTerminal}
            onNavigateTab={filters.navigateToTab}
            onOpenDrilldown={setDrilldownItem}
            onOpenComparisonModal={() => setIsComparisonModalOpen(true)}
            onOpenManualInput={handleOpenManualInput}
            onReload={() => void data.reload()}
            onUpdateSystemParams={data.updateSystemParams}
            onUpdateDbConfig={data.setDbConfig}
            onUpdateCredentials={data.setCredentials}
          />

          <footer
            style={{
              marginTop: 'auto',
              padding: '16px 24px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            © 2026 PT Pelabuhan Indonesia (Persero) Regional 4 — Divisi ICT
          </footer>
        </main>
      </div>

      <DashboardOverlays
        currentUser={currentUser}
        selectedTerminal={filters.selectedTerminal}
        selectedPeriod={filters.selectedPeriod}
        drilldownItem={drilldownItem}
        onCloseDrilldown={() => setDrilldownItem(null)}
        authModalOpen={session.authModalOpen}
        authModalMode={session.authModalMode}
        onCloseAuthModal={() => session.setAuthModalOpen(false)}
        onLoginSuccess={session.handleLoginSuccess}
        manualInputModalOpen={manualInputModalOpen}
        manualInputDefaultModule={manualInputDefaultModule}
        onCloseManualInput={() => setManualInputModalOpen(false)}
        isBod={isBod}
        isBranchLocked={filters.isPicCabang}
        onReload={() => void data.reload()}
        comparisonModalOpen={isComparisonModalOpen}
        onCloseComparisonModal={() => setIsComparisonModalOpen(false)}
        passwordModalOpen={session.passwordModalOpen}
        passwordChangeRequired={session.passwordChangeRequired}
        onClosePasswordModal={session.closePasswordModal}
        onPasswordChanged={session.finishPasswordChange}
        onSignedOut={session.handleLogout}
        idleWarningSeconds={session.idleWarningSeconds}
        onExtendSession={session.extendSession}
      />
    </div>
  );
}
