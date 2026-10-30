'use client';

import React, { useState } from 'react';
import { Database, Building2, Layers, Target, Wrench, CheckCircle2 } from 'lucide-react';
import { Branch, Department, KPIIndicator, EquipmentItem } from '@/lib/types';

interface MasterDataViewProps {
  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment?: EquipmentItem[];
}

export default function MasterDataView({
  branches,
  departments,
  indicators,
  equipment = [],
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'branches' | 'departments' | 'equipment'>('kpi');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  const filteredIndicators = indicators.filter(i =>
    selectedDeptFilter === 'ALL' || i.department_id === selectedDeptFilter
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Database size={20} color="var(--blue-primary)" />
              <span>Manajemen Master Data Pelabuhan</span>
            </h2>
            <p className="card-subtitle">
              Struktur katalog master cabang pelabuhan, departemen penanggung jawab, serta definisi indikator KPI dan arah pencapaian.
            </p>
          </div>
        </div>

        <div className="tabs-nav">
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
        </div>

        {/* TAB 1: MASTER KPI */}
        {activeTab === 'kpi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Filter Departemen:</span>
              <select
                className="filter-select"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '220px' }}
              >
                <option value="ALL">Semua Departemen (Semua Indikator)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} style={{ background: '#122137' }}>
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
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>{ind.code}</td>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        <div>{ind.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ind.formula_desc || 'Target operasional tahunan'}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {departments.find(d => d.id === ind.department_id)?.code || ind.department_id}
                        </span>
                      </td>
                      <td>{ind.category}</td>
                      <td style={{ textAlign: 'center' }}>{ind.unit}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                          {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{ind.default_target.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'center' }}>
                        {ind.is_core_kpi ? (
                          <span className="badge badge-green">Core KPI</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER BRANCHES */}
        {activeTab === 'branches' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Wilayah / Regional</th>
                  <th>Alamat Kantor</th>
                  <th>Telepon & Kontak</th>
                  <th>Dermaga (m)</th>
                  <th>Kolam (mLWS)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{b.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.name}</td>
                    <td style={{ color: '#cbd5e1' }}>{b.region}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px' }}>{b.address}</td>
                    <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{b.phone}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{(b.facilities?.dermaga_length_m || 0).toLocaleString('id-ID')} m</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.facilities?.kolam_depth_mlws || 0} mLWS</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: MASTER DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Departemen</th>
                  <th>PIC Penanggung Jawab</th>
                  <th>Email PIC</th>
                  <th>Deskripsi Tugas & Ruang Lingkup</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{d.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.name}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.pic_name}</td>
                    <td style={{ fontSize: '12px', color: '#38bdf8' }}>{d.pic_email}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{d.description}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: MASTER EQUIPMENT */}
        {activeTab === 'equipment' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode Alat</th>
                  <th>Nama Peralatan</th>
                  <th style={{ textAlign: 'center' }}>Singkatan</th>
                  <th>Kategori Operasional</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{eq.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{eq.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {eq.acronym}
                      </span>
                    </td>
                    <td style={{ color: '#cbd5e1' }}>{eq.category}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
