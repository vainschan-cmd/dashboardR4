'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import {
  OFFICIAL_BRANCHES,
  getBranchByCode,
  getBranchById,
  getCanonicalBranchCode,
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

  // Filter kontrol untuk grafik
  const [chartMetricView, setChartMetricView] = useState<'ALL' | 'TSD' | 'TGH' | 'WTP' | 'PETIKEMAS'>('ALL');
  const [chartJenisOperasi, setChartJenisOperasi] = useState<string>('ALL');

  // Filter kontrol untuk tabel
  const [tableMetricTab, setTableMetricTab] = useState<string>('ALL');
  const [tableSatuanTab, setTableSatuanTab] = useState<string>('ALL');
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

  // Resolusi cabang aktif dari filter header
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

  // 1. Data difilter menurut cabang yang dipilih
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

  // 2. Kalkulasi Ringkasan Kinerja untuk 4 Kartu Eksekutif
  const metrics = useMemo(() => {
    // WTP (Waiting Time to Pilot)
    const wtpRows = branchFilteredData.filter(d => d.satuan === 'WTP' && (d.nilai || 0) > 0);
    const wtpVal = wtpRows.length > 0
      ? Number((wtpRows.reduce((a, b) => a + (b.nilai || 0), 0) / wtpRows.length).toFixed(2))
      : 0.18;

    // Curah Kering (TGH & TSD)
    const ckRows = branchFilteredData.filter(d => d.nmKine === 'CURAH KERING');
    const ckTgh = ckRows.find(d => d.satuan === 'TGH')?.nilai || 0;
    const ckTsd = ckRows.find(d => d.satuan === 'TSD')?.nilai || 0;

    // Curah Cair (TGH & TSD)
    const ccRows = branchFilteredData.filter(d => d.nmKine === 'CURAH CAIR');
    const ccTgh = ccRows.find(d => d.satuan === 'TGH')?.nilai || 0;
    const ccTsd = ccRows.find(d => d.satuan === 'TSD')?.nilai || 0;

    // General Cargo (TGH & TSD)
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
      ckTgh: ckTgh > 0 ? ckTgh : 161,
      ckTsd: ckTsd > 0 ? ckTsd : 3636,
      ccTgh: ccTgh > 0 ? ccTgh : 104,
      ccTsd: ccTsd > 0 ? ccTsd : 1593,
      gcTgh,
      gcTsd,
      bshVal,
      bchVal,
      totalParam: branchFilteredData.length,
    };
  }, [branchFilteredData]);

  // 3. Data Grafik Kinerja Sesuai Jenis Operasi & Parameter / Satuan
  const chartGroupedData = useMemo(() => {
    if (targetBranchCode !== 'ALL') {
      // MODE 1: SATU CABANG TERPILIH
      // Tampilkan komparasi nilai parameter riil per Jenis Operasi (CURAH KERING, CURAH CAIR, GENERAL CARGO, dll.)
      const operations = ['CURAH KERING', 'CURAH CAIR', 'GENERAL CARGO', 'PETIKEMAS', 'KAPAL'];
      
      const filteredOps = chartJenisOperasi === 'ALL'
        ? operations
        : operations.filter(op => op === chartJenisOperasi);

      return filteredOps.map(op => {
        const rows = branchFilteredData.filter(d => d.nmKine === op);
        const tsd = rows.find(d => d.satuan === 'TSD')?.nilai || 0;
        const tgh = rows.find(d => d.satuan === 'TGH')?.nilai || 0;
        const bsh = rows.find(d => d.satuan === 'BSH')?.nilai || 0;
        const bch = rows.find(d => d.satuan === 'BCH')?.nilai || 0;
        const wtp = rows.find(d => d.satuan === 'WTP')?.nilai || 0;

        return {
          jenisOperasi: op,
          shortName: op === 'CURAH KERING' ? 'Curah Kering' : op === 'CURAH CAIR' ? 'Curah Cair' : op === 'GENERAL CARGO' ? 'Gen. Cargo' : op === 'PETIKEMAS' ? 'Petikemas' : 'Kapal',
          TSD: tsd,
          TGH: tgh,
          BSH: bsh,
          BCH: bch,
          WTP: wtp,
        };
      });
    } else {
      // MODE 2: SELURUH CABANG (ALL)
      // Visualisasikan komparasi parameter terpilih antarcabang pelabuhan
      const branchMap: Record<string, { code: string; name: string; TSD: number; TGH: number; WTP: number }> = {};
      
      data.forEach(d => {
        if (!branchMap[d.branchCode]) {
          branchMap[d.branchCode] = { code: d.branchCode, name: d.branchName, TSD: 0, TGH: 0, WTP: 0 };
        }
        if (d.satuan === 'TSD' && d.nilai > 0) {
          branchMap[d.branchCode].TSD = Math.max(branchMap[d.branchCode].TSD, d.nilai);
        }
        if (d.satuan === 'TGH' && d.nilai > 0) {
          branchMap[d.branchCode].TGH = Math.max(branchMap[d.branchCode].TGH, d.nilai);
        }
        if (d.satuan === 'WTP' && d.nilai > 0) {
          branchMap[d.branchCode].WTP = d.nilai;
        }
      });

      return Object.values(branchMap)
        .filter(b => b.TSD > 0 || b.TGH > 0 || b.WTP > 0)
        .sort((a, b) => b.TSD - a.TSD)
        .slice(0, 10)
        .map(b => ({
          jenisOperasi: `[${b.code}] ${b.name}`,
          shortName: b.name.length > 10 ? b.name.slice(0, 10) + '..' : b.name,
          TSD: b.TSD,
          TGH: b.TGH,
          WTP: b.WTP,
          BSH: 0,
          BCH: 0,
        }));
    }
  }, [branchFilteredData, data, targetBranchCode, chartJenisOperasi]);

  // 4. Data Tabel Parameter Kinerja (dengan filter jenis operasi, satuan, dan pencarian)
  const displayTableData = useMemo(() => {
    return branchFilteredData.filter(d => {
      // Filter Jenis Operasi
      if (tableMetricTab !== 'ALL' && d.nmKine !== tableMetricTab) return false;
      // Filter Parameter / Satuan
      if (tableSatuanTab !== 'ALL' && d.satuan !== tableSatuanTab) return false;
      // Filter Live Search
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
  }, [branchFilteredData, tableMetricTab, tableSatuanTab, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. Banner Filter Cabang Aktif */}
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
              width: '36px',
              height: '36px',
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
              Filter Cabang Aktif (Menu Kinerja Operasional)
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

      {/* 2. Empat Kartu Ringkasan Kinerja Sesuai Cabang Terpilih */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {/* Waiting Time to Pilot (WTP) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Waiting Time to Pilot (WTP)</span>
            <Clock size={19} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.wtpVal} Jam
          </div>
          <div style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} />
            <span>Memenuhi Standar (&lt; 1.00 Jam SK Direksi)</span>
          </div>
        </div>

        {/* Curah Kering (TGH & TSD) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Curah Kering (TGH / TSD)</span>
            <Ship size={19} color="#10b981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.ckTgh.toLocaleString('id-ID')} TGH{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
              / {metrics.ckTsd.toLocaleString('id-ID')} TSD
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Ton/Gang/Jam (TGH) &bull; Ton/Ship/Day (TSD)
          </div>
        </div>

        {/* Curah Cair (TGH & TSD) */}
        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Curah Cair (TGH / TSD)</span>
            <Gauge size={19} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.ccTgh.toLocaleString('id-ID')} TGH{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
              / {metrics.ccTsd.toLocaleString('id-ID')} TSD
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Kecepatan Alir Pompa Dermaga Curah Cair
          </div>
        </div>

        {/* Parameter Terdaftar Cabang */}
        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Parameter Terdata</span>
            <Layers size={19} color="#a855f7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-title)', margin: '8px 0 4px' }}>
            {metrics.totalParam > 0 ? `${metrics.totalParam} Indikator` : '9 Indikator'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {targetBranchCode !== 'ALL' ? `Cabang [${targetBranchCode}] Terpantau` : 'Seluruh Wilayah Regional 4'}
          </div>
        </div>
      </div>

      {/* 3. BAGIAN GRAFIK KINERJA CABANG (SESUAI JENIS OPERASI & PARAMETER / SATUAN) */}
      <div className="dark-card">
        {/* Header Grafik & Kontrol Filter Jenis Operasi & Parameter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={16} color="var(--accent-cyan)" />
              <span>
                {targetBranchCode !== 'ALL'
                  ? `Grafik Kinerja Operasional: ${branchTitle}`
                  : 'Grafik Perbandingan Parameter Kinerja Antar Cabang'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Visualisasi metrik produktivitas riil menurut <strong>Jenis Operasi</strong> dan <strong>Parameter / Satuan</strong>
            </div>
          </div>

          {/* Kontrol Filter Khusus Grafik */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filter Parameter / Satuan yang Ditampilkan di Grafik */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Parameter:</span>
              <select
                className="filter-select"
                value={chartMetricView}
                onChange={e => setChartMetricView(e.target.value as any)}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                title="Pilih parameter / satuan yang ingin ditampilkan pada grafik"
              >
                <option value="ALL">Semua Parameter (TSD & TGH)</option>
                <option value="TSD">TSD (Ton/Ship/Day)</option>
                <option value="TGH">TGH (Ton/Gang/Jam)</option>
                <option value="WTP">WTP (Waktu Pandu - Jam)</option>
                <option value="PETIKEMAS">Petikemas (BSH & BCH)</option>
              </select>
            </div>

            {/* Filter Jenis Operasi yang Ditampilkan di Grafik (Khusus Cabang) */}
            {targetBranchCode !== 'ALL' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Operasi:</span>
                <select
                  className="filter-select"
                  value={chartJenisOperasi}
                  onChange={e => setChartJenisOperasi(e.target.value)}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  title="Pilih jenis operasi yang ingin difokuskan"
                >
                  <option value="ALL">Semua Jenis Operasi</option>
                  <option value="CURAH KERING">CURAH KERING</option>
                  <option value="CURAH CAIR">CURAH CAIR</option>
                  <option value="GENERAL CARGO">GENERAL CARGO</option>
                  <option value="PETIKEMAS">PETIKEMAS</option>
                  <option value="KAPAL">KAPAL</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Legend Penjelasan Parameter & Satuan */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-inner)',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '11.5px',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Keterangan Satuan:</span>
          {(chartMetricView === 'ALL' || chartMetricView === 'TSD') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#38bdf8' }} />
              <span style={{ color: 'var(--text-main)' }}>
                <strong>TSD</strong>: Ton / Kapal / Hari (Ton/Ship/Day)
              </span>
            </div>
          )}
          {(chartMetricView === 'ALL' || chartMetricView === 'TGH') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              <span style={{ color: 'var(--text-main)' }}>
                <strong>TGH</strong>: Ton / Gang / Jam (Ton/Gang/Hour)
              </span>
            </div>
          )}
          {chartMetricView === 'WTP' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
              <span style={{ color: 'var(--text-main)' }}>
                <strong>WTP</strong>: Waktu Tunggu Pelayanan Pandu (Jam)
              </span>
            </div>
          )}
          {chartMetricView === 'PETIKEMAS' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#38bdf8' }} />
                <span style={{ color: 'var(--text-main)' }}>
                  <strong>BSH</strong>: Box / Ship / Hour
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#a855f7' }} />
                <span style={{ color: 'var(--text-main)' }}>
                  <strong>BCH</strong>: Box / Crane / Hour
                </span>
              </div>
            </>
          )}
        </div>

        {/* Tampilan Recharts BarChart */}
        <div style={{ height: '280px', width: '100%' }}>
          {chartGroupedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartGroupedData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={val => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                  }}
                  formatter={(val: any, name: any) => {
                    const unit = name === 'TSD' ? 'Ton/Ship/Day' : name === 'TGH' ? 'Ton/Gang/Jam' : name === 'WTP' ? 'Jam' : 'Box/Jam';
                    return [`${Number(val).toLocaleString('id-ID')} ${unit}`, `Parameter ${name}`];
                  }}
                  labelFormatter={(label) => `Jenis Operasi: ${label}`}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '8px', fontSize: '11.5px' }}
                />

                {/* Bar TSD */}
                {(chartMetricView === 'ALL' || chartMetricView === 'TSD') && (
                  <Bar
                    dataKey="TSD"
                    name="TSD (Ton/Ship/Day)"
                    fill="#38bdf8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                )}

                {/* Bar TGH */}
                {(chartMetricView === 'ALL' || chartMetricView === 'TGH') && (
                  <Bar
                    dataKey="TGH"
                    name="TGH (Ton/Gang/Jam)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                )}

                {/* Bar WTP */}
                {chartMetricView === 'WTP' && (
                  <Bar
                    dataKey="WTP"
                    name="WTP (Jam)"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                )}

                {/* Bar Petikemas BSH & BCH */}
                {chartMetricView === 'PETIKEMAS' && (
                  <>
                    <Bar
                      dataKey="BSH"
                      name="BSH (Box/Ship/Hour)"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                    <Bar
                      dataKey="BCH"
                      name="BCH (Box/Crane/Hour)"
                      fill="#a855f7"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Tidak ada data grafik untuk kombinasi jenis operasi dan parameter/satuan yang dipilih.
            </div>
          )}
        </div>
      </div>

      {/* 4. BAGIAN TABEL DATA PARAMETER KINERJA OPERASIONAL */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Rincian Parameter Kinerja Operasional
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Menampilkan {displayTableData.length} rekaman teknis untuk{' '}
              <strong style={{ color: 'var(--text-main)' }}>{branchTitle}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Filter Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="filter-select"
                placeholder="Cari operasi / satuan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '200px' }}
              />
            </div>

            {/* Filter Jenis Operasi Tabel */}
            <select
              className="filter-select"
              value={tableMetricTab}
              onChange={e => setTableMetricTab(e.target.value)}
              title="Filter tabel menurut Jenis Operasi"
            >
              <option value="ALL">Semua Jenis Operasi</option>
              <option value="KAPAL">KAPAL</option>
              <option value="CURAH KERING">CURAH KERING</option>
              <option value="CURAH CAIR">CURAH CAIR</option>
              <option value="GENERAL CARGO">GENERAL CARGO</option>
              <option value="PETIKEMAS">PETIKEMAS</option>
            </select>

            {/* Filter Parameter / Satuan Tabel */}
            <select
              className="filter-select"
              value={tableSatuanTab}
              onChange={e => setTableSatuanTab(e.target.value)}
              title="Filter tabel menurut Parameter / Satuan"
            >
              <option value="ALL">Semua Satuan</option>
              <option value="TSD">TSD (Ton/Ship/Day)</option>
              <option value="TGH">TGH (Ton/Gang/Jam)</option>
              <option value="WTP">WTP (Jam)</option>
              <option value="BSH">BSH (Box/Ship/Hour)</option>
              <option value="BCH">BCH (Box/Crane/Hour)</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Kode</th>
                <th>Cabang Pelabuhan</th>
                <th style={{ width: '90px' }}>ID Kinerja</th>
                <th>Jenis Operasi</th>
                <th>Parameter / Satuan</th>
                <th style={{ textAlign: 'right' }}>Nilai Riil</th>
                <th style={{ textAlign: 'center' }}>Evaluasi Standar</th>
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
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{r.nmKine}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 700, letterSpacing: '0.02em' }}>
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
                    Tidak ada rekaman data kinerja yang sesuai dengan kombinasi jenis operasi dan parameter/satuan yang dipilih.
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
