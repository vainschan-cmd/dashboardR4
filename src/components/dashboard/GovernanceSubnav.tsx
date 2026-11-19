'use client';

import type React from 'react';
import { CheckCircle2, Database, FileSpreadsheet, History, Layers, Sliders } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { getVisibleGovernanceNavItems } from '@/lib/governanceNav';

const ITEM_ICONS: Record<string, React.ElementType> = {
  import_center: FileSpreadsheet,
  verification: CheckCircle2,
  data_records: Database,
  master_data: Layers,
  templates: Sliders,
  audit_trail: History,
};

/**
 * Compact governance sub-navigation (`CODE-02`).
 *
 * Rendered exclusively on viewports < 1024px where the desktop sidebar is hidden
 * inside the mobile drawer, preventing redundant double navigation on desktop.
 * Consumes `GOVERNANCE_NAV_ITEMS` so labels, ordering, and role guards match Sidebar 1:1.
 */
export interface GovernanceSubnavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  canManageUsers: boolean;
  pendingCount: number;
  userRole?: UserRole;
}

export default function GovernanceSubnav({
  activeTab,
  onSelectTab,
  canManageUsers,
  pendingCount,
  userRole = canManageUsers ? 'admin_regional' : 'pic_cabang',
}: GovernanceSubnavProps) {
  const items = getVisibleGovernanceNavItems(userRole, canManageUsers);
  if (items.length === 0) return null;

  return (
    <div className="governance-subnav-mobile-only">
      <div className="governance-subnav" role="navigation" aria-label="Navigasi Tata Kelola">
        {items.map((item) => {
          const Icon = ITEM_ICONS[item.id] || Database;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`governance-pill ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={13} aria-hidden="true" />
              <span>{item.label}</span>
              {item.id === 'verification' && pendingCount > 0 && (
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
          );
        })}
      </div>
    </div>
  );
}
