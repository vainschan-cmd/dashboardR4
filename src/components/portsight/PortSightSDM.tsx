'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { User, Briefcase, Award } from 'lucide-react';

export default function PortSightSDM() {
  const ageData = [
    { range: '< 30', y2025: 135, y2026: 142 },
    { range: '30–39', y2025: 310, y2026: 318 },
    { range: '40–49', y2025: 365, y2026: 356 },
    { range: '50–56', y2025: 320, y2026: 304 },
  ];

  const pensionProjection = [
    { year: '2026*', count: 12 },
    { year: '2027', count: 41 },
    { year: '2028', count: 46 },
    { year: '2029', count: 52 },
    { year: '2030', count: 58 },
  ];

  const divisionData = [
    { name: 'Operasi', organik: 420, os: 1640, pension2y: 31, yoy: '−3,9%' },
    { name: 'Teknik', organik: 310, os: 920, pension2y: 27, yoy: '−5,2%' },
    { name: 'Keuangan & SDM', organik: 180, os: 160, pension2y: 12, yoy: '−2,7%' },
    { name: 'Komersial', organik: 150, os: 210, pension2y: 11, yoy: '−3,2%' },
    { name: 'HSSE', organik: 60, os: 185, pension2y: 6, yoy: '−6,3%' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '18px' }}>
      {/* Left: Struktur Organisasi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="dark-card">
          <div className="dark-card-title">Struktur organisasi</div>

          <div style={{ backgroundColor: '#0e1c30', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px', textAlign: 'center', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
            General Manager
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {divisionData.map((d, i) => (
              <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#101e33' }}>
                <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#ffffff' }}>{d.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {d.organik} organik • {d.os.toLocaleString('id-ID')} OS
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Spotlight */}
        <div className="dark-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <User size={20} />
          </div>
          <div style={{ fontSize: '12px' }}>
            <div style={{ fontWeight: 700, color: '#ffffff' }}>Bambang Suherman</div>
            <div style={{ color: 'var(--text-muted)' }}>Manajer Operasi • 27 th kerja</div>
            <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 600 }}>Pensiun Mar 2027</div>
          </div>
        </div>
      </div>

      {/* Right: Metrics & Charts & Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 4 Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div className="dark-card">
            <div className="kpi-header-label">Organik aktif</div>
            <div className="kpi-huge-number">1.120</div>
            <div className="kpi-comparison-rows">2025: 1.168 (−4,1%)</div>
          </div>

          <div className="dark-card">
            <div className="kpi-header-label">Outsourcing</div>
            <div className="kpi-huge-number">3.115</div>
            <div className="kpi-comparison-rows">2025: 2.980 (+4,5%)</div>
          </div>

          <div className="dark-card">
            <div className="kpi-header-label">Rasio OS : organik</div>
            <div className="kpi-huge-number">2,8</div>
            <div className="kpi-comparison-rows">2025: 2,6</div>
          </div>

          <div className="dark-card">
            <div className="kpi-header-label">Pensiun ≤ 24 bulan</div>
            <div className="kpi-huge-number" style={{ color: '#f59e0b' }}>87</div>
            <div className="kpi-comparison-rows">41 dalam 12 bulan</div>
          </div>
        </div>

        {/* Charts: Age & Pension */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="dark-card">
            <div className="dark-card-title">Usia pegawai organik</div>
            <div style={{ height: '170px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                  <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px' }} />
                  <Bar dataKey="y2025" name="2025" fill="#64748b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="y2026" name="2026" fill="#0284c7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dark-card">
            <div className="dark-card-title">Proyeksi pensiun organik per tahun</div>
            <div style={{ height: '170px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pensionProjection} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px' }} />
                  <Bar dataKey="count" name="Jumlah Pegawai" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Division Table */}
        <div className="dark-card">
          <div className="dark-card-title">Komposisi per divisi</div>
          <table className="dark-table">
            <thead>
              <tr>
                <th>Divisi</th>
                <th style={{ textAlign: 'right' }}>Organik</th>
                <th style={{ textAlign: 'right' }}>Outsourcing</th>
                <th style={{ textAlign: 'right' }}>Pensiun ≤ 2 th</th>
                <th style={{ textAlign: 'right' }}>Organik YoY</th>
              </tr>
            </thead>
            <tbody>
              {divisionData.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: '#ffffff' }}>{d.name}</td>
                  <td style={{ textAlign: 'right' }}>{d.organik}</td>
                  <td style={{ textAlign: 'right' }}>{d.os.toLocaleString('id-ID')}</td>
                  <td style={{ textAlign: 'right' }}>{d.pension2y}</td>
                  <td style={{ textAlign: 'right', color: '#f87171', fontWeight: 600 }}>{d.yoy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
