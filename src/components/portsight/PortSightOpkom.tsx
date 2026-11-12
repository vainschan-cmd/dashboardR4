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
import { Anchor, Layers, TrendingUp, Search, PlusCircle } from 'lucide-react';
import { formatRupiahFull, formatPercentDelta } from '@/lib/formatters';
import { isBranchMatch } from '@/lib/constants';
import LoadingState from '@/components/ui/LoadingState';

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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OpkomItem[]>([]);
  const [selectedLayanan, setSelectedLayanan] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const abortController = new AbortController();
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules-data`, { signal: abortController.signal });
        const json = await res.json();
        if (json.success && json.opkom) {
          setData(json.opkom);
        }
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === 'AbortError')) {
          console.error(e);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => abortController.abort();
  }, [selectedTerminal]);

  // Filter based on selected terminal and commodity
  const filteredData = data.filter(d => {
    if (!isBranchMatch(selectedTerminal, d.branchCode, d.branchName)) return false;
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
    color: COMMODITY_COLORS[name] || 'var(--text-muted)'
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

  if (loading) {
    return <LoadingState label="Memuat data Operasi & Komersial…" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Headline Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Pendapatan Opkom</span>
            <Anchor size={20} color="var(--accent-blue-text)" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalRevenueRp)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Realisasi Komulatif YTD Sep 2026
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid var(--status-good-text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Rata-rata Capaian RKA</span>
            <TrendingUp size={20} color="var(--status-good-text)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {avgRka}%
          </div>
          <div style={{ fontSize: '12px', color: avgRka >= 100 ? 'var(--status-good-text)' : 'var(--status-alert-text)', fontWeight: 600 }}>
            {avgRka >= 100 ? 'Melampaui Target RKA Tahunan' : 'Di Bawah Target RKA'}
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid var(--status-alert-text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Pertumbuhan YoY</span>
            <TrendingUp size={20} color="var(--status-alert-text)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {formatPercentDelta(avgYoy, 1)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Dibandingkan periode sama 2025
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Komoditas Layanan</span>
            <Layers size={20} color="var(--series-purple-text)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            5 Sektor
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Data Resmi input_data.xlsx</span>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 15, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--navy-800)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-on-dark)' }}
                  formatter={(_val: unknown, _name: unknown, item: { payload?: { totalRp?: number } }) => [formatRupiahFull(item.payload?.totalRp || 0), 'Pendapatan']}
                />
                <Bar dataKey="revenueM" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
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
                    contentStyle={{ backgroundColor: 'var(--navy-800)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-on-dark)' }}
                    formatter={(val: unknown) => [formatRupiahFull(Number(val || 0)), 'Pendapatan']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: d.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap' }}>{d.name}</span>
                  <strong style={{ color: 'var(--text-main)', fontSize: '12px', textAlign: 'right' }}>{formatRupiahFull(d.value)}</strong>
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                  // #f59e0b under white type measured 2.15:1; the fill token is
                  // the darker orange that clears AA in both themes.
                  backgroundColor: 'var(--accent-orange-fill)',
                  borderColor: 'var(--accent-orange-fill)',
                  color: 'var(--text-on-accent)',
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.18)',
                }}
                title="Input data manual operasi & komersial"
              >
                <PlusCircle size={13} />
                <span>+ Input Manual</span>
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
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
          <table className="card-table dark-table">
            <thead>
              <tr>
                <th scope="col">Kode</th>
                <th scope="col">Cabang Pelabuhan</th>
                <th scope="col">Sektor Layanan</th>
                <th scope="col" style={{ textAlign: 'right' }}>Nilai Pendapatan (Rp)</th>
                <th scope="col" style={{ textAlign: 'center' }}>Capaian RKA</th>
                <th scope="col" style={{ textAlign: 'center' }}>Pertumbuhan YoY</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue-text)' }}>{r.branchCode}</td>
                  <td data-label="Cabang Pelabuhan" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.branchName}</td>
                  <td data-label="Sektor Layanan">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${COMMODITY_COLORS[r.layanan] || '#38bdf8'}22`,
                        color: 'var(--text-secondary)',
                        border: `1px solid ${COMMODITY_COLORS[r.layanan] || '#38bdf8'}55`,
                        fontWeight: 700
                      }}
                    >
                      {r.layanan}
                    </span>
                  </td>
                  <td data-label="Nilai Pendapatan (Rp)" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-title)' }}>
                    {formatRupiahFull(r.jumlahRp)}
                  </td>
                  <td data-label="Capaian RKA" style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.rka >= 100 ? 'badge-green' : r.rka >= 90 ? 'badge-yellow' : 'badge-red'}`}>
                      {r.rka}%
                    </span>
                  </td>
                  <td data-label="Pertumbuhan YoY" style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.yoy >= 100 ? 'badge-green' : 'badge-yellow'}`}>
                      {formatPercentDelta(r.yoy, 1)}
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
