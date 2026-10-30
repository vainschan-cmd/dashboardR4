'use client';

import React from 'react';
import { UserCheck, Users, GraduationCap, Clock, Award, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface SDMViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function SDMView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: SDMViewProps) {
  const sdmRecords = records.filter(r => r.department_id === 'dept_sdm' || (r.indicator_code || '').startsWith('SDM'));

  const totalPegawai = sdmRecords.find(r => r.indicator_code === 'SDM-01');
  const produktivitas = sdmRecords.find(r => r.indicator_code === 'SDM-02');
  const training = sdmRecords.find(r => r.indicator_code === 'SDM-03');
  const kehadiran = sdmRecords.find(r => r.indicator_code === 'SDM-04');

  const branchSdmData = branches.map(b => {
    const bRecs = sdmRecords.filter(r => r.branch_id === b.id);
    const bTot = bRecs.find(r => r.indicator_code === 'SDM-01');
    const bProd = bRecs.find(r => r.indicator_code === 'SDM-02');
    const bTrain = bRecs.find(r => r.indicator_code === 'SDM-03');

    return {
      name: b.name.replace('Cabang ', ''),
      totalPegawai: bTot ? bTot.realization : 0,
      produktivitasJt: bProd ? bProd.realization : 0,
      jamTraining: bTrain ? bTrain.realization : 0,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <UserCheck size={18} />
        <div>
          <strong>Pengelolaan Sumber Daya Manusia (Human Capital):</strong> Pemantauan efektivitas tenaga kerja pelabuhan, produktivitas per kapita, pemenuhan standar jam pelatihan wajib, dan kedisiplinan tingkat kehadiran.
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Total Pegawai Aktif"
          value={totalPegawai?.realization || 0}
          target={totalPegawai?.target || 0}
          unit="Orang"
          achievementPct={totalPegawai?.achievement_pct || 0}
          statusColor={totalPegawai?.status_color || 'neutral'}
          icon={<Users size={18} />}
          onClick={() => totalPegawai && onSelectRecord(totalPegawai)}
        />
        <KPICard
          title="Produktivitas SDM"
          value={produktivitas?.realization || 0}
          target={produktivitas?.target || 0}
          unit="Juta Rp/Org"
          achievementPct={produktivitas?.achievement_pct || 0}
          statusColor={produktivitas?.status_color || 'neutral'}
          icon={<TrendingUp size={18} />}
          comparisonLabel="MoM"
          comparisonPct={2.1}
          onClick={() => produktivitas && onSelectRecord(produktivitas)}
        />
        <KPICard
          title="Rata-rata Jam Diklat"
          value={training?.realization || 0}
          target={training?.target || 0}
          unit="Jam/Org"
          achievementPct={training?.achievement_pct || 0}
          statusColor={training?.status_color || 'neutral'}
          icon={<GraduationCap size={18} />}
          onClick={() => training && onSelectRecord(training)}
        />
        <KPICard
          title="Tingkat Kehadiran / Presensi"
          value={kehadiran?.realization || 0}
          target={kehadiran?.target || 0}
          unit="%"
          achievementPct={kehadiran?.achievement_pct || 0}
          statusColor={kehadiran?.status_color || 'neutral'}
          icon={<Clock size={18} />}
          onClick={() => kehadiran && onSelectRecord(kehadiran)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Komposisi Tenaga Kerja & Jam Pelatihan per Cabang</h3>
            <p className="card-subtitle">Sebaran jumlah pegawai dan rata-rata pengembangan kompetensi SDM</p>
          </div>
        </div>

        <div style={{ height: '280px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={branchSdmData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="totalPegawai" name="Jumlah Pegawai (Orang)" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="jamTraining" name="Rata-rata Diklat (Jam/Pegawai)" fill="#0284c7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja SDM</h3>
        </div>
        <DataTable records={sdmRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
