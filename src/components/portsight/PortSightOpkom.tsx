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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Anchor, Package, Ship, Users, Layers, TrendingUp, Search, PlusCircle } from 'lucide-react';
import { formatRupiahFull } from '@/lib/formatters';
import { getCanonicalBranchCode } from '@/lib/constants';

interface OpkomItem {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  layanan: string;
  satuan: string;
  jumlahRp: number;
  jumlahM: number;
  yoy: number;
  rka: number;
}

interface PortSightOpkomProps {
  selectedTerminal?: string;
  onOpenManualInput?: () => void;
}

const COMMODITY_COLORS: Record<string, string> = {
  'KAPAL': '#38bdf8',
  'PETIKEMAS': '#f59e0b',
  'BARANG': '#10b981',
  'PENUMPANG': '#a855f7',
  'RUPA-RUPA': '#ec4899',
};

export default function PortSightOpkom({ selectedTerminal = 'ALL', onOpenManualInput }: PortSightOpkomProps) {
  const [data, setData] = useState<OpkomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayanan, setSelectedLayanan] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules-data`);
        const json = await res.json();
        if (json.success && json.opkom) {
          setData(json.opkom);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter based on selected terminal and commodity
  const filteredData = data.filter(d => {
    if (selectedTerminal !== 'ALL') {
      const canonicalTarget = getCanonicalBranchCode(selectedTerminal);
      const matchTerminal =
        d.branchCode === selectedTerminal ||
        (canonicalTarget && d.branchCode === canonicalTarget) ||
        `term_${d.branchName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` === selectedTerminal.toLowerCase();
      if (!matchTerminal) return false;
    }
    if (selectedLayanan !== 'ALL' && d.layanan !== selectedLayanan) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!d.branchName.toLowerCase().includes(q) && !d.branchCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Calculate Aggregates
  const totalRevenueRp = filteredData.reduce((acc, cur) => acc + (cur.jumlahRp || 0), 0);
  const totalRevenueM = filteredData.reduce((acc, cur) => acc + cur.jumlahM, 0);
  const avgRka = filteredData.length > 0
    ? Number((filteredData.reduce((acc, cur) => acc + cur.rka, 0) / filteredData.length).toFixed(1))
    : 100;
  const avgYoy = filteredData.length > 0
    ? Number((filteredData.reduce((acc, cur) => acc + cur.yoy, 0) / filteredData.length).toFixed(1))
    : 100;

  // Breakdown by Layanan
  const layananTotals: Record<string, number> = {};
  filteredData.forEach(d => {
    layananTotals[d.layanan] = (layananTotals[d.layanan] || 0) + (d.jumlahRp || 0);
  });
  const pieData = Object.entries(layananTotals).map(([name, value]) => ({
    name,
    value,
    color: COMMODITY_COLORS[name] || '#64748b'
  }));

  // Top 10 Cabang by Revenue
  const branchTotals: Record<string, { code: string; name: string; totalRp: number }> = {};
  filteredData.forEach(d => {
    if (!branchTotals[d.branchCode]) {
      branchTotals[d.branchCode] = { code: d.branchCode, name: d.branchName, totalRp: 0 };
    }
    branchTotals[d.branchCode].totalRp += (d.jumlahRp || 0);
  });
  const barData = Object.values(branchTotals)
    .sort((a, b) => b.totalRp - a.totalRp)
    .slice(0, 10)
    .map(b => ({
      name: b.name.length > 12 ? b.name.slice(0, 10) + '..' : b.name,
      fullName: `[${b.code}] ${b.name}`,
      totalRp: b.totalRp,
      revenueM: Number((b.totalRp / 1_000_000_000).toFixed(2)),
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Headline Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Pendapatan Opkom</span>
            <Anchor size={20} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalRevenueRp)}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Realisasi Komulatif YTD Sep 2026
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Rata-rata Capaian RKA</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {avgRka}%
          </div>
          <div style={{ fontSize: '12px', color: avgRka >= 100 ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
            {avgRka >= 100 ? 'Melampaui Target RKA Tahunan' : 'Di Bawah Target RKA'}
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Pertumbuhan YoY</span>
            <TrendingUp size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {avgYoy > 100 ? `+${(avgYoy - 100).toFixed(1)}%` : `${(avgYoy - 100).toFixed(1)}%`}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Dibandingkan periode sama 2025
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Komoditas Layanan</span>
            <Layers size={20} color="#a855f7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            5 Sektor
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Kapal, Petikemas, Barang, Pax, Rupa
          </div>
        </div>
      </div>

      {/* Visual Analytics Split: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        {/* Top 10 Branches Bar Chart */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Top 10 Cabang Pelabuhan - Pendapatan Opkom
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Data Resmi input_data.xlsx</span>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 15, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} angle={-25} textAnchor="end" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                  formatter={(val: any, name: any, item: any) => [formatRupiahFull(item.payload.totalRp), 'Pendapatan']}
                />
                <Bar dataKey="revenueM" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commodity Distribution Pie Chart */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Distribusi Pendapatan per Komoditas Layanan
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '260px' }}>
            <div style={{ flex: 1, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                    formatter={(val: any) => [formatRupiahFull(Number(val)), 'Pendapatan']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: d.color, flexShrink: 0 }} />
                  <span style={{ color: '#cbd5e1', flex: 1, whiteSpace: 'nowrap' }}>{d.name}</span>
                  <strong style={{ color: '#ffffff', fontSize: '11px', textAlign: 'right' }}>{formatRupiahFull(d.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Opkom Data Table */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Rekapitulasi Pendapatan Operasi & Komersial (Opkom)
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Menampilkan {filteredData.length} baris rekaman komoditas dari sheet opkom (My Drive regdashr@gmail.com)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onOpenManualInput && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#f59e0b',
                  borderColor: '#f59e0b',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                }}
                title="Input data manual operasi & komersial"
              >
                <PlusCircle size={13} />
                <span>+ Input Manual</span>
              </button>
            )}

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
              value={selectedLayanan}
              onChange={e => setSelectedLayanan(e.target.value)}
            >
              <option value="ALL">Semua Layanan</option>
              <option value="KAPAL">KAPAL</option>
              <option value="PETIKEMAS">PETIKEMAS</option>
              <option value="BARANG">BARANG</option>
              <option value="PENUMPANG">PENUMPANG</option>
              <option value="RUPA-RUPA">RUPA-RUPA</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Cabang Pelabuhan</th>
                <th>Sektor Layanan</th>
                <th style={{ textAlign: 'right' }}>Nilai Pendapatan (Rp)</th>
                <th style={{ textAlign: 'center' }}>Capaian RKA</th>
                <th style={{ textAlign: 'center' }}>Pertumbuhan YoY</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{r.branchCode}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.branchName}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${COMMODITY_COLORS[r.layanan] || '#38bdf8'}22`,
                        color: COMMODITY_COLORS[r.layanan] || '#38bdf8',
                        border: `1px solid ${COMMODITY_COLORS[r.layanan] || '#38bdf8'}55`,
                        fontWeight: 700
                      }}
                    >
                      {r.layanan}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#ffffff' }}>
                    {formatRupiahFull(r.jumlahRp)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.rka >= 100 ? 'badge-green' : r.rka >= 90 ? 'badge-yellow' : 'badge-red'}`}>
                      {r.rka}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.yoy >= 100 ? 'badge-green' : 'badge-yellow'}`}>
                      {r.yoy > 100 ? `+${(r.yoy - 100).toFixed(1)}%` : `${(r.yoy - 100).toFixed(1)}%`}
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
