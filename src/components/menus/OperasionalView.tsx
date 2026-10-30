'use client';

import React from 'react';
import { Ship, Clock, BarChart3, Anchor, Gauge, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface OperasionalViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function OperasionalView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: OperasionalViewProps) {
  const opsRecords = records.filter(r => r.department_id === 'dept_ops' || (r.indicator_code || '').startsWith('OPS'));

  const callRec = opsRecords.find(r => r.indicator_code === 'OPS-01');
  const gtRec = opsRecords.find(r => r.indicator_code === 'OPS-02');
  const teusRec = opsRecords.find(r => r.indicator_code === 'OPS-03');
  const cargoRec = opsRecords.find(r => r.indicator_code === 'OPS-04');
  const borRec = opsRecords.find(r => r.indicator_code === 'OPS-05');
  const trtRec = opsRecords.find(r => r.indicator_code === 'OPS-06');
  const wtRec = opsRecords.find(r => r.indicator_code === 'OPS-07');
  const bshRec = opsRecords.find(r => r.indicator_code === 'OPS-08');

  // Branch Operations Chart
  const branchOpsData = branches.map(b => {
    const bRecs = opsRecords.filter(r => r.branch_id === b.id);
    const bCall = bRecs.find(r => r.indicator_code === 'OPS-01');
    const bTeus = bRecs.find(r => r.indicator_code === 'OPS-03');
    const bBor = bRecs.find(r => r.indicator_code === 'OPS-05');
    const bTrt = bRecs.find(r => r.indicator_code === 'OPS-06');

    return {
      name: b.name.replace('Cabang ', ''),
      kunjunganKapal: bCall ? bCall.realization : 0,
      petikemasK: bTeus ? Math.round(bTeus.realization / 1000) : 0,
      bor: bBor ? bBor.realization : 0,
      trtJam: bTrt ? bTrt.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <Ship size={18} />
        <div>
          <strong>Kinerja Operasi Maritim & Terminal:</strong> Pemantauan arus kapal, throughput peti kemas (TEUs) & muatan non-petikemas, utilisasi tambatan dermaga (BOR), serta efisiensi waktu kapal di pelabuhan (TRT & Waiting Time).
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Kunjungan Kapal"
          value={callRec?.realization || 0}
          target={callRec?.target || 0}
          unit="Call"
          achievementPct={callRec?.achievement_pct || 0}
          statusColor={callRec?.status_color || 'neutral'}
          icon={<Ship size={18} />}
          comparisonLabel="MoM"
          comparisonPct={2.4}
          onClick={() => callRec && onSelectRecord(callRec)}
        />
        <KPICard
          title="Arus Petikemas"
          value={teusRec?.realization || 0}
          target={teusRec?.target || 0}
          unit="TEUs"
          achievementPct={teusRec?.achievement_pct || 0}
          statusColor={teusRec?.status_color || 'neutral'}
          icon={<BarChart3 size={18} />}
          comparisonLabel="YoY"
          comparisonPct={5.8}
          onClick={() => teusRec && onSelectRecord(teusRec)}
        />
        <KPICard
          title="Non-Petikemas"
          value={cargoRec?.realization || 0}
          target={cargoRec?.target || 0}
          unit="Ton (Ribu)"
          achievementPct={cargoRec?.achievement_pct || 0}
          statusColor={cargoRec?.status_color || 'neutral'}
          icon={<Anchor size={18} />}
          onClick={() => cargoRec && onSelectRecord(cargoRec)}
        />
        <KPICard
          title="Berth Occupancy (BOR)"
          value={borRec?.realization || 0}
          target={borRec?.target || 0}
          unit="%"
          achievementPct={borRec?.achievement_pct || 0}
          statusColor={borRec?.status_color || 'neutral'}
          icon={<Gauge size={18} />}
          onClick={() => borRec && onSelectRecord(borRec)}
        />
        <KPICard
          title="Turn Around Time (TRT)"
          value={trtRec?.realization || 0}
          target={trtRec?.target || 0}
          unit="Jam"
          achievementPct={trtRec?.achievement_pct || 0}
          statusColor={trtRec?.status_color || 'neutral'}
          direction="lower_is_better"
          icon={<Clock size={18} />}
          onClick={() => trtRec && onSelectRecord(trtRec)}
        />
        <KPICard
          title="Produktivitas (BSH)"
          value={bshRec?.realization || 0}
          target={bshRec?.target || 0}
          unit="Box/Kapal/Jam"
          achievementPct={bshRec?.achievement_pct || 0}
          statusColor={bshRec?.status_color || 'neutral'}
          icon={<ArrowUpRight size={18} />}
          onClick={() => bshRec && onSelectRecord(bshRec)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Arus Petikemas (Ribu TEUs) & Kunjungan Kapal (Call)</h3>
              <p className="card-subtitle">Perbandingan Throughput Terminal per Cabang Pelabuhan</p>
            </div>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchOpsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="petikemasK" name="Petikemas (Ribu TEUs)" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="kunjunganKapal" name="Kunjungan Kapal (Call)" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Efisiensi Tambatan: BOR (%) vs Waktu Port Stay TRT (Jam)</h3>
              <p className="card-subtitle">Utilisasi Dermaga Ideal 60-70% dengan TRT Efisien</p>
            </div>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchOpsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bor" name="Berth Occupancy Ratio (%)" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="trtJam" name="TRT (Jam)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja Operasional</h3>
        </div>
        <DataTable records={opsRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
