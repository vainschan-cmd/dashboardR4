'use client';

import React from 'react';
import { Wrench, CheckCircle, AlertTriangle, Layers, Hammer, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface TeknikViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function TeknikView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: TeknikViewProps) {
  const tekRecords = records.filter(r => r.department_id === 'dept_tek' || (r.indicator_code || '').startsWith('TEK'));

  const rfu = tekRecords.find(r => r.indicator_code === 'TEK-01');
  const preventive = tekRecords.find(r => r.indicator_code === 'TEK-02');
  const downtime = tekRecords.find(r => r.indicator_code === 'TEK-03');
  const capex = tekRecords.find(r => r.indicator_code === 'TEK-04');

  const branchTechData = branches.map(b => {
    const bRecs = tekRecords.filter(r => r.branch_id === b.id);
    const bRfu = bRecs.find(r => r.indicator_code === 'TEK-01');
    const bPrev = bRecs.find(r => r.indicator_code === 'TEK-02');
    const bDown = bRecs.find(r => r.indicator_code === 'TEK-03');

    return {
      name: b.name.replace('Cabang ', ''),
      rfuPct: bRfu ? bRfu.realization : 0,
      targetRfu: bRfu ? bRfu.target : 88,
      preventivePct: bPrev ? bPrev.realization : 0,
      downtimeJam: bDown ? bDown.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <Wrench size={18} />
        <div>
          <strong>Kesiapan Fasilitas & Keandalan Alat (Equipment Reliability):</strong> Memastikan tingkat kesiapan alat (Ready For Use / RFU), rasio pemeliharaan preventif terhadap korektif, minimalisasi downtime alat bongkar muat (Container Crane, RTG), dan progres proyek capex investasi.
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Kesiapan Alat (RFU)"
          value={rfu?.realization || 0}
          target={rfu?.target || 0}
          unit="%"
          achievementPct={rfu?.achievement_pct || 0}
          statusColor={rfu?.status_color || 'neutral'}
          icon={<Activity size={18} />}
          onClick={() => rfu && onSelectRecord(rfu)}
        />
        <KPICard
          title="Rasio Preventif Maintenance"
          value={preventive?.realization || 0}
          target={preventive?.target || 0}
          unit="%"
          achievementPct={preventive?.achievement_pct || 0}
          statusColor={preventive?.status_color || 'neutral'}
          icon={<CheckCircle size={18} />}
          onClick={() => preventive && onSelectRecord(preventive)}
        />
        <KPICard
          title="Total Jam Kerusakan / Downtime"
          value={downtime?.realization || 0}
          target={downtime?.target || 0}
          unit="Jam"
          achievementPct={downtime?.achievement_pct || 0}
          statusColor={downtime?.status_color || 'neutral'}
          direction="lower_is_better"
          icon={<AlertTriangle size={18} />}
          onClick={() => downtime && onSelectRecord(downtime)}
        />
        <KPICard
          title="Progres Proyek Investasi Capex"
          value={capex?.realization || 0}
          target={capex?.target || 0}
          unit="%"
          achievementPct={capex?.achievement_pct || 0}
          statusColor={capex?.status_color || 'neutral'}
          icon={<Hammer size={18} />}
          onClick={() => capex && onSelectRecord(capex)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Kesiapan Alat (RFU %) & Pemeliharaan Preventif per Cabang</h3>
            <p className="card-subtitle">Tolok ukur keandalan armada Crane & Peralatan Penunjang Terminal</p>
          </div>
        </div>

        <div style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={branchTechData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="targetRfu" name="Target RFU (%)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rfuPct" name="Realisasi RFU (%)" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="preventivePct" name="Preventive Ratio (%)" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja Teknik</h3>
        </div>
        <DataTable records={tekRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
