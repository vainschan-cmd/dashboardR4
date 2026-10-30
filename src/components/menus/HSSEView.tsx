'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Eye, CheckCircle2, Leaf } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface HSSEViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function HSSEView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: HSSEViewProps) {
  const hsseRecords = records.filter(r => r.department_id === 'dept_hsse' || (r.indicator_code || '').startsWith('HSSE'));

  const fatality = hsseRecords.find(r => r.indicator_code === 'HSSE-01');
  const lti = hsseRecords.find(r => r.indicator_code === 'HSSE-02');
  const nearMiss = hsseRecords.find(r => r.indicator_code === 'HSSE-03');
  const inspection = hsseRecords.find(r => r.indicator_code === 'HSSE-04');
  const env = hsseRecords.find(r => r.indicator_code === 'HSSE-05');

  // Chart data: Safety inspection & Near miss reporting across branches
  const hsseBranchData = branches.map(b => {
    const bRecs = hsseRecords.filter(r => r.branch_id === b.id);
    const bNear = bRecs.find(r => r.indicator_code === 'HSSE-03');
    const bInsp = bRecs.find(r => r.indicator_code === 'HSSE-04');
    const bLti = bRecs.find(r => r.indicator_code === 'HSSE-02');

    return {
      name: b.name.replace('Cabang ', ''),
      inspeksi: bInsp ? bInsp.realization : 0,
      nearMiss: bNear ? bNear.realization : 0,
      ltiKasus: bLti ? bLti.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Zero Accident Commitment Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #065f46, #047857)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%' }}>
            <ShieldCheck size={28} color="#a7f3d0" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>PROGRAM ZERO ACCIDENT PELABUHAN</h2>
            <p style={{ fontSize: '13px', color: '#d1fae5', marginTop: '2px' }}>
              Keselamatan kerja dan perlindungan maritim adalah prioritas utama operasional pelabuhan.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="badge badge-green" style={{ background: '#ffffff', color: '#047857', fontWeight: 800 }}>
            {fatality?.realization === 0 ? 'STATUS: ZERO FATALITY' : 'PERHATIAN KHUSUS'}
          </span>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Fatality (Korban Jiwa)"
          value={fatality?.realization || 0}
          target={0}
          unit="Kasus"
          achievementPct={fatality?.achievement_pct || 100}
          statusColor={fatality?.status_color || 'green'}
          direction="lower_is_better"
          icon={<ShieldAlert size={18} />}
          onClick={() => fatality && onSelectRecord(fatality)}
        />
        <KPICard
          title="Lost Time Injury (LTI)"
          value={lti?.realization || 0}
          target={0}
          unit="Kasus"
          achievementPct={lti?.achievement_pct || 100}
          statusColor={lti?.status_color || 'green'}
          direction="lower_is_better"
          icon={<AlertTriangle size={18} />}
          onClick={() => lti && onSelectRecord(lti)}
        />
        <KPICard
          title="Pelaporan Near Miss"
          value={nearMiss?.realization || 0}
          target={nearMiss?.target || 0}
          unit="Laporan"
          achievementPct={nearMiss?.achievement_pct || 0}
          statusColor={nearMiss?.status_color || 'neutral'}
          icon={<Eye size={18} />}
          onClick={() => nearMiss && onSelectRecord(nearMiss)}
        />
        <KPICard
          title="Safety Inspection"
          value={inspection?.realization || 0}
          target={inspection?.target || 0}
          unit="%"
          achievementPct={inspection?.achievement_pct || 0}
          statusColor={inspection?.status_color || 'neutral'}
          icon={<CheckCircle2 size={18} />}
          onClick={() => inspection && onSelectRecord(inspection)}
        />
        <KPICard
          title="Baku Mutu Lingkungan"
          value={env?.realization || 0}
          target={env?.target || 0}
          unit="%"
          achievementPct={env?.achievement_pct || 0}
          statusColor={env?.status_color || 'neutral'}
          icon={<Leaf size={18} />}
          onClick={() => env && onSelectRecord(env)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Kepatuhan Inspeksi K3 & Kultur Pelaporan Near Miss</h3>
            <p className="card-subtitle">Realisasi Inspeksi Lapangan Terjadwal (%) dan Proaktif Pelaporan Bahaya per Cabang</p>
          </div>
        </div>

        <div style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hsseBranchData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inspeksi" name="Safety Inspection (%)" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="nearMiss" name="Laporan Near Miss" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ltiKasus" name="Kasus LTI (Hari Hilang)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja HSSE</h3>
        </div>
        <DataTable records={hsseRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
