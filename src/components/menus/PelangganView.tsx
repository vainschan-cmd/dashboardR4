'use client';

import React from 'react';
import { Users, UserPlus, MessageSquare, CheckCircle, Award, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface PelangganViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function PelangganView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: PelangganViewProps) {
  const pelRecords = records.filter(r => r.department_id === 'dept_pel' || (r.indicator_code || '').startsWith('PEL'));

  const activeCust = pelRecords.find(r => r.indicator_code === 'PEL-01');
  const csat = pelRecords.find(r => r.indicator_code === 'PEL-02');
  const complaints = pelRecords.find(r => r.indicator_code === 'PEL-03');
  const slaResolution = pelRecords.find(r => r.indicator_code === 'PEL-04');

  // Chart: CSAT per Branch
  const csatBranchData = branches.map(b => {
    const bRec = pelRecords.find(r => r.branch_id === b.id && r.indicator_code === 'PEL-02');
    const compRec = pelRecords.find(r => r.branch_id === b.id && r.indicator_code === 'PEL-03');
    return {
      name: b.name.replace('Cabang ', ''),
      csat: bRec ? bRec.realization : 0,
      targetCsat: bRec ? bRec.target : 85,
      keluhan: compRec ? compRec.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <Award size={18} />
        <div>
          <strong>Fokus Layanan Pelanggan (Pelayaran & Logistik):</strong> Mengukur kepuasan pelanggan, waktu tanggap (SLA) penanganan komplain di dermaga/lapangan, serta retensi pengguna jasa kepelabuhanan.
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Pelanggan Aktif"
          value={activeCust?.realization || 0}
          target={activeCust?.target || 0}
          unit="Entitas"
          achievementPct={activeCust?.achievement_pct || 0}
          statusColor={activeCust?.status_color || 'neutral'}
          icon={<Users size={18} />}
          comparisonLabel="MoM"
          comparisonPct={3.1}
          onClick={() => activeCust && onSelectRecord(activeCust)}
        />
        <KPICard
          title="Indeks Kepuasan (CSAT)"
          value={csat?.realization || 0}
          target={csat?.target || 0}
          unit="Skor"
          achievementPct={csat?.achievement_pct || 0}
          statusColor={csat?.status_color || 'neutral'}
          icon={<Award size={18} />}
          onClick={() => csat && onSelectRecord(csat)}
        />
        <KPICard
          title="Keluhan Masuk"
          value={complaints?.realization || 0}
          target={complaints?.target || 0}
          unit="Kasus"
          achievementPct={complaints?.achievement_pct || 0}
          statusColor={complaints?.status_color || 'neutral'}
          direction="lower_is_better"
          icon={<MessageSquare size={18} />}
          onClick={() => complaints && onSelectRecord(complaints)}
        />
        <KPICard
          title="Penyelesaian SLA Tepat Waktu"
          value={slaResolution?.realization || 0}
          target={slaResolution?.target || 0}
          unit="%"
          achievementPct={slaResolution?.achievement_pct || 0}
          statusColor={slaResolution?.status_color || 'neutral'}
          icon={<CheckCircle size={18} />}
          onClick={() => slaResolution && onSelectRecord(slaResolution)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Perbandingan Kepuasan Pelanggan (CSAT) Antarcabang</h3>
            <p className="card-subtitle">Skor Survei Kepuasan dan Jumlah Keluhan Penanganan Kargo</p>
          </div>
        </div>

        <div style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={csatBranchData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="targetCsat" name="Target CSAT" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="csat" name="Realisasi CSAT" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="keluhan" name="Keluhan Masuk (Kasus)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja Pelanggan</h3>
        </div>
        <DataTable records={pelRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
