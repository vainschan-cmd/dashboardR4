'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { KPIDirection, StatusColor } from '@/lib/types';

interface KPICardProps {
  title: string;
  value: number;
  target: number;
  unit: string;
  achievementPct: number;
  statusColor: StatusColor;
  direction?: KPIDirection;
  icon?: React.ReactNode;
  comparisonLabel?: string;
  comparisonPct?: number;
  onClick?: () => void;
}

export default function KPICard({
  title,
  value,
  target,
  unit,
  achievementPct,
  statusColor,
  direction = 'higher_is_better',
  icon,
  comparisonLabel,
  comparisonPct,
  onClick,
}: KPICardProps) {
  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '0';
    if (unit.toLowerCase().includes('rp')) {
      return Math.round(num).toLocaleString('id-ID');
    }
    if (Number.isInteger(num)) {
      return num.toLocaleString('id-ID');
    }
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  const getStatusBadgeClass = () => {
    switch (statusColor) {
      case 'green': return 'badge-green';
      case 'yellow': return 'badge-yellow';
      case 'red': return 'badge-red';
      default: return 'badge-neutral';
    }
  };

  const isGood = statusColor === 'green';

  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? 'Klik untuk melihat rincian drill-down' : undefined}
    >
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        {icon && <div className="kpi-icon-wrap">{icon}</div>}
      </div>

      <div className="kpi-value-row">
        <span className="kpi-value">{formatNumber(value)}</span>
        <span className="kpi-unit">{unit}</span>
      </div>

      <div className="kpi-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Target size={13} color="#64748b" />
          <span className="kpi-target-label">Target: <strong>{formatNumber(target)} {unit}</strong></span>
        </div>

        <div className={`badge ${getStatusBadgeClass()}`}>
          {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{achievementPct}%</span>
        </div>
      </div>

      {comparisonLabel && comparisonPct !== undefined && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{comparisonLabel}:</span>
          <span style={{
            fontWeight: 600,
            color: comparisonPct > 0 ? '#059669' : comparisonPct < 0 ? '#dc2626' : '#64748b'
          }}>
            {comparisonPct > 0 ? `+${comparisonPct}%` : `${comparisonPct}%`}
          </span>
        </div>
      )}
    </div>
  );
}
