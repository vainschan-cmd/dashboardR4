'use client';

import type {
  Branch,
  DatabaseConfig,
  Department,
  EquipmentItem,
  IntegrationCredentials,
  KPIIndicator,
  SystemParameters,
  TemplateConfig,
  User,
  UserRole,
} from '@/lib/types';
import {
  AuditTrailView,
  DataRecordsView,
  ImportCenter,
  MasterDataView,
  PortSightBeranda,
  PortSightIsuStrategis,
  PortSightFasilitas,
  PortSightKeuangan,
  PortSightKinerja,
  PortSightOpkom,
  PortSightPeralatan,
  PortSightPeriode,
  PortSightUtilisasi,
  TemplateMapping,
  VerificationQueue,
} from './moduleRegistry';
import type { DrilldownItem } from './DrilldownModal';

/**
 * Renders exactly one dashboard module for the active tab (`CODE-02`).
 *
 * Before this, the module switch was ~380 lines of `{activeTab === '…' && (<…>)}`
 * inside `page.tsx`, interleaved with the shell's own layout. Two things were
 * wrong with that: the shell re-rendered every module's JSX tree on each idle
 * countdown tick, and reviewing "which props does verification get?" meant
 * scrolling through eight unrelated modules.
 */
export interface DashboardModuleViewProps {
  activeTab: string;
  selectedTerminal: string;
  selectedPeriod: string;
  userRole: UserRole;
  username: string;
  currentUser: User;
  canManageUsers: boolean;
  isBod: boolean;
  comparisonMode: string;

  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment: EquipmentItem[];
  templates: TemplateConfig[];
  usersList: User[];
  systemParams: SystemParameters;
  dbConfig?: DatabaseConfig;
  credentials?: IntegrationCredentials;

  onSelectTerminal: (branchId: string) => void;
  onNavigateTab: (tabId: string, branchCode?: string) => void;
  onOpenDrilldown: (item: DrilldownItem) => void;
  onOpenComparisonModal: () => void;
  onOpenManualInput: (moduleName?: string) => void;
  onReload: () => void;
  onUpdateSystemParams: (params: SystemParameters) => void;
  onUpdateDbConfig: (config: DatabaseConfig) => void;
  onUpdateCredentials: (credentials: IntegrationCredentials) => void;
}

export default function DashboardModuleView(props: DashboardModuleViewProps) {
  const {
    activeTab,
    selectedTerminal,
    selectedPeriod,
    userRole,
    username,
    currentUser,
    canManageUsers,
    isBod,
    comparisonMode,
    branches,
    departments,
    indicators,
    equipment,
    templates,
    usersList,
    systemParams,
    dbConfig,
    credentials,
    onSelectTerminal,
    onNavigateTab,
    onOpenDrilldown,
    onOpenComparisonModal,
    onOpenManualInput,
    onReload,
    onUpdateSystemParams,
    onUpdateDbConfig,
    onUpdateCredentials,
  } = props;

  // The BOD persona gets no manual-input affordance at all — hiding the button
  // is friendlier than letting the API reject the write.
  const manualInput = isBod ? undefined : onOpenManualInput;

  switch (activeTab) {
    case 'beranda':
      return (
        <PortSightBeranda
          selectedTerminal={selectedTerminal}
          selectedPeriod={selectedPeriod}
          onSelectTerminal={onSelectTerminal}
          onNavigateTab={onNavigateTab}
          onOpenDrilldown={onOpenDrilldown}
          currentUser={currentUser}
          userRole={userRole}
          comparisonMode={comparisonMode}
          onOpenComparisonModal={onOpenComparisonModal}
        />
      );

    case 'isu_strategis':
      return (
        <PortSightIsuStrategis
          selectedTerminal={selectedTerminal}
          selectedPeriod={selectedPeriod}
          currentUser={currentUser}
          userRole={userRole}
          onNavigateTab={onNavigateTab}
        />
      );

    case 'periode':
      return (
        <PortSightPeriode
          selectedTerminal={selectedTerminal}
          selectedPeriod={selectedPeriod}
          currentUser={currentUser}
          userRole={userRole}
        />
      );

    case 'keuangan':
      return (
        <PortSightKeuangan
          selectedTerminal={selectedTerminal}
          onOpenManualInput={manualInput ? () => manualInput('finansial') : undefined}
        />
      );

    case 'opkom':
      return (
        <PortSightOpkom
          selectedTerminal={selectedTerminal}
          onOpenManualInput={manualInput ? () => manualInput('opkom') : undefined}
        />
      );

    case 'kinerja':
      return (
        <PortSightKinerja
          selectedTerminal={selectedTerminal}
          selectedPeriod={selectedPeriod}
          onOpenManualInput={manualInput ? () => manualInput('kinerja') : undefined}
          onSelectTerminal={onSelectTerminal}
        />
      );

    case 'utilisasi':
      return (
        <PortSightUtilisasi
          selectedTerminal={selectedTerminal}
          onOpenManualInput={manualInput ? () => manualInput('utilisasi') : undefined}
        />
      );

    case 'peralatan':
      return (
        <PortSightPeralatan
          selectedTerminal={selectedTerminal}
          onOpenManualInput={manualInput ? () => manualInput('peralatan') : undefined}
        />
      );

    case 'fasilitas':
      return (
        <PortSightFasilitas
          selectedTerminal={selectedTerminal}
          onOpenManualInput={manualInput ? () => manualInput('fasilitas') : undefined}
        />
      );

    case 'data_records':
      return (
        <DataRecordsView
          branches={branches}
          departments={departments}
          userRole={userRole}
          currentUser={currentUser}
          onRefreshNeeded={onReload}
        />
      );

    case 'import_center':
      return (
        <ImportCenter
          branches={branches}
          departments={departments}
          userRole={userRole}
          username={username}
          onImportSuccess={onReload}
        />
      );

    case 'verification':
      return (
        <VerificationQueue
          selectedMonth={9}
          selectedYear={2026}
          userRole={userRole}
          username={username}
          onVerificationDone={onReload}
        />
      );

    case 'templates':
      return (
        <TemplateMapping
          departments={departments}
          templates={templates}
          userRole={userRole}
          username={username}
          onTemplateUpdated={onReload}
        />
      );

    case 'master_data':
      if (!canManageUsers) {
        return (
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
            Menu Master Data Pengguna & PIC hanya dapat diakses oleh Super Admin dan Administrator
            Regional.
          </div>
        );
      }
      return (
        <MasterDataView
          branches={branches}
          departments={departments}
          indicators={indicators}
          equipment={equipment}
          users={usersList}
          onRefreshUsers={onReload}
          systemParams={systemParams}
          onUpdateSystemParams={onUpdateSystemParams}
          dbConfig={dbConfig}
          onUpdateDbConfig={onUpdateDbConfig}
          credentials={credentials}
          onUpdateCredentials={onUpdateCredentials}
          currentUser={currentUser}
        />
      );

    case 'audit_trail':
      return <AuditTrailView />;

    default:
      // `activeTab` is validated against `VALID_TABS` on read, so this only
      // happens for a tab that exists in the URL but has no view yet.
      return null;
  }
}
