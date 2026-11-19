'use client';

import React, { useState } from 'react';
import {
  Database,
  Building2,
  Layers,
  Target,
  UserCheck,
  ShieldCheck,
  Sliders,
  Wrench,
} from 'lucide-react';
import {
  Branch,
  Department,
  KPIIndicator,
  EquipmentItem,
  User,
  SystemParameters,
  DatabaseConfig,
  IntegrationCredentials,
} from '@/lib/types';
import UsersPicTab from './master-tabs/UsersPicTab';
import RolesPermissionsTab from './master-tabs/RolesPermissionsTab';
import KpiIndicatorsTab from './master-tabs/KpiIndicatorsTab';
import BranchesTab from './master-tabs/BranchesTab';
import EquipmentCatalogTab from './master-tabs/EquipmentCatalogTab';
import SystemParametersTab from './master-tabs/SystemParametersTab';

type MasterTabId = 'users' | 'roles' | 'kpi' | 'branches' | 'departments' | 'equipment' | 'parameter';

interface MasterDataViewProps {
  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment?: EquipmentItem[];
  users?: User[];
  onRefreshUsers?: () => void;
  systemParams?: SystemParameters;
  onUpdateSystemParams?: (newParams: SystemParameters) => void;
  dbConfig?: DatabaseConfig;
  onUpdateDbConfig?: (newConfig: DatabaseConfig) => void;
  credentials?: IntegrationCredentials;
  onUpdateCredentials?: (newCreds: IntegrationCredentials) => void;
  currentUser?: User | null;
}

interface MasterNavGroup {
  groupTitle: string;
  items: {
    id: MasterTabId;
    label: string;
    subtitle: string;
    icon: React.ElementType;
    badge?: string | number;
  }[];
}

export default function MasterDataView({
  branches,
  departments,
  indicators,
  equipment = [],
  users = [],
  onRefreshUsers,
  systemParams,
  onUpdateSystemParams,
  dbConfig,
  onUpdateDbConfig,
  credentials,
  onUpdateCredentials,
  currentUser,
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<MasterTabId>('users');

  const navGroups: MasterNavGroup[] = [
    {
      groupTitle: 'Akses & Identitas',
      items: [
        {
          id: 'users',
          label: 'Pengguna & PIC',
          subtitle: 'Direktori akun resmi pegawai Pelindo Regional 4, penugasan cabang, dan sinkronisasi spreadsheet PIC.',
          icon: UserCheck,
          badge: users.length,
        },
        {
          id: 'roles',
          label: 'Peran & Hak Akses',
          subtitle: 'Manajemen Role-Based Access Control (RBAC), peran kustom, cakupan wilayah, dan matriks 16 izin granular.',
          icon: ShieldCheck,
          badge: 'RBAC',
        },
      ],
    },
    {
      groupTitle: 'Referensi Operasional',
      items: [
        {
          id: 'kpi',
          label: 'Indikator & KPI',
          subtitle: 'Definisi indikator kinerja utama, polaritas penilaian, satuan, dan pemetaan departemen.',
          icon: Target,
          badge: indicators.length,
        },
        {
          id: 'branches',
          label: 'Cabang Pelabuhan',
          subtitle: 'Daftar resmi 28 cabang & terminal Pelindo Regional 4 beserta kode referensi sistem.',
          icon: Building2,
          badge: branches.length,
        },
        {
          id: 'departments',
          label: 'Departemen',
          subtitle: 'Struktur departemen pelaporan dan PIC fungsional di tingkat kantor regional.',
          icon: Layers,
          badge: departments.length,
        },
        {
          id: 'equipment',
          label: 'Katalog Peralatan',
          subtitle: 'Master inventaris peralatan bongkar muat operasional per cabang & terminal.',
          icon: Wrench,
          badge: equipment.length,
        },
      ],
    },
    {
      groupTitle: 'Konfigurasi Sistem',
      items: [
        {
          id: 'parameter',
          label: 'Parameter & Integrasi',
          subtitle: 'Pengaturan keamanan sesi, ambang batas KPI, koneksi database PostgreSQL, dan kredensial integrasi.',
          icon: Sliders,
        },
      ],
    },
  ];

  const allItems = navGroups.flatMap((g) => g.items);
  const currentMeta = allItems.find((item) => item.id === activeTab) || allItems[0];
  const ActiveIcon = currentMeta.icon;

  return (
    <div className="master-settings-shell">
      {/* Left Vertical Settings Rail (Desktop) / Compact Selector (Mobile) */}
      <aside className="master-rail card" aria-label="Kategori Master Data & Akses">
        <div className="master-rail-header">
          <div className="master-rail-icon">
            <Database size={17} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)', lineHeight: 1.25 }}>
              Master Data &amp; Akses
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              7 modul referensi inti
            </div>
          </div>
        </div>

        {/* Mobile Quick Select (< 768px) */}
        <div className="master-rail-mobile-select">
          <label htmlFor="master-mobile-select" className="form-label">
            Pilih Modul Master Data
          </label>
          <select
            id="master-mobile-select"
            className="form-select"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as MasterTabId)}
          >
            {navGroups.map((group) => (
              <optgroup key={group.groupTitle} label={group.groupTitle}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.badge !== undefined ? ` (${item.badge})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Desktop & Tablet Vertical Rail Groups */}
        <nav className="master-rail-nav" aria-label="Menu master data">
          {navGroups.map((group) => (
            <div key={group.groupTitle} className="master-rail-group">
              <div className="master-rail-group-title">{group.groupTitle}</div>
              <div className="master-rail-group-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`master-rail-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="master-rail-item-left">
                        <Icon size={15} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span className={`master-rail-badge ${isActive ? 'active' : ''}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Right Main Master Workspace */}
      <div className="master-workspace card">
        <div className="master-workspace-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="master-workspace-icon">
              <ActiveIcon size={18} />
            </div>
            <div>
              <h2
                className="card-title"
                style={{ fontSize: '16px', margin: 0, lineHeight: 1.3 }}
              >
                <span>{currentMeta.label}</span>
              </h2>
              <p className="card-subtitle" style={{ margin: '2px 0 0' }}>
                {currentMeta.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="master-workspace-body">
          {activeTab === 'users' && (
            <UsersPicTab
              users={users}
              departments={departments}
              onRefreshUsers={onRefreshUsers}
              currentUser={currentUser}
              onNavigateToRoles={() => setActiveTab('roles')}
            />
          )}

          {activeTab === 'roles' && (
            <RolesPermissionsTab
              currentUser={currentUser}
              onRolesUpdated={() => {
                if (onRefreshUsers) onRefreshUsers();
              }}
            />
          )}

          {activeTab === 'kpi' && (
            <KpiIndicatorsTab indicators={indicators} departments={departments} />
          )}

          {(activeTab === 'branches' || activeTab === 'departments') && (
            <BranchesTab mode={activeTab} branches={branches} departments={departments} />
          )}

          {activeTab === 'equipment' && <EquipmentCatalogTab equipment={equipment} />}

          {activeTab === 'parameter' && (
            <SystemParametersTab
              systemParams={systemParams}
              onUpdateSystemParams={onUpdateSystemParams}
              dbConfig={dbConfig}
              onUpdateDbConfig={onUpdateDbConfig}
              credentials={credentials}
              onUpdateCredentials={onUpdateCredentials}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>
    </div>
  );
}
