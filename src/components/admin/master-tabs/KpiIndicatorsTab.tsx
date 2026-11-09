'use client';

import React, { useState } from 'react';
import { Department, KPIIndicator } from '@/lib/types';

interface KpiIndicatorsTabProps {
  indicators: KPIIndicator[];
  departments: Department[];
}

export default function KpiIndicatorsTab({ indicators, departments }: KpiIndicatorsTabProps) {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  const filteredIndicators = indicators.filter(
    (i) => selectedDeptFilter === 'ALL' || i.department_id === selectedDeptFilter
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter Departemen:</span>
        <select
          className="filter-select"
          value={selectedDeptFilter}
          onChange={(e) => setSelectedDeptFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '220px' }}
        >
          <option value="ALL">Semua Departemen (Semua Indikator)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} - {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Indikator</th>
              <th>Departemen</th>
              <th>Kategori</th>
              <th style={{ textAlign: 'center' }}>Satuan</th>
              <th style={{ textAlign: 'center' }}>Arah Target</th>
              <th style={{ textAlign: 'right' }}>Target Standar</th>
              <th style={{ textAlign: 'center' }}>KPI Utama</th>
            </tr>
          </thead>
          <tbody>
            {filteredIndicators.map((ind) => (
              <tr key={ind.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-blue)' }}>
                  {ind.code}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                  <div>{ind.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {ind.formula_desc || 'Target operasional tahunan'}
                  </div>
                </td>
                <td>
                  <span className="badge badge-neutral">
                    {departments.find((d) => d.id === ind.department_id)?.code || ind.department_id}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{ind.category}</td>
                <td style={{ textAlign: 'center' }}>{ind.unit}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                    {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                  </span>
                </td>
                <td className="num-cell" style={{ fontWeight: 700, color: 'var(--text-title)' }}>
                  {ind.default_target.toLocaleString('id-ID')}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {ind.is_core_kpi ? (
                    <span className="badge badge-green">KPI Utama</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

