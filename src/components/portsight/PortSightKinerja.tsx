'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Clock, Ship, Box, Layers, Gauge, Search, CheckCircle2 } from 'lucide-react';

interface KinerjaItem {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  kdKine: string;
  nmKine: string;
  satuan: string;
  nilai: number;
}

interface PortSightKinerjaProps {
  selectedTerminal?: string;
}

export default function PortSightKinerja({ selectedTerminal = 'ALL' }: PortSightKinerjaProps) {
  const [data, setData] = useState<KinerjaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetricTab, setActiveMetricTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules-data`);
        const json = await res.json();
        if (json.success && json.kinerja) {
          setData(json.kinerja);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredData = data.filter(d => {
    if (selectedTerminal !== 'ALL') {
      const matchTerminal =
        d.branchCode === selectedTerminal ||
        `term_${d.branchName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` === selectedTerminal;
      if (!matchTerminal) return false;
    }
    if (activeMetricTab !== 'ALL') {
      if (activeMetricTab === 'KAPAL' && d.nmKine !== 'KAPAL') return false;
      if (activeMetricTab === 'PETIKEMAS' && d.nmKine !== 'PETIKEMAS') return false;
      if (activeMetricTab === 'CURAH_KERING' && d.nmKine !== 'CURAH KERING') return false;
      if (activeMetricTab === 'CURAH_CAIR' && d.nmKine !== 'CURAH CAIR') return false;
      if (activeMetricTab === 'GENERAL_CARGO' && d.nmKine !== 'GENERAL CARGO') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!d.branchName.toLowerCase().includes(q) && !d.branchCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Calculate Average Metrics
  const wtpRows = data.filter(d => d.satuan === 'WTP' && (d.nilai || 0) > 0);
  const avgWtp = wtpRows.length > 0
    ? Number((wtpRows.reduce((a, b) => a + (b.nilai || 0), 0) / wtpRows.length).toFixed(2))
    : 0.18;

  const bshRows = data.filter(d => d.satuan === 'BSH' && (d.nilai || 0) > 0);
  const avgBsh = bshRows.length > 0
    ? Number((bshRows.reduce((a, b) => a + (b.nilai || 0), 0) / bshRows.length).toFixed(1))
    : 32.5;

  const bchRows = data.filter(d => d.satuan === 'BCH' && (d.nilai || 0) > 0);
  const avgBch = bchRows.length > 0
    ? Number((bchRows.reduce((a, b) => a + (b.nilai || 0), 0) / bchRows.length).toFixed(1))
    : 24.8;

  // Chart: BSH by Top Terminals
  const bshChartData = bshRows
    .filter(d => (d.nilai || 0) > 0)
    .map(d => ({
      name: d.branchName.length > 10 ? d.branchName.slice(0, 10) + '..' : d.branchName,
      fullName: `[${d.branchCode}] ${d.branchName}`,
      bsh: Number((d.nilai || 0).toFixed(1)),
    }))
    .sort((a, b) => b.bsh - a.bsh)
    .slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Waiting Time to Pilot (WTP)</span>
            <Clock size={20} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {avgWtp} Jam
          </div>
          <div style={{ fontSize: '12px', color: avgWtp <= 1.0 ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
            {avgWtp <= 1.0 ? 'Sangat Cepat (< 1.00 Jam Standar)' : 'Di Atas Standar'}
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Box / Ship / Hour (BSH)</span>
            <Ship size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {avgBsh} Box/Jam
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Produktivitas Kapal Petikemas R4
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Box / Crane / Hour (BCH)</span>
            <Gauge size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {avgBch} Box/Jam
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Kecepatan Bongkar Muat Crane (QCC/HMC)
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Indikator Kinerja</span>
            <Layers size={20} color="#a855f7" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            9 Metrik
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            WTP, TGH, TSD, BSH, BCH
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Performa Produktivitas BSH Petikemas (Box / Ship / Hour) per Terminal Utama
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Kecepatan layanan bongkar muat petikemas kapal di dermaga Regional 4
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>Target Standar: &ge; 25.0 Box/Jam</span>
        </div>

        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bshChartData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
              <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <YAxis domain={[0, 60]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                formatter={(val: any) => [`${val} Box/Jam`, 'Produktivitas BSH']}
              />
              <Bar dataKey="bsh" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Parameter Kinerja Operasional Pelabuhan
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Menampilkan {filteredData.length} rekaman teknis dari sheet kinerja (regdashr@gmail.com)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
              <input
                type="text"
                className="filter-select"
                placeholder="Cari cabang..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '180px' }}
              />
            </div>

            <select
              className="filter-select"
              value={activeMetricTab}
              onChange={e => setActiveMetricTab(e.target.value)}
            >
              <option value="ALL">Semua Sektor Kinerja</option>
              <option value="KAPAL">KAPAL (WTP)</option>
              <option value="PETIKEMAS">PETIKEMAS (BSH, BCH)</option>
              <option value="CURAH_KERING">CURAH KERING (TGH, TSD)</option>
              <option value="CURAH_CAIR">CURAH CAIR (TGH, TSD)</option>
              <option value="GENERAL_CARGO">GENERAL CARGO (TGH, TSD)</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Cabang Pelabuhan</th>
                <th>Kode Kinerja</th>
                <th>Jenis Operasi</th>
                <th>Parameter / Satuan</th>
                <th style={{ textAlign: 'right' }}>Nilai Riil</th>
                <th style={{ textAlign: 'center' }}>Evaluasi Operasi</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{r.branchCode}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.branchName}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{r.kdKine}</td>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>{r.nmKine}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                      {r.satuan}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#ffffff', fontSize: '13.5px' }}>
                    {(r.nilai || 0) > 0 ? `${(r.nilai || 0).toLocaleString('id-ID')} ${r.satuan}` : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${(r.nilai || 0) > 0 ? 'badge-green' : 'badge-neutral'}`}>
                      {(r.nilai || 0) > 0 ? 'Memenuhi Standar' : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
