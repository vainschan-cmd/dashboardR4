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
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter Departemen:</span>
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
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col">Kode</th>
              <th scope="col">Nama Indikator</th>
              <th scope="col">Departemen</th>
              <th scope="col">Kategori</th>
              <th scope="col" style={{ textAlign: 'center' }}>Satuan</th>
              <th scope="col" style={{ textAlign: 'center' }}>Arah Target</th>
              <th scope="col" style={{ textAlign: 'right' }}>Target Standar</th>
              <th scope="col" style={{ textAlign: 'center' }}>KPI Utama</th>
            </tr>
          </thead>
          <tbody>
            {filteredIndicators.map((ind) => (
              <tr key={ind.id}>
                <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-blue-text)' }}>
                  {ind.code}
                </td>
                <td data-label="Nama Indikator" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                  <div>{ind.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {ind.formula_desc || 'Target operasional tahunan'}
                  </div>
                </td>
                <td data-label="Departemen">
                  <span className="badge badge-neutral">
                    {departments.find((d) => d.id === ind.department_id)?.code || ind.department_id}
                  </span>
                </td>
                <td data-label="Kategori" style={{ color: 'var(--text-secondary)' }}>{ind.category}</td>
                <td data-label="Satuan" style={{ textAlign: 'center' }}>{ind.unit}</td>
                <td data-label="Arah Target" style={{ textAlign: 'center' }}>
                  <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                    {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                  </span>
                </td>
                <td data-label="Target Standar" className="num-cell" style={{ fontWeight: 700, color: 'var(--text-title)' }}>
                  {ind.default_target.toLocaleString('id-ID')}
                </td>
                <td data-label="KPI Utama" style={{ textAlign: 'center' }}>
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

