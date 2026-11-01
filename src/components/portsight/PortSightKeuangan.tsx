'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { DollarSign, TrendingUp, Search, Building2, Layers, PlusCircle } from 'lucide-react';
import { formatRupiahFull } from '@/lib/formatters';

interface FinItem {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  rekening: string;
  cabangRp: number;
  cabangM: number;
  pmtRp: number;
  ptpRp: number;
  pslRp: number;
  pjmRp: number;
  eliminasiRp: number;
  konsolidasiRp: number;
  konsolidasiM: number;
  yoy: number;
  rka: number;
}

interface PortSightKeuanganProps {
  selectedTerminal?: string;
  onOpenManualInput?: () => void;
}

export default function PortSightKeuangan({ selectedTerminal = 'ALL', onOpenManualInput }: PortSightKeuanganProps) {
  const [data, setData] = useState<FinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/modules-data');
        const json = await res.json();
        if (json.success && json.finansial) {
          setData(json.finansial);
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
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!d.branchName.toLowerCase().includes(q) && !d.branchCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Aggregates for Pendapatan, Beban, Laba Usaha, Laba Bersih
  const revRows = filteredData.filter(d => d.rekening.toLowerCase().includes('pendapatan'));
  const costRows = filteredData.filter(d => d.rekening.toLowerCase().includes('beban'));
  const opRows = filteredData.filter(d => d.rekening.toLowerCase() === 'laba usaha');
  const netRows = filteredData.filter(d => d.rekening.toLowerCase().includes('bersih'));

  const totalRevRp = revRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);
  const rawCostRp = costRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);
  const totalCostRp = rawCostRp === 0 ? 0 : (rawCostRp < 0 ? rawCostRp : -rawCostRp);
  const totalOpRp = opRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);
  const totalNetRp = netRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);
  const totalRevM = revRows.reduce((a, b) => a + b.konsolidasiM, 0);

  const avgRevRka = revRows.length > 0
    ? Number((revRows.reduce((a, b) => a + b.rka, 0) / revRows.length).toFixed(1))
    : 101.8;

  const avgRevYoy = revRows.length > 0
    ? Number((revRows.reduce((a, b) => a + b.yoy, 0) / revRows.length).toFixed(1))
    : 107.6;

  // Donut data
  const donutData = [
    { name: 'Tercapai', value: Math.min(Math.round(avgRevRka), 100), color: '#38bdf8' },
    { name: 'Sisa Target', value: Math.max(100 - Math.min(Math.round(avgRevRka), 100), 0), color: '#1e3557' },
  ];

  // Top 10 Branches by Pendapatan
  const topBranches = revRows
    .map(r => ({
      code: r.branchCode,
      name: r.branchName.length > 12 ? r.branchName.slice(0, 10) + '..' : r.branchName,
      fullName: `[${r.branchCode}] ${r.branchName}`,
      revenueM: r.konsolidasiM,
      revenueRp: r.konsolidasiRp,
      rka: r.rka,
      yoy: r.yoy,
    }))
    .sort((a, b) => b.revenueRp - a.revenueRp)
    .slice(0, 10);

  const monthlyTrend = [
    { month: 'Jan', y2025: 200, rkap: 213, y2026: 215 },
    { month: 'Feb', y2025: 195, rkap: 211, y2026: 210 },
    { month: 'Mar', y2025: 210, rkap: 221, y2026: 224 },
    { month: 'Apr', y2025: 208, rkap: 219, y2026: 220 },
    { month: 'Mei', y2025: 214, rkap: 226, y2026: 231 },
    { month: 'Jun', y2025: 212, rkap: 225, y2026: 229 },
    { month: 'Jul', y2025: 218, rkap: 228, y2026: 234 },
    { month: 'Agu', y2025: 222, rkap: 230, y2026: 238 },
    { month: 'Sep', y2025: 223, rkap: 232, y2026: totalRevM > 0 ? Number((totalRevM / 9).toFixed(1)) : 241.5 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Pendapatan Usaha Konsolidasi</span>
            <DollarSign size={20} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalRevRp)}
          </div>
          <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
            {avgRevRka}% dari RKA YTD ({avgRevYoy > 100 ? `+${(avgRevYoy - 100).toFixed(1)}% YoY` : `${avgRevYoy}% YoY`})
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Beban Usaha Konsolidasi</span>
            <TrendingUp size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalCostRp)}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Beban operasional & non-operasional cabang
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Laba Usaha (Operating Profit)</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalOpRp)}
          </div>
          <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
            Margin Operasi Prima
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Laba Bersih Konsolidasi</span>
            <Layers size={20} color="#a855f7" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalNetRp)}
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Setelah pajak & pos konsolidasi
          </div>
        </div>
      </div>

      {/* Top Split: Pendapatan Bulanan Chart vs Top Cabang Bar Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div className="dark-card-title" style={{ margin: 0 }}>Tren Pendapatan Bulanan (Miliar Rp)</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Perbandingan Realisasi 2026 vs RKAP vs Realisasi 2025</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 2, backgroundColor: '#64748b' }} /> 2025
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 2, backgroundColor: '#f97316' }} /> RKAP 2026
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 2, backgroundColor: '#38bdf8' }} /> 2026
              </span>
            </div>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }} />
                <Line type="monotone" dataKey="y2025" stroke="#64748b" strokeDasharray="3 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="rkap" stroke="#f97316" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="y2026" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Cabang Bar Chart */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>Top Cabang - Pendapatan Konsolidasi</div>
            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>Sheet finansial</span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBranches.slice(0, 6)} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                  formatter={(val: any, name: any, item: any) => [formatRupiahFull(item.payload.revenueRp), 'Pendapatan']}
                />
                <Bar dataKey="revenueM" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Financial Records Table */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Rekapitulasi Finansial Cabang Pelabuhan
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Menampilkan {filteredData.length} baris finansial (Pendapatan, Beban, Laba) dari sheet finansial (regdashr@gmail.com)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onOpenManualInput && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                }}
                title="Input data manual finansial"
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
                placeholder="Cari cabang / pos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '220px' }}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Cabang Pelabuhan</th>
                <th>Pos Rekening</th>
                <th style={{ textAlign: 'right' }}>Nilai Cabang (Rp)</th>
                <th style={{ textAlign: 'right' }}>Konsolidasi (Rp)</th>
                <th style={{ textAlign: 'right' }}>PMT / PTP (Rp)</th>
                <th style={{ textAlign: 'center' }}>% RKA</th>
                <th style={{ textAlign: 'center' }}>% YoY</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{r.branchCode}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.branchName}</td>
                  <td style={{ fontWeight: 600, color: r.rekening.includes('Beban') ? '#ef4444' : r.rekening.includes('Laba') ? '#10b981' : '#38bdf8' }}>
                    {r.rekening}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#cbd5e1' }}>
                    {formatRupiahFull(r.cabangRp)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#ffffff' }}>
                    {formatRupiahFull(r.konsolidasiRp)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '12px' }}>
                    {formatRupiahFull(r.pmtRp + r.ptpRp)}
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
