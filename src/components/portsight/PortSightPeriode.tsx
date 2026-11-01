'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Building2,
  Filter,
  RefreshCw,
  Download,
  PlusCircle,
  Search,
  DollarSign,
  Boxes,
  TrendingUp,
  Activity,
  Wrench,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import { formatRupiahFull } from '@/lib/formatters';

interface FinRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  rekening: string;
  cabangRp: number;
  pmtRp: number;
  ptpRp: number;
  pslRp: number;
  pjmRp: number;
  eliminasiRp: number;
  konsolidasiRp: number;
  yoy: number;
  rka: number;
}

interface OpkomRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  layanan: string;
  satuan: string;
  jumlah: number;
  yoy: number;
  rka: number;
}

interface KinerjaRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  kdKine: string;
  nmKine: string;
  satuan: string;
  nilai: number;
}

interface UtilisasiRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  kdJenderm: string;
  dermaga: string;
  bor: number;
  yor: number;
  sor: number;
}

interface PeralatanRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  kdAlat: string;
  nmAlat: string;
  singkatan: string;
  jnsAlat: string;
  jumlah: number;
  utilisasi: number;
}

interface FasilitasRecord {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  nmPasfel: string;
  jnsFaspel: string;
  satuan: string;
  panjang: number;
  lebar: number;
  mLws: number;
  nilai: number;
  ket: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface PortSightPeriodeProps {
  selectedTerminal?: string;
  selectedPeriod?: string;
  onOpenManualInput?: (module?: string) => void;
}

export default function PortSightPeriode({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  onOpenManualInput,
}: PortSightPeriodeProps) {
  // Filter states
  const [filterMode, setFilterMode] = useState<'preset' | 'month_range' | 'date_range' | 'single'>('preset');
  const [presetPeriod, setPresetPeriod] = useState<string>(selectedPeriod || 'YTD Sep 2026');
  
  // Single Month/Year
  const [singleMonth, setSingleMonth] = useState<number>(9);
  const [singleYear, setSingleYear] = useState<number>(2026);

  // Month Range
  const [startMonth, setStartMonth] = useState<number>(1);
  const [startYear, setStartYear] = useState<number>(2026);
  const [endMonth, setEndMonth] = useState<number>(9);
  const [endYear, setEndYear] = useState<number>(2026);

  // Date Range (HTML5 Date format: YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');

  // Branch Filter
  const [branchFilter, setBranchFilter] = useState<string>(selectedTerminal || 'ALL');

  // Active module tab
  const [activeModule, setActiveModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loaded data
  const [loading, setLoading] = useState<boolean>(true);
  const [finansial, setFinansial] = useState<FinRecord[]>([]);
  const [opkom, setOpkom] = useState<OpkomRecord[]>([]);
  const [kinerja, setKinerja] = useState<KinerjaRecord[]>([]);
  const [utilisasi, setUtilisasi] = useState<UtilisasiRecord[]>([]);
  const [peralatan, setPeralatan] = useState<PeralatanRecord[]>([]);
  const [fasilitas, setFasilitas] = useState<FasilitasRecord[]>([]);

  // Synchronize branch filter if parent changes
  useEffect(() => {
    if (selectedTerminal) {
      setBranchFilter(selectedTerminal);
    }
  }, [selectedTerminal]);

  // Build query string based on active filterMode
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (branchFilter && branchFilter !== 'ALL') {
      params.append('branchCode', branchFilter);
    }

    if (filterMode === 'preset') {
      params.append('period', presetPeriod);
    } else if (filterMode === 'single') {
      params.append('month', String(singleMonth));
      params.append('year', String(singleYear));
    } else if (filterMode === 'month_range') {
      params.append('startMonth', String(startMonth));
      params.append('startYear', String(startYear));
      params.append('endMonth', String(endMonth));
      params.append('endYear', String(endYear));
    } else if (filterMode === 'date_range') {
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
    }

    return params.toString();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const query = buildQueryString();
      const res = await fetch(`/api/modules-data?${query}`);
      const json = await res.json();
      if (json.success) {
        setFinansial(json.finansial || []);
        setOpkom(json.opkom || []);
        setKinerja(json.kinerja || []);
        setUtilisasi(json.utilisasi || []);
        setPeralatan(json.peralatan || []);
        setFasilitas(json.fasilitas || []);
      }
    } catch (e) {
      console.error('Error fetching period data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMode, presetPeriod, singleMonth, singleYear, startMonth, startYear, endMonth, endYear, startDate, endDate, branchFilter]);

  // Derived summaries
  const summary = useMemo(() => {
    // Total records across loaded modules
    const totalRecords = finansial.length + opkom.length + kinerja.length + utilisasi.length + peralatan.length + fasilitas.length;
    
    // Total Revenue from Finansial
    const revRows = finansial.filter(f => f.rekening && (f.rekening.includes('Pendapatan') || f.rekening.includes('REVENUE')));
    const totalRevRp = revRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);

    // Total Opkom Volume
    const totalVolume = opkom.reduce((a, b) => a + (b.jumlah || 0), 0);

    // Avg BOR
    const avgBor = utilisasi.length > 0 
      ? Number((utilisasi.reduce((a, b) => a + (b.bor || 0), 0) / utilisasi.length).toFixed(1))
      : 0;

    // Avg Alat Utilisasi
    const avgAlat = peralatan.length > 0
      ? Number((peralatan.reduce((a, b) => a + (b.utilisasi || 0), 0) / peralatan.length).toFixed(1))
      : 0;

    // Total Fasilitas Aset
    const totalAsetFasilitas = fasilitas.reduce((a, b) => a + (b.nilai || 0), 0);

    return {
      totalRecords,
      totalRevRp,
      totalVolume,
      avgBor,
      avgAlat,
      totalAsetFasilitas,
      countFin: finansial.length,
      countOpkom: opkom.length,
      countKinerja: kinerja.length,
      countUtilisasi: utilisasi.length,
      countPeralatan: peralatan.length,
      countFasilitas: fasilitas.length,
    };
  }, [finansial, opkom, kinerja, utilisasi, peralatan, fasilitas]);

  // Monthly aggregated chart data
  const monthlyChartData = useMemo(() => {
    const monthMap: Record<number, { monthName: string; pendapatanJt: number; volume: number; dataPoints: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthMap[m] = {
        monthName: MONTH_NAMES[m - 1].slice(0, 3),
        pendapatanJt: 0,
        volume: 0,
        dataPoints: 0,
      };
    }

    finansial.forEach(f => {
      if (f.month >= 1 && f.month <= 12) {
        if (f.rekening && (f.rekening.includes('Pendapatan') || f.rekening.includes('REVENUE'))) {
          monthMap[f.month].pendapatanJt += Math.round((f.konsolidasiRp || 0) / 1000000);
        }
        monthMap[f.month].dataPoints += 1;
      }
    });

    opkom.forEach(o => {
      if (o.month >= 1 && o.month <= 12) {
        monthMap[o.month].volume += Math.round(o.jumlah || 0);
        monthMap[o.month].dataPoints += 1;
      }
    });

    // Return only months that have data or fall within range
    return Object.keys(monthMap)
      .map(k => Number(k))
      .sort((a, b) => a - b)
      .filter(m => monthMap[m].dataPoints > 0 || (m >= startMonth && m <= endMonth))
      .map(m => monthMap[m]);
  }, [finansial, opkom, startMonth, endMonth]);

  // Export current filtered view to CSV/Excel table
  const handleExportData = () => {
    let rows: any[] = [];
    let filename = `Data_Periode_${branchFilter}_${Date.now()}.csv`;

    if (activeModule === 'finansial' || activeModule === 'all') {
      rows = finansial.map(f => ({
        Modul: 'Finance',
        Tahun: f.year,
        Bulan: f.month,
        Kode_Cabang: f.branchCode,
        Nama_Cabang: f.branchName,
        Rekening: f.rekening,
        Cabang_Rp: f.cabangRp,
        PMT_Rp: f.pmtRp,
        PTP_Rp: f.ptpRp,
        PSL_Rp: f.pslRp,
        PJM_Rp: f.pjmRp,
        Eliminasi_Rp: f.eliminasiRp,
        Konsolidasi_Rp: f.konsolidasiRp,
        YoY: f.yoy,
        RKA: f.rka,
      }));
    } else if (activeModule === 'opkom') {
      rows = opkom.map(o => ({
        Modul: 'Opkom',
        Tahun: o.year,
        Bulan: o.month,
        Kode_Cabang: o.branchCode,
        Nama_Cabang: o.branchName,
        Layanan: o.layanan,
        Satuan: o.satuan,
        Jumlah: o.jumlah,
        YoY: o.yoy,
        RKA: o.rka,
      }));
    } else if (activeModule === 'kinerja') {
      rows = kinerja.map(k => ({
        Modul: 'Kinerja',
        Tahun: k.year,
        Bulan: k.month,
        Kode_Cabang: k.branchCode,
        Nama_Cabang: k.branchName,
        Kode_Kinerja: k.kdKine,
        Nama_Kinerja: k.nmKine,
        Satuan: k.satuan,
        Nilai: k.nilai,
      }));
    } else if (activeModule === 'utilisasi') {
      rows = utilisasi.map(u => ({
        Modul: 'Utilisasi',
        Tahun: u.year,
        Bulan: u.month,
        Kode_Cabang: u.branchCode,
        Nama_Cabang: u.branchName,
        Kode_Dermaga: u.kdJenderm,
        Nama_Dermaga: u.dermaga,
        BOR: u.bor,
        YOR: u.yor,
        SOR: u.sor,
      }));
    } else if (activeModule === 'peralatan') {
      rows = peralatan.map(p => ({
        Modul: 'Peralatan',
        Tahun: p.year,
        Bulan: p.month,
        Kode_Cabang: p.branchCode,
        Nama_Cabang: p.branchName,
        Kode_Alat: p.kdAlat,
        Nama_Alat: p.nmAlat,
        Singkatan: p.singkatan,
        Jenis_Alat: p.jnsAlat,
        Jumlah: p.jumlah,
        Utilisasi: p.utilisasi,
      }));
    } else if (activeModule === 'fasilitas') {
      rows = fasilitas.map(fs => ({
        Modul: 'Fasilitas',
        Tahun: fs.year,
        Bulan: fs.month,
        Kode_Cabang: fs.branchCode,
        Nama_Cabang: fs.branchName,
        Nama_Fasilitas: fs.nmPasfel,
        Jenis_Fasilitas: fs.jnsFaspel,
        Satuan: fs.satuan,
        Panjang: fs.panjang,
        Lebar: fs.lebar,
        Luas: fs.mLws,
        Nilai_Rp: fs.nilai,
        Keterangan: fs.ket,
      }));
    }

    if (rows.length === 0) {
      alert('Tidak ada data dalam range filter untuk diekspor.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Human-readable current period label
  const activePeriodLabel = useMemo(() => {
    if (filterMode === 'preset') return presetPeriod;
    if (filterMode === 'single') return `${MONTH_NAMES[singleMonth - 1]} ${singleYear}`;
    if (filterMode === 'month_range') return `${MONTH_NAMES[startMonth - 1]} ${startYear} s/d ${MONTH_NAMES[endMonth - 1]} ${endYear}`;
    if (filterMode === 'date_range') return `${startDate} s/d ${endDate}`;
    return 'Semua Periode';
  }, [filterMode, presetPeriod, singleMonth, singleYear, startMonth, startYear, endMonth, endYear, startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. FILTER CONTROLLER CARD */}
      <div className="dark-card" style={{ borderTop: '4px solid #0284c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#38bdf8" />
              <h2 className="dark-card-title" style={{ margin: 0, fontSize: '16px' }}>
                Filter Data per Periode & Analisis Rentang Waktu
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Pilih tampilan data berdasarkan preset periode, rentang bulan/tahun, atau rentang tanggal spesifik.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenManualInput && (
              <button
                type="button"
                onClick={() => onOpenManualInput(activeModule === 'all' ? 'finansial' : activeModule)}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-orange, #f97316)',
                  borderColor: 'var(--accent-orange, #f97316)',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(249, 115, 22, 0.35)',
                }}
                title="Input data manual untuk modul yang aktif"
              >
                <PlusCircle size={14} />
                <span>+ Input Data Manual</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportData}
              className="btn-dark"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Unduh data terfilter ke format spreadsheet"
            >
              <Download size={14} />
              <span>Ekspor CSV/Excel</span>
            </button>

            <button
              type="button"
              onClick={fetchData}
              className="btn-dark"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Refresh data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Filter Mode Selector Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setFilterMode('preset')}
            className={`btn-dark ${filterMode === 'preset' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '20px',
              background: filterMode === 'preset' ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: filterMode === 'preset' ? '#ffffff' : 'var(--text-main)',
              fontWeight: filterMode === 'preset' ? 700 : 500,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            Pilihan Periode Preset
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('month_range')}
            className={`btn-dark ${filterMode === 'month_range' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '20px',
              background: filterMode === 'month_range' ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: filterMode === 'month_range' ? '#ffffff' : 'var(--text-main)',
              fontWeight: filterMode === 'month_range' ? 700 : 500,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            Rentang Bulan & Tahun
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('date_range')}
            className={`btn-dark ${filterMode === 'date_range' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '20px',
              background: filterMode === 'date_range' ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: filterMode === 'date_range' ? '#ffffff' : 'var(--text-main)',
              fontWeight: filterMode === 'date_range' ? 700 : 500,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            Rentang Tanggal Spesifik (Date Range)
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('single')}
            className={`btn-dark ${filterMode === 'single' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '20px',
              background: filterMode === 'single' ? 'var(--accent-blue)' : 'var(--bg-inner)',
              color: filterMode === 'single' ? '#ffffff' : 'var(--text-main)',
              fontWeight: filterMode === 'single' ? 700 : 500,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            Bulan & Tahun Tunggal
          </button>
        </div>

        {/* Dynamic Controls Grid */}
        <div style={{
          backgroundColor: 'var(--bg-inner)',
          padding: '14px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          alignItems: 'end',
        }}>
          {/* Preset Mode Controls */}
          {filterMode === 'preset' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Preset Periode Pelaporan
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                value={presetPeriod}
                onChange={e => setPresetPeriod(e.target.value)}
              >
                <option value="Semua Periode">Semua Periode (All Records)</option>
                <option value="YTD Sep 2026">YTD Sep 2026 (Jan - Sep 2026)</option>
                <option value="YTD Jun 2026">YTD Jun 2026 (Jan - Jun 2026)</option>
                <option value="YTD Mar 2026">YTD Mar 2026 (Jan - Mar 2026)</option>
                <option value="FY 2025">FY 2025 (Tahun Penuh 2025)</option>
                <option value="Q3 2026">Q3 2026 (Jul - Sep 2026)</option>
                <option value="Q2 2026">Q2 2026 (Apr - Jun 2026)</option>
                <option value="Q1 2026">Q1 2026 (Jan - Mar 2026)</option>
              </select>
            </div>
          )}

          {/* Month Range Controls */}
          {filterMode === 'month_range' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Dari Bulan & Tahun
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    className="filter-select"
                    style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                    value={startMonth}
                    onChange={e => setStartMonth(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    style={{ width: '85px', padding: '7px 8px', fontSize: '12px' }}
                    value={startYear}
                    onChange={e => setStartYear(Number(e.target.value))}
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Sampai Dengan Bulan & Tahun
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    className="filter-select"
                    style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                    value={endMonth}
                    onChange={e => setEndMonth(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-select"
                    style={{ width: '85px', padding: '7px 8px', fontSize: '12px' }}
                    value={endYear}
                    onChange={e => setEndYear(Number(e.target.value))}
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Date Range Controls */}
          {filterMode === 'date_range' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  className="filter-select"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Tanggal Selesai
                </label>
                <input
                  type="date"
                  className="filter-select"
                  style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Single Month/Year Controls */}
          {filterMode === 'single' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Bulan & Tahun Spesifik
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  className="filter-select"
                  style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                  value={singleMonth}
                  onChange={e => setSingleMonth(Number(e.target.value))}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  style={{ width: '90px', padding: '7px 8px', fontSize: '12px' }}
                  value={singleYear}
                  onChange={e => setSingleYear(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
          )}

          {/* Cabang Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Filter Cabang Pelabuhan
            </label>
            <select
              className="filter-select"
              style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
            >
              <option value="ALL">Semua Cabang (28 Cabang Regional 4)</option>
              {OFFICIAL_BRANCHES.map(b => (
                <option key={b.code} value={b.code}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Active Filter Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          borderRadius: '6px',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>Periode Terpilih:</span>
            <span style={{ fontWeight: 800, color: 'var(--text-title)' }}>{activePeriodLabel}</span>
            <span style={{ color: 'var(--text-secondary)' }}>• Cabang:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-title)' }}>
              {branchFilter === 'ALL' ? 'Semua Cabang (ALL)' : `[${branchFilter}] ${OFFICIAL_BRANCHES.find(b => b.code === branchFilter)?.name || ''}`}
            </span>
          </div>

          <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
            {summary.totalRecords} total data record ditemukan
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Pendapatan Usaha</span>
            <DollarSign size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px' }}>
            {formatRupiahFull(summary.totalRevRp)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {summary.countFin} pos rekening finansial
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Volume Opkom</span>
            <Boxes size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px' }}>
            {summary.totalVolume.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {summary.countOpkom} record layanan operasi
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Rata-rata BOR Dermaga</span>
            <Activity size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px' }}>
            {summary.avgBor}%
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {summary.countUtilisasi} dermaga terdata
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #a855f7', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Utilisasi Peralatan</span>
            <Wrench size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px' }}>
            {summary.avgAlat}%
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {summary.countPeralatan} unit alat pelabuhan
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #ec4899', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Aset Fasilitas</span>
            <Layers size={18} color="#ec4899" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0 2px' }}>
            {formatRupiahFull(summary.totalAsetFasilitas)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {summary.countFasilitas} fasilitas pelabuhan
          </div>
        </div>
      </div>

      {/* 3. TREND CHART OVER PERIOD */}
      {monthlyChartData.length > 0 && (
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 className="dark-card-title" style={{ margin: 0, fontSize: '15px' }}>
                Tren Akumulatif per Bulan dalam Rentang Terpilih
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Pergerakan pendapatan usaha (Juta Rp) dan volume layanan opkom per bulan
              </div>
            </div>
          </div>

          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3557" />
                <XAxis dataKey="monthName" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#f59e0b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="pendapatanJt" name="Pendapatan (Juta Rp)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="volume" name="Volume Opkom" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. MULTI-MODULE TABBED DATA TABLE */}
      <div className="dark-card">
        {/* Module Nav Buttons & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Module Tab Selector */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Semua Modul', count: summary.totalRecords },
              { id: 'finansial', label: 'Finance', count: summary.countFin },
              { id: 'opkom', label: 'Opkom', count: summary.countOpkom },
              { id: 'kinerja', label: 'Kinerja', count: summary.countKinerja },
              { id: 'utilisasi', label: 'Utilisasi', count: summary.countUtilisasi },
              { id: 'peralatan', label: 'Peralatan', count: summary.countPeralatan },
              { id: 'fasilitas', label: 'Fasilitas', count: summary.countFasilitas },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveModule(tab.id)}
                className={`btn-dark ${activeModule === tab.id ? 'active' : ''}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  background: activeModule === tab.id ? 'var(--accent-blue)' : 'var(--bg-inner)',
                  color: activeModule === tab.id ? '#ffffff' : 'var(--text-main)',
                  fontWeight: activeModule === tab.id ? 700 : 500,
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background: activeModule === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(148,163,184,0.15)',
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              className="filter-select"
              placeholder="Cari kata kunci dalam tabel..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', width: '220px', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Dynamic Table Content based on activeModule */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px' }} />
            <div>Memuat data per periode...</div>
          </div>
        ) : (
          <div className="table-responsive">
            {/* FINANCE TABLE */}
            {(activeModule === 'finansial' || activeModule === 'all') && (
              <div style={{ marginBottom: activeModule === 'all' ? '28px' : '0' }}>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <DollarSign size={16} color="#38bdf8" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                      Modul Finansial ({finansial.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode</th>
                      <th>Cabang Pelabuhan</th>
                      <th>Pos Rekening</th>
                      <th style={{ textAlign: 'right' }}>Cabang (Rp)</th>
                      <th style={{ textAlign: 'right' }}>PMT (Rp)</th>
                      <th style={{ textAlign: 'right' }}>PTP (Rp)</th>
                      <th style={{ textAlign: 'right' }}>PSL (Rp)</th>
                      <th style={{ textAlign: 'right' }}>PJM (Rp)</th>
                      <th style={{ textAlign: 'right' }}>Eliminasi (Rp)</th>
                      <th style={{ textAlign: 'right' }}>Konsolidasi (Rp)</th>
                      <th style={{ textAlign: 'center' }}>% YoY</th>
                      <th style={{ textAlign: 'center' }}>% RKA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finansial
                      .filter(f => !searchQuery || `${f.branchCode} ${f.branchName} ${f.rekening}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((f, i) => (
                        <tr key={i}>
                          <td>{f.year}</td>
                          <td>{f.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{f.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{f.branchName}</td>
                          <td style={{ fontWeight: 600, color: f.rekening.includes('Beban') ? '#f87171' : f.rekening.includes('Laba') ? '#34d399' : '#38bdf8' }}>
                            {f.rekening}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRupiahFull(f.cabangRp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiahFull(f.pmtRp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiahFull(f.ptpRp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiahFull(f.pslRp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiahFull(f.pjmRp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiahFull(f.eliminasiRp)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{formatRupiahFull(f.konsolidasiRp)}</td>
                          <td style={{ textAlign: 'center', color: f.yoy >= 100 ? '#10b981' : '#f87171', fontWeight: 600 }}>{f.yoy}%</td>
                          <td style={{ textAlign: 'center', color: f.rka >= 100 ? '#10b981' : '#f87171', fontWeight: 600 }}>{f.rka}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* OPKOM TABLE */}
            {(activeModule === 'opkom' || activeModule === 'all') && (
              <div style={{ marginBottom: activeModule === 'all' ? '28px' : '0' }}>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Boxes size={16} color="#f59e0b" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                      Modul Opkom (Operasi & Komersial) ({opkom.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode</th>
                      <th>Cabang Pelabuhan</th>
                      <th>Layanan Operasional</th>
                      <th>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Jumlah Realisasi</th>
                      <th style={{ textAlign: 'center' }}>% YoY</th>
                      <th style={{ textAlign: 'center' }}>% RKA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opkom
                      .filter(o => !searchQuery || `${o.branchCode} ${o.branchName} ${o.layanan}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((o, i) => (
                        <tr key={i}>
                          <td>{o.year}</td>
                          <td>{o.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>{o.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{o.branchName}</td>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{o.layanan}</td>
                          <td><span className="badge-category">{o.satuan}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                            {o.jumlah.toLocaleString('id-ID')}
                          </td>
                          <td style={{ textAlign: 'center', color: o.yoy >= 100 ? '#10b981' : '#f87171', fontWeight: 600 }}>{o.yoy}%</td>
                          <td style={{ textAlign: 'center', color: o.rka >= 100 ? '#10b981' : '#f87171', fontWeight: 600 }}>{o.rka}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* KINERJA TABLE */}
            {(activeModule === 'kinerja' || activeModule === 'all') && (
              <div style={{ marginBottom: activeModule === 'all' ? '28px' : '0' }}>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Activity size={16} color="#10b981" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                      Modul Kinerja Pelayanan ({kinerja.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode Cabang</th>
                      <th>Cabang</th>
                      <th>Kode Kinerja</th>
                      <th>Nama Indikator Kinerja</th>
                      <th>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Nilai Realisasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kinerja
                      .filter(k => !searchQuery || `${k.branchCode} ${k.branchName} ${k.kdKine} ${k.nmKine}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((k, i) => (
                        <tr key={i}>
                          <td>{k.year}</td>
                          <td>{k.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>{k.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{k.branchName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{k.kdKine}</td>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{k.nmKine}</td>
                          <td><span className="badge-category">{k.satuan}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{k.nilai}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* UTILISASI TABLE */}
            {(activeModule === 'utilisasi' || activeModule === 'all') && (
              <div style={{ marginBottom: activeModule === 'all' ? '28px' : '0' }}>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <TrendingUp size={16} color="#06b6d4" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#06b6d4' }}>
                      Modul Utilisasi Dermaga (BOR/YOR/SOR) ({utilisasi.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode</th>
                      <th>Cabang Pelabuhan</th>
                      <th>Kode Dermaga</th>
                      <th>Nama Dermaga</th>
                      <th style={{ textAlign: 'center' }}>BOR (%)</th>
                      <th style={{ textAlign: 'center' }}>YOR (%)</th>
                      <th style={{ textAlign: 'center' }}>SOR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilisasi
                      .filter(u => !searchQuery || `${u.branchCode} ${u.branchName} ${u.kdJenderm} ${u.dermaga}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((u, i) => (
                        <tr key={i}>
                          <td>{u.year}</td>
                          <td>{u.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#06b6d4' }}>{u.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{u.branchName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{u.kdJenderm}</td>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{u.dermaga}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: u.bor > 70 ? '#f59e0b' : '#10b981' }}>{u.bor}%</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>{u.yor}%</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#a855f7' }}>{u.sor}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PERALATAN TABLE */}
            {(activeModule === 'peralatan' || activeModule === 'all') && (
              <div style={{ marginBottom: activeModule === 'all' ? '28px' : '0' }}>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Wrench size={16} color="#a855f7" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#a855f7' }}>
                      Modul Peralatan Pelabuhan ({peralatan.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode</th>
                      <th>Cabang</th>
                      <th>Kode Alat</th>
                      <th>Nama Alat</th>
                      <th>Singkatan</th>
                      <th>Jenis Alat</th>
                      <th style={{ textAlign: 'center' }}>Jumlah Unit</th>
                      <th style={{ textAlign: 'center' }}>Utilisasi (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peralatan
                      .filter(p => !searchQuery || `${p.branchCode} ${p.branchName} ${p.nmAlat} ${p.jnsAlat}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((p, i) => (
                        <tr key={i}>
                          <td>{p.year}</td>
                          <td>{p.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a855f7' }}>{p.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{p.branchName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{p.kdAlat}</td>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{p.nmAlat}</td>
                          <td><span className="badge-category">{p.singkatan}</span></td>
                          <td>{p.jnsAlat}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.jumlah}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: p.utilisasi >= 60 ? '#10b981' : '#f59e0b' }}>
                            {p.utilisasi}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FASILITAS TABLE */}
            {(activeModule === 'fasilitas' || activeModule === 'all') && (
              <div>
                {activeModule === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Layers size={16} color="#ec4899" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ec4899' }}>
                      Modul Fasilitas Pelabuhan ({fasilitas.length} baris)
                    </h4>
                  </div>
                )}
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Thn</th>
                      <th>Bln</th>
                      <th>Kode</th>
                      <th>Cabang</th>
                      <th>Nama Fasilitas</th>
                      <th>Jenis Fasilitas</th>
                      <th>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Panjang</th>
                      <th style={{ textAlign: 'right' }}>Lebar</th>
                      <th style={{ textAlign: 'right' }}>Luas (m²)</th>
                      <th style={{ textAlign: 'right' }}>Nilai Aset (Rp)</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fasilitas
                      .filter(f => !searchQuery || `${f.branchCode} ${f.branchName} ${f.nmPasfel} ${f.jnsFaspel}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, activeModule === 'all' ? 10 : 100)
                      .map((f, i) => (
                        <tr key={i}>
                          <td>{f.year}</td>
                          <td>{f.month}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ec4899' }}>{f.branchCode}</td>
                          <td style={{ fontWeight: 600 }}>{f.branchName}</td>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{f.nmPasfel}</td>
                          <td><span className="badge-category">{f.jnsFaspel}</span></td>
                          <td>{f.satuan}</td>
                          <td style={{ textAlign: 'right' }}>{f.panjang}</td>
                          <td style={{ textAlign: 'right' }}>{f.lebar}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{f.mLws.toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{formatRupiahFull(f.nilai)}</td>
                          <td style={{ fontSize: '11px', color: '#94a3b8' }}>{f.ket}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
