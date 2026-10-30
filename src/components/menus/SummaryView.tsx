'use client';

import React from 'react';
import {
  Ship,
  Wallet,
  ShieldCheck,
  Users,
  Anchor,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Building2,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { MonthlyRecord, Branch, Department } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface SummaryViewProps {
  records: MonthlyRecord[];
  allYearRecords: MonthlyRecord[];
  branches: Branch[];
  departments: Department[];
  selectedBranchId: string;
  selectedMonth: number;
  selectedYear: number;
  onDrilldown: (branchId: string) => void;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function SummaryView({
  records,
  allYearRecords,
  branches,
  departments,
  selectedBranchId,
  selectedMonth,
  selectedYear,
  onDrilldown,
  onSelectRecord,
}: SummaryViewProps) {
  // Aggregate Core KPIs for Summary
  const findRecord = (indicatorCode: string) => {
    return records.find(r => (r.indicator_code || '').toUpperCase() === indicatorCode.toUpperCase());
  };

  const revRec = findRecord('KEU-01');
  const shipRec = findRecord('OPS-01');
  const containerRec = findRecord('OPS-03');
  const hsseRec = findRecord('HSSE-01');
  const csatRec = findRecord('PEL-02');
  const rfuRec = findRecord('TEK-01');

  // Traffic light summary counts
  const greenCount = records.filter(r => r.status_color === 'green').length;
  const yellowCount = records.filter(r => r.status_color === 'yellow').length;
  const redCount = records.filter(r => r.status_color === 'red').length;
  const totalCount = records.length || 1;

  // Comparison antar cabang data for bar chart
  const branchComparisonData = branches.map(b => {
    const bRecords = records.filter(r => r.branch_id === b.id);
    const bRev = bRecords.find(r => (r.indicator_code || '').toUpperCase() === 'KEU-01');
    const bContainer = bRecords.find(r => (r.indicator_code || '').toUpperCase() === 'OPS-03');
    const bShip = bRecords.find(r => (r.indicator_code || '').toUpperCase() === 'OPS-01');

    return {
      branchId: b.id,
      name: b.name.replace('Cabang ', ''),
      code: b.code,
      pendapatan: bRev ? bRev.realization : 0,
      targetPendapatan: bRev ? bRev.target : 0,
      petikemas: bContainer ? Math.round(bContainer.realization / 1000) : 0, // In thousands TEU
      kapal: bShip ? bShip.realization : 0,
    };
  });

  // Monthly trend for current year
  const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthlyTrendData = monthsNames.map((mName, idx) => {
    const mNum = idx + 1;
    const mRecords = allYearRecords.filter(r => r.month === mNum);
    const mRev = mRecords.filter(r => (r.indicator_code || '').toUpperCase() === 'KEU-01');
    const totalRev = mRev.reduce((acc, curr) => acc + curr.realization, 0);
    const targetRev = mRev.reduce((acc, curr) => acc + curr.target, 0);

    const mTeus = mRecords.filter(r => (r.indicator_code || '').toUpperCase() === 'OPS-03');
    const totalTeus = mTeus.reduce((acc, curr) => acc + curr.realization, 0);

    return {
      month: mName,
      monthNum: mNum,
      realisasiPendapatan: Number(totalRev.toFixed(1)),
      targetPendapatan: Number(targetRev.toFixed(1)),
      petikemasK: Math.round(totalTeus / 1000),
    };
  }).filter(d => d.monthNum <= (selectedYear === 2026 ? 3 : 12));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Strategic Alerts & Highlights Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f1d3a, #1e3a8a)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid rgba(56, 189, 248, 0.2)'
      }}>
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Anchor size={20} color="#38bdf8" />
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Ringkasan Eksekutif Kinerja Pelabuhan</h2>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.25)', padding: '2px 8px', borderRadius: '999px', color: '#7dd3fc', fontWeight: 600 }}>
              {selectedBranchId === 'ALL' ? 'Regional Konsolidasi' : branches.find(b => b.id === selectedBranchId)?.name}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Realisasi kinerja operasional dan finansial menunjukkan stabilitas tinggi. Arus petikemas dan kunjungan kapal meningkat sejalan dengan peningkatan kesiapan peralatan (RFU).
          </p>
        </div>

        {/* Traffic Light Distribution Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(5, 150, 105, 0.2)', border: '1px solid rgba(5, 150, 105, 0.4)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>{greenCount}</div>
            <div style={{ fontSize: '11px', color: '#a7f3d0' }}>Tercapai (Hijau)</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(217, 119, 6, 0.2)', border: '1px solid rgba(217, 119, 6, 0.4)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#fbbf24' }}>{yellowCount}</div>
            <div style={{ fontSize: '11px', color: '#fde68a' }}>Perhatian (Kuning)</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.4)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f87171' }}>{redCount}</div>
            <div style={{ fontSize: '11px', color: '#fecaca' }}>Di Bawah Target (Merah)</div>
          </div>
        </div>
      </div>

      {/* Top Core KPI Cards Grid */}
      <div className="kpi-grid">
        <KPICard
          title="Pendapatan Usaha"
          value={revRec?.realization || 0}
          target={revRec?.target || 0}
          unit="Miliar Rp"
          achievementPct={revRec?.achievement_pct || 0}
          statusColor={revRec?.status_color || 'neutral'}
          icon={<Wallet size={18} />}
          comparisonLabel="MoM"
          comparisonPct={4.2}
          onClick={() => revRec && onSelectRecord(revRec)}
        />
        <KPICard
          title="Arus Kunjungan Kapal"
          value={shipRec?.realization || 0}
          target={shipRec?.target || 0}
          unit="Call"
          achievementPct={shipRec?.achievement_pct || 0}
          statusColor={shipRec?.status_color || 'neutral'}
          icon={<Ship size={18} />}
          comparisonLabel="MoM"
          comparisonPct={2.8}
          onClick={() => shipRec && onSelectRecord(shipRec)}
        />
        <KPICard
          title="Arus Petikemas"
          value={containerRec?.realization || 0}
          target={containerRec?.target || 0}
          unit="TEUs"
          achievementPct={containerRec?.achievement_pct || 0}
          statusColor={containerRec?.status_color || 'neutral'}
          icon={<BarChart3 size={18} />}
          comparisonLabel="YoY"
          comparisonPct={6.5}
          onClick={() => containerRec && onSelectRecord(containerRec)}
        />
        <KPICard
          title="Keselamatan (Fatality)"
          value={hsseRec?.realization || 0}
          target={hsseRec?.target || 0}
          unit="Kasus"
          achievementPct={hsseRec?.achievement_pct || 100}
          statusColor={hsseRec?.status_color || 'green'}
          direction="lower_is_better"
          icon={<ShieldCheck size={18} />}
          onClick={() => hsseRec && onSelectRecord(hsseRec)}
        />
        <KPICard
          title="Kepuasan Pelanggan (CSAT)"
          value={csatRec?.realization || 0}
          target={csatRec?.target || 0}
          unit="Skor"
          achievementPct={csatRec?.achievement_pct || 0}
          statusColor={csatRec?.status_color || 'neutral'}
          icon={<Users size={18} />}
          onClick={() => csatRec && onSelectRecord(csatRec)}
        />
        <KPICard
          title="Kesiapan Alat (RFU)"
          value={rfuRec?.realization || 0}
          target={rfuRec?.target || 0}
          unit="%"
          achievementPct={rfuRec?.achievement_pct || 0}
          statusColor={rfuRec?.status_color || 'neutral'}
          icon={<TrendingUp size={18} />}
          onClick={() => rfuRec && onSelectRecord(rfuRec)}
        />
      </div>

      {/* Charts Section: Branch Comparison & Monthly Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {/* Branch Comparison */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Building2 size={18} color="var(--blue-primary)" />
                <span>Perbandingan Kinerja Antarcabang</span>
              </h3>
              <p className="card-subtitle">Realisasi vs Target Pendapatan (Miliar Rp) per Cabang</p>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Klik nama cabang untuk drill-down</span>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString('id-ID')} Miliar Rp`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="targetPendapatan" name="Target RKAP" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="pendapatan"
                  name="Realisasi Pendapatan"
                  fill="#1d4ed8"
                  radius={[4, 4, 0, 0]}
                  onClick={(entry: any) => onDrilldown(entry?.payload?.branchId || entry?.branchId)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <TrendingUp size={18} color="var(--blue-primary)" />
                <span>Tren Bulanan Pendapatan Usaha</span>
              </h3>
              <p className="card-subtitle">Perkembangan Realisasi vs Target Periode {selectedYear}</p>
            </div>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString('id-ID')} Miliar Rp`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="targetPendapatan"
                  name="Target"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="realisasiPendapatan"
                  name="Realisasi"
                  stroke="#2563eb"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategic Issues & Detailed Indicators Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <CheckCircle size={18} color="var(--blue-primary)" />
              <span>Detail Indikator Kinerja Terpilih</span>
            </h3>
            <p className="card-subtitle">Daftar seluruh indikator departemen pada periode dan wilayah aktif</p>
          </div>
        </div>

        <DataTable records={records} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
