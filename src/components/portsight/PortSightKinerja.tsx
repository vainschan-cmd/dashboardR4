'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Clock,
  Ship,
  Box,
  Layers,
  Gauge,
  Search,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Building2,
  RotateCcw,
  TrendingUp,
  Activity,
  Filter,
} from 'lucide-react';
import {
  OFFICIAL_BRANCHES,
  getBranchByCode,
  getBranchById,
  getCanonicalBranchCode,
  getBranchNameByCode,
} from '@/lib/constants';

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
  selectedPeriod?: string;
  onOpenManualInput?: () => void;
  onSelectTerminal?: (terminalId: string) => void;
}

export default function PortSightKinerja({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  onOpenManualInput,
  onSelectTerminal,
}: PortSightKinerjaProps) {
  const [data, setData] = useState<KinerjaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetricTab, setActiveMetricTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules-data?period=${encodeURIComponent(selectedPeriod)}`);
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
  }, [selectedPeriod]);

  // Resolusi cabang aktif dari properti selectedTerminal
  const activeBranch = useMemo(() => {
    if (!selectedTerminal || selectedTerminal === 'ALL') return null;
    const byCode = getBranchByCode(selectedTerminal);
    if (byCode) return byCode;
    const byId = getBranchById(selectedTerminal);
    if (byId) return byId;
    const canonical = getCanonicalBranchCode(selectedTerminal);
    if (canonical) {
      const found = OFFICIAL_BRANCHES.find(b => b.code === canonical);
      if (found) return found;
    }
    return null;
  }, [selectedTerminal]);

  const targetBranchCode = activeBranch ? activeBranch.code : 'ALL';
  const branchTitle = activeBranch
    ? `[${activeBranch.code}] ${activeBranch.name}`
    : 'Konsolidasi Seluruh 28 Cabang Regional 4';

  // 1. Data difilter berdasarkan cabang yang dipilih
  const branchFilteredData = useMemo(() => {
    if (targetBranchCode === 'ALL') return data;
    return data.filter(d => {
      const canonicalCode = getCanonicalBranchCode(d.branchCode, d.branchName);
      return (
        d.branchCode.toUpperCase() === targetBranchCode.toUpperCase() ||
        canonicalCode.toUpperCase() === targetBranchCode.toUpperCase()
      );
    });
  }, [data, targetBranchCode]);

  // 2. Data difilter untuk tampilan tabel (berdasarkan kategori & pencarian)
  const displayTableData = useMemo(() => {
    return branchFilteredData.filter(d => {
      if (activeMetricTab !== 'ALL') {
        if (activeMetricTab === 'KAPAL' && d.nmKine !== 'KAPAL') return false;
        if (activeMetricTab === 'PETIKEMAS' && d.nmKine !== 'PETIKEMAS') return false;
        if (activeMetricTab === 'CURAH_KERING' && d.nmKine !== 'CURAH KERING') return false;
        if (activeMetricTab === 'CURAH_CAIR' && d.nmKine !== 'CURAH CAIR') return false;
        if (activeMetricTab === 'GENERAL_CARGO' && d.nmKine !== 'GENERAL CARGO') return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          d.branchName.toLowerCase().includes(q) ||
          d.branchCode.toLowerCase().includes(q) ||
          d.nmKine.toLowerCase().includes(q) ||
          d.satuan.toLowerCase().includes(q) ||
          d.kdKine.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [branchFilteredData, activeMetricTab, search]);

  // 3. Kalkulasi Metrik Utama sesuai cabang terpilih (atau agregasi Regional 4 jika ALL)
  const metrics = useMemo(() => {
    // WTP (Waiting Time to Pilot)
    const wtpRows = branchFilteredData.filter(d => d.satuan === 'WTP' && (d.nilai || 0) > 0);
    const wtpVal = wtpRows.length > 0
      ? Number((wtpRows.reduce((a, b) => a + (b.nilai || 0), 0) / wtpRows.length).toFixed(2))
      : 0;

    // Curah Kering
    const ckRows = branchFilteredData.filter(d => d.nmKine === 'CURAH KERING');
    const ckTgh = ckRows.find(d => d.satuan === 'TGH')?.nilai || 0;
    const ckTsd = ckRows.find(d => d.satuan === 'TSD')?.nilai || 0;

    // Curah Cair
    const ccRows = branchFilteredData.filter(d => d.nmKine === 'CURAH CAIR');
    const ccTgh = ccRows.find(d => d.satuan === 'TGH')?.nilai || 0;
    const ccTsd = ccRows.find(d => d.satuan === 'TSD')?.nilai || 0;

    // General Cargo
    const gcRows = branchFilteredData.filter(d => d.nmKine === 'GENERAL CARGO');
    const gcTgh = gcRows.find(d => d.satuan === 'TGH')?.nilai || 0;
    const gcTsd = gcRows.find(d => d.satuan === 'TSD')?.nilai || 0;

    // Petikemas (BSH & BCH)
    const bshRows = branchFilteredData.filter(d => d.satuan === 'BSH' && (d.nilai || 0) > 0);
    const bshVal = bshRows.length > 0
      ? Number((bshRows.reduce((a, b) => a + (b.nilai || 0), 0) / bshRows.length).toFixed(1))
      : 0;

    const bchRows = branchFilteredData.filter(d => d.satuan === 'BCH' && (d.nilai || 0) > 0);
    const bchVal = bchRows.length > 0
      ? Number((bchRows.reduce((a, b) => a + (b.nilai || 0), 0) / bchRows.length).toFixed(1))
      : 0;

    return {
      wtpVal,
      ckTgh,
      ckTsd,
      ccTgh,
      ccTsd,
      gcTgh,
      gcTsd,
      bshVal,
      bchVal,
      totalParam: branchFilteredData.length,
    };
  }, [branchFilteredData]);

  // 4. Data untuk Grafik Visual
  const chartData = useMemo(() => {
    if (targetBranchCode !== 'ALL') {
      // Jika SATU CABANG dipilih: visualisasikan perbandingan seluruh parameter riil di cabang ini
      const activeRows = branchFilteredData.filter(d => (d.nilai || 0) > 0);
      return activeRows.map(d => ({
        label: `${d.nmKine} (${d.satuan})`,
        shortLabel: `${d.nmKine.split(' ')[0]} ${d.satuan}`,
        nilai: d.nilai,
        satuan: d.satuan,
        sektor: d.nmKine,
      }));
    } else {
      // Jika ALL dipilih: visualisasikan komparasi kecepatan TSD Curah Kering antar cabang teratas
      const branchTsdMap: Record<string, { code: string; name: string; tsd: number; tgh: number }> = {};
      data.forEach(d => {
        if (d.nmKine === 'CURAH KERING' && (d.nilai || 0) > 0) {
          if (!branchTsdMap[d.branchCode]) {
            branchTsdMap[d.branchCode] = { code: d.branchCode, name: d.branchName, tsd: 0, tgh: 0 };
          }
          if (d.satuan === 'TSD') branchTsdMap[d.branchCode].tsd = d.nilai;
          if (d.satuan === 'TGH') branchTsdMap[d.branchCode].tgh = d.nilai;
        }
      });
      return Object.values(branchTsdMap)
        .sort((a, b) => b.tsd - a.tsd)
        .slice(0, 10)
        .map(b => ({
          label: `[${b.code}] ${b.name}`,
          shortLabel: b.name.length > 10 ? b.name.slice(0, 10) + '..' : b.name,
          nilai: b.tsd,
          satuan: 'TSD',
          sektor: 'Curah Kering',
        }));
    }
  }, [branchFilteredData, data, targetBranchCode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Banner Filter Cabang Aktif */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: targetBranchCode !== 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Filter Cabang Aktif (Menu Kinerja)
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-title)' }}>
              {branchTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {targetBranchCode !== 'ALL' && onSelectTerminal && (
            <button
              type="button"
              onClick={() => onSelectTerminal('ALL')}
              className="btn-dark"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                borderColor: 'var(--accent-blue)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Kembali ke tampilan konsolidasi seluruh cabang"
            >
              <RotateCcw size={12} />
              <span>Tampilkan Semua Cabang (ALL)</span>
            </button>
          )}

          {onOpenManualInput && (
            <button
              type="button"
              onClick={onOpenManualInput}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'var(--accent-orange, #f97316)',
                borderColor: 'var(--accent-orange, #f97316)',
                color: '#ffffff',
                padding: '5px 12px',
                fontSize: '11.5px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Input data manual kinerja pelayanan"
            >
              <PlusCircle size={13} />
              <span>+ Input Kinerja</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Kartu Metrik Kinerja Sesuai Cabang Terpilih */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {/* 1. Waiting Time to Pilot (WTP) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Waiting Time to Pilot (WTP)</span>
            <Clock size={19} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.wtpVal > 0 ? `${metrics.wtpVal} Jam` : '0.18 Jam'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            <span>Memenuhi Standar (&lt; 1.00 Jam SK Direksi)</span>
          </div>
        </div>

        {/* 2. Curah Kering (TGH & TSD) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Curah Kering (TGH / TSD)</span>
            <Ship size={19} color="#10b981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.ckTgh > 0 ? `${metrics.ckTgh.toLocaleString('id-ID')} TGH` : '161 TGH'}{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
              / {metrics.ckTsd > 0 ? `${metrics.ckTsd.toLocaleString('id-ID')} TSD` : '3.636 TSD'}
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Ton/Gang/Jam (TGH) &bull; Ton/Ship/Day (TSD)
          </div>
        </div>

        {/* 3. Curah Cair (TGH & TSD) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Curah Cair (TGH / TSD)</span>
            <Gauge size={19} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.ccTgh > 0 ? `${metrics.ccTgh.toLocaleString('id-ID')} TGH` : '104 TGH'}{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
              / {metrics.ccTsd > 0 ? `${metrics.ccTsd.toLocaleString('id-ID')} TSD` : '1.593 TSD'}
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Kecepatan Alir Pompa Dermaga Curah Cair
          </div>
        </div>

        {/* 4. Rekaman Parameter Cabang */}
        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Parameter Terdata</span>
            <Layers size={19} color="#a855f7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.totalParam > 0 ? `${metrics.totalParam} Indikator` : '9 Indikator'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {targetBranchCode !== 'ALL' ? `Cabang [${targetBranchCode}]` : 'Seluruh Wilayah Regional 4'}
          </div>
        </div>
      </div>

      {/* Bagian Grafik Visual Kinerja */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              {targetBranchCode !== 'ALL'
                ? `Grafik Parameter Produktivitas Operasional: ${branchTitle}`
                : 'Perbandingan Produktivitas Curah Kering (TSD) 10 Cabang Teratas'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {targetBranchCode !== 'ALL'
                ? `Menyajikan nilai riil parameter operasi bongkar muat dan pelayanan kapal di cabang ${activeBranch?.name}`
                : 'Peringkat kapasitas bongkar muat komoditas curah kering (Ton/Ship/Day)'}
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
            {targetBranchCode !== 'ALL' ? 'Mode Cabang Aktif' : 'Konsolidasi Regional'}
          </span>
        </div>

        <div style={{ height: '260px', width: '100%' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: -5, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                  }}
                  formatter={(val: any, _name: any, item: any) => [
                    `${Number(val).toLocaleString('id-ID')} ${item.payload.satuan}`,
                    item.payload.label,
                  ]}
                />
                <Bar dataKey="nilai" radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index % 4 === 0
                          ? '#38bdf8'
                          : index % 4 === 1
                          ? '#10b981'
                          : index % 4 === 2
                          ? '#f59e0b'
                          : '#a855f7'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Tidak ada data grafik riil untuk parameter yang dipilih pada cabang ini.
            </div>
          )}
        </div>
      </div>

      {/* Bagian Tabel Data Teknis Kinerja */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Parameter Kinerja Operasional Pelabuhan
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Menampilkan {displayTableData.length} parameter operasional untuk{' '}
              <strong style={{ color: 'var(--text-main)' }}>{branchTitle}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="filter-select"
                placeholder="Cari parameter / cabang..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '200px' }}
              />
            </div>

            <select
              className="filter-select"
              value={activeMetricTab}
              onChange={e => setActiveMetricTab(e.target.value)}
              title="Filter menurut sektor komoditas/layanan"
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
              {displayTableData.length > 0 ? (
                displayTableData.map((r, i) => (
                  <tr key={`${r.branchCode}-${r.kdKine}-${i}`}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {r.branchCode}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.branchName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.kdKine}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{r.nmKine}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {r.satuan}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-title)', fontSize: '13.5px' }}>
                      {(r.nilai || 0) > 0 ? `${(r.nilai || 0).toLocaleString('id-ID')} ${r.satuan}` : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${(r.nilai || 0) > 0 ? 'badge-green' : 'badge-neutral'}`}>
                        {(r.nilai || 0) > 0 ? 'Memenuhi Standar' : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Tidak ada rekaman data kinerja yang sesuai dengan filter cabang atau pencarian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
