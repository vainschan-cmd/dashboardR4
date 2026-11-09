'use client';

import React, { useState } from 'react';
import {
  Database,
  Building2,
  Layers,
  Target,
  Wrench,
  UserCheck,
  Sliders,
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
import KpiIndicatorsTab from './master-tabs/KpiIndicatorsTab';
import BranchesTab from './master-tabs/BranchesTab';
import EquipmentCatalogTab from './master-tabs/EquipmentCatalogTab';
import SystemParametersTab from './master-tabs/SystemParametersTab';

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
  const [activeTab, setActiveTab] = useState<'kpi' | 'branches' | 'departments' | 'equipment' | 'users' | 'parameter'>('users');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Database size={20} color="var(--accent-blue)" />
              <span>Manajemen Master Data Pelabuhan</span>
            </h2>
            <p className="card-subtitle">
              Struktur katalog master cabang pelabuhan, departemen, PIC pengguna, serta definisi indikator KPI dan peralatan operasional.
            </p>
          </div>
        </div>

        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('users')}
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <UserCheck size={16} />
            <span>Master Pengguna & PIC ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`tab-btn ${activeTab === 'kpi' ? 'active' : ''}`}
          >
            <Target size={16} />
            <span>Master Indikator & KPI ({indicators.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          >
            <Building2 size={16} />
            <span>Master Cabang Pelabuhan ({branches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Master Departemen ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`tab-btn ${activeTab === 'equipment' ? 'active' : ''}`}
          >
            <Wrench size={16} />
            <span>Master Katalog Peralatan ({equipment.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('parameter')}
            className={`tab-btn ${activeTab === 'parameter' ? 'active' : ''}`}
          >
            <Sliders size={16} />
            <span>Parameter Sistem</span>
          </button>
        </div>

        {activeTab === 'users' && (
          <UsersPicTab users={users} onRefreshUsers={onRefreshUsers} />
        )}

        {activeTab === 'kpi' && (
          <KpiIndicatorsTab indicators={indicators} departments={departments} />
        )}

        {(activeTab === 'branches' || activeTab === 'departments') && (
          <BranchesTab mode={activeTab} branches={branches} departments={departments} />
        )}

        {activeTab === 'equipment' && (
          <EquipmentCatalogTab equipment={equipment} />
        )}

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
  );
}
