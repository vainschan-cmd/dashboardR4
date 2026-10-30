'use client';

import React from 'react';
import { Wallet, TrendingUp, DollarSign, PiggyBank, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, AreaChart, Area } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface KeuanganViewProps {
  records: MonthlyRecord[];
  allYearRecords: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function KeuanganView({
  records,
  allYearRecords,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: KeuanganViewProps) {
  const keuRecords = records.filter(r => r.department_id === 'dept_keu' || (r.indicator_code || '').startsWith('KEU'));

  const rev = keuRecords.find(r => r.indicator_code === 'KEU-01');
  const cost = keuRecords.find(r => r.indicator_code === 'KEU-02');
  const profit = keuRecords.find(r => r.indicator_code === 'KEU-03');
  const rkap = keuRecords.find(r => r.indicator_code === 'KEU-04');

  // Branch Financial Breakdown
  const financialBranchData = branches.map(b => {
    const bRecs = keuRecords.filter(r => r.branch_id === b.id);
    const bRev = bRecs.find(r => r.indicator_code === 'KEU-01');
    const bCost = bRecs.find(r => r.indicator_code === 'KEU-02');
    const bProfit = bRecs.find(r => r.indicator_code === 'KEU-03');

    return {
      name: b.name.replace('Cabang ', ''),
      pendapatan: bRev ? bRev.realization : 0,
      biaya: bCost ? bCost.realization : 0,
      laba: bProfit ? bProfit.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <DollarSign size={18} />
        <div>
          <strong>Pengawasan Keuangan & RKAP Pelabuhan:</strong> Konsolidasi pendapatan usaha, pengendalian beban pokok operasional pelabuhan, pencapaian EBITDA, dan kepatuhan terhadap target RKAP tahunan.
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Pendapatan Usaha"
          value={rev?.realization || 0}
          target={rev?.target || 0}
          unit="Miliar Rp"
          achievementPct={rev?.achievement_pct || 0}
          statusColor={rev?.status_color || 'neutral'}
          icon={<Wallet size={18} />}
          comparisonLabel="MoM"
          comparisonPct={3.8}
          onClick={() => rev && onSelectRecord(rev)}
        />
        <KPICard
          title="Beban Pokok Operasional"
          value={cost?.realization || 0}
          target={cost?.target || 0}
          unit="Miliar Rp"
          achievementPct={cost?.achievement_pct || 0}
          statusColor={cost?.status_color || 'neutral'}
          direction="lower_is_better"
          icon={<PiggyBank size={18} />}
          onClick={() => cost && onSelectRecord(cost)}
        />
        <KPICard
          title="Laba Bersih Operasional"
          value={profit?.realization || 0}
          target={profit?.target || 0}
          unit="Miliar Rp"
          achievementPct={profit?.achievement_pct || 0}
          statusColor={profit?.status_color || 'neutral'}
          icon={<TrendingUp size={18} />}
          comparisonLabel="YoY"
          comparisonPct={5.4}
          onClick={() => profit && onSelectRecord(profit)}
        />
        <KPICard
          title="Realisasi Anggaran RKAP"
          value={rkap?.realization || 0}
          target={rkap?.target || 0}
          unit="%"
          achievementPct={rkap?.achievement_pct || 0}
          statusColor={rkap?.status_color || 'neutral'}
          icon={<FileSpreadsheet size={18} />}
          onClick={() => rkap && onSelectRecord(rkap)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Struktur Finansial: Pendapatan, Beban & Laba per Cabang</h3>
            <p className="card-subtitle">Perbandingan kinerja keuangan antarcabang pelabuhan (Satuan: Miliar Rupiah)</p>
          </div>
        </div>

        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financialBranchData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toLocaleString('id-ID')} Miliar Rp`]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pendapatan" name="Pendapatan Usaha" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="biaya" name="Beban Operasional" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="laba" name="Laba Bersih" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja Keuangan</h3>
        </div>
        <DataTable records={keuRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
