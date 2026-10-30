'use client';

import React from 'react';
import { Briefcase, FileCheck, Layers, PieChart as PieIcon, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { MonthlyRecord, Branch } from '@/lib/types';
import KPICard from '../ui/KPICard';
import DataTable from '../ui/DataTable';

interface KomersialViewProps {
  records: MonthlyRecord[];
  branches: Branch[];
  selectedMonth: number;
  selectedYear: number;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function KomersialView({
  records,
  branches,
  selectedMonth,
  selectedYear,
  onSelectRecord,
}: KomersialViewProps) {
  const komRecords = records.filter(r => r.department_id === 'dept_kom' || (r.indicator_code || '').startsWith('KOM'));

  const dermaga = komRecords.find(r => r.indicator_code === 'KOM-01');
  const tunda = komRecords.find(r => r.indicator_code === 'KOM-02');
  const kontrak = komRecords.find(r => r.indicator_code === 'KOM-03');

  // Service revenue composition
  const serviceComposition = [
    { name: 'Jasa Dermaga & Tambat', value: dermaga ? dermaga.realization : 85, color: '#1d4ed8' },
    { name: 'Jasa Pandu & Tunda', value: tunda ? tunda.realization : 65, color: '#0284c7' },
    { name: 'Jasa Bongkar Muat & Alat', value: 120, color: '#38bdf8' },
    { name: 'Jasa Penumpukan & Gudang', value: 45, color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="alert-box alert-info">
        <Briefcase size={18} />
        <div>
          <strong>Pengembangan Bisnis & Layanan Komersial:</strong> Monitoring portofolio tarif layanan kepelabuhanan, realisasi kontrak B2B dengan perusahaan pelayaran (shipping lines), dan optimasi pendapatan jasa dermaga serta penundaan kapal.
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Pendapatan Jasa Dermaga"
          value={dermaga?.realization || 0}
          target={dermaga?.target || 0}
          unit="Miliar Rp"
          achievementPct={dermaga?.achievement_pct || 0}
          statusColor={dermaga?.status_color || 'neutral'}
          icon={<Layers size={18} />}
          onClick={() => dermaga && onSelectRecord(dermaga)}
        />
        <KPICard
          title="Pendapatan Pandu & Tunda"
          value={tunda?.realization || 0}
          target={tunda?.target || 0}
          unit="Miliar Rp"
          achievementPct={tunda?.achievement_pct || 0}
          statusColor={tunda?.status_color || 'neutral'}
          icon={<Briefcase size={18} />}
          onClick={() => tunda && onSelectRecord(tunda)}
        />
        <KPICard
          title="Kontrak Kerjasama Baru"
          value={kontrak?.realization || 0}
          target={kontrak?.target || 0}
          unit="Kontrak"
          achievementPct={kontrak?.achievement_pct || 0}
          statusColor={kontrak?.status_color || 'neutral'}
          icon={<FileCheck size={18} />}
          onClick={() => kontrak && onSelectRecord(kontrak)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Komposisi Pendapatan Layanan Komersial</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Estimasi Pangsa Pasar (Miliar Rp)</span>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceComposition}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {serviceComposition.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${val} Miliar Rp`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Highlight Kontrak & Peluang Bisnis</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px' }}>PKS Terminal Operator Maersk & CMA CGM</strong>
                <span className="badge badge-green">Aktif</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Komitmen volume minimum 120.000 TEUs/tahun di Terminal Petikemas Tanjung Priok dan Tanjung Perak.
              </p>
            </div>
            <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px' }}>Kerjasama Pelayanan Tongkang Logistik IKN</strong>
                <span className="badge badge-yellow">Negosiasi Final</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Penyediaan dermaga curah kering dan area penumpukan material semen/batu split di Cabang Balikpapan.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tabel Indikator Kinerja Komersial</h3>
        </div>
        <DataTable records={komRecords} onSelectRecord={onSelectRecord} />
      </div>
    </div>
  );
}
