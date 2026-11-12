'use client';

import { CheckCircle2, Database, FileSpreadsheet, History, Layers, Sliders } from 'lucide-react';

/**
 * Sub-navigation for the data-governance views (`CODE-02`).
 *
 * Extracted from `page.tsx`. The only logic here is which pills exist for the
 * current role — `master_data` is limited to super admin and admin regional,
 * matching what the API will actually allow.
 */
export interface GovernanceSubnavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  canManageUsers: boolean;
  pendingCount: number;
}

export default function GovernanceSubnav({
  activeTab,
  onSelectTab,
  canManageUsers,
  pendingCount,
}: GovernanceSubnavProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginBottom: '4px',
      }}
    >
      <div className="governance-subnav">
        <button
          onClick={() => onSelectTab('data_records')}
          className={`governance-pill ${activeTab === 'data_records' ? 'active' : ''}`}
        >
          <Database size={13} />
          <span>Rekaman Data Kinerja</span>
        </button>

        {canManageUsers && (
          <button
            onClick={() => onSelectTab('master_data')}
            className={`governance-pill ${activeTab === 'master_data' ? 'active' : ''}`}
          >
            <Layers size={13} />
            <span>Master Data & KPI</span>
          </button>
        )}

        <button
          onClick={() => onSelectTab('verification')}
          className={`governance-pill ${activeTab === 'verification' ? 'active' : ''}`}
        >
          <CheckCircle2 size={13} />
          <span>Verifikasi & Pemantauan</span>
          {pendingCount > 0 && (
            <span
              style={{
                backgroundColor: 'var(--status-alert-text)',
                color: 'var(--text-on-alert)',
                fontSize: '12px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '10px',
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('import_center')}
          className={`governance-pill ${activeTab === 'import_center' ? 'active' : ''}`}
        >
          <FileSpreadsheet size={13} />
          <span>Impor Spreadsheet</span>
        </button>

        <button
          onClick={() => onSelectTab('templates')}
          className={`governance-pill ${activeTab === 'templates' ? 'active' : ''}`}
        >
          <Sliders size={13} />
          <span>Pemetaan Templat</span>
        </button>

        <button
          onClick={() => onSelectTab('audit_trail')}
          className={`governance-pill ${activeTab === 'audit_trail' ? 'active' : ''}`}
        >
          <History size={13} />
          <span>Jejak Audit & Log</span>
        </button>
      </div>
    </div>
  );
}
