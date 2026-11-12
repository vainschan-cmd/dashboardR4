'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { DollarSign, TrendingUp, Search, Layers, PlusCircle } from 'lucide-react';
import { formatRupiahFull, formatPercentDelta } from '@/lib/formatters';
import { isBranchMatch } from '@/lib/constants';
import LoadingState from '@/components/ui/LoadingState';

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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const abortController = new AbortController();
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/modules-data', { signal: abortController.signal });
        const json = await res.json();
        if (json.success && json.finansial) {
          setData(json.finansial);
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

  const filteredData = data.filter(d => {
    if (!isBranchMatch(selectedTerminal, d.branchCode, d.branchName)) return false;
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

  // Comparison metrics stay null when the dataset has no RKA/YoY value.
  const avgRevRka = revRows.length > 0
    ? Number((revRows.reduce((a, b) => a + b.rka, 0) / revRows.length).toFixed(1))
    : null;

  const avgRevYoy = revRows.length > 0
    ? Number((revRows.reduce((a, b) => a + b.yoy, 0) / revRows.length).toFixed(1))
    : null;

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

  if (loading) {
    return <LoadingState label="Memuat data Keuangan…" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Pendapatan Usaha Konsolidasi</span>
            <DollarSign size={20} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalRevRp)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--status-good-text)', fontWeight: 600 }}>
            {avgRevRka === null
              ? 'RKA belum tersedia'
              : `${avgRevRka}% dari RKA YTD`}
            {avgRevYoy !== null &&
              ` (${formatPercentDelta(avgRevYoy, 1)} YoY)`}
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Beban Usaha Konsolidasi</span>
            <TrendingUp size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalCostRp)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Beban operasional & non-operasional cabang
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Laba Usaha (Operating Profit)</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalOpRp)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--status-good-text)', fontWeight: 600 }}>
            Margin Operasi Prima
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Laba Bersih Konsolidasi</span>
            <Layers size={20} color="#a855f7" />
          </div>
          <div style={{ fontSize: 'clamp(18px, 1.8vw, 24px)', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px', wordBreak: 'break-word', letterSpacing: '-0.3px' }}>
            {formatRupiahFull(totalNetRp)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Setelah pajak & pos konsolidasi
          </div>
        </div>
      </div>

      {/* Top Split: Pendapatan Bulanan vs Top Cabang Bar Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div className="dark-card-title" style={{ margin: 0 }}>Tren Pendapatan Bulanan (Miliar Rp)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Perbandingan Realisasi 2026 vs RKAP vs Realisasi 2025
              </div>
            </div>
          </div>

          {/* No monthly time-series is exposed by /api/modules-data yet.
              Avoid rendering a synthetic chart that looks like real data. */}
          <div
            style={{
              height: '220px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              textAlign: 'center',
              padding: '16px',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Tren bulanan belum tersedia</span>
            <span>Data historis per bulan belum dimuat oleh API. Grafik akan tampil setelah seri waktu tersedia.</span>
          </div>
        </div>

        {/* Top Cabang Bar Chart */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>Top Cabang - Pendapatan Konsolidasi</div>
            <span style={{ fontSize: '12px', color: 'var(--accent-blue-text)', fontWeight: 700 }}>Sheet finansial</span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBranches.slice(0, 6)} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--navy-800)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-on-dark)' }}
                  formatter={(_val: unknown, _name: unknown, item: { payload?: { revenueRp?: number } }) => [formatRupiahFull(item.payload?.revenueRp || 0), 'Pendapatan']}
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                  backgroundColor: 'var(--accent-blue)',
                  borderColor: 'var(--accent-blue)',
                  color: 'var(--text-on-accent)',
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
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
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
          <table className="card-table dark-table">
            <thead>
              <tr>
                <th scope="col">Kode</th>
                <th scope="col">Cabang Pelabuhan</th>
                <th scope="col">Pos Rekening</th>
                <th scope="col" style={{ textAlign: 'right' }}>Nilai Cabang (Rp)</th>
                <th scope="col" style={{ textAlign: 'right' }}>Konsolidasi (Rp)</th>
                <th scope="col" style={{ textAlign: 'right' }}>PMT / PTP (Rp)</th>
                <th scope="col" style={{ textAlign: 'center' }}>% RKA</th>
                <th scope="col" style={{ textAlign: 'center' }}>% YoY</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue-text)' }}>{r.branchCode}</td>
                  <td data-label="Cabang Pelabuhan" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{r.branchName}</td>
                  <td data-label="Pos Rekening" style={{ fontWeight: 600, color: r.rekening.includes('Beban') ? 'var(--status-danger-text)' : r.rekening.includes('Laba') ? 'var(--status-good-text)' : 'var(--accent-blue-text)' }}>
                    {r.rekening}
                  </td>
                  <td data-label="Nilai Cabang (Rp)" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {formatRupiahFull(r.cabangRp)}
                  </td>
                  <td data-label="Konsolidasi (Rp)" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-title)' }}>
                    {formatRupiahFull(r.konsolidasiRp)}
                  </td>
                  <td data-label="PMT / PTP (Rp)" style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {formatRupiahFull(r.pmtRp + r.ptpRp)}
                  </td>
                  <td data-label="% RKA" style={{ textAlign: 'center' }}>
                    <span className={`badge ${r.rka >= 100 ? 'badge-green' : r.rka >= 90 ? 'badge-yellow' : 'badge-red'}`}>
                      {r.rka}%
                    </span>
                  </td>
                  <td data-label="% YoY" style={{ textAlign: 'center' }}>
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
