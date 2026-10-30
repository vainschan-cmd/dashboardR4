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
  CartesianGrid,
  Line,
  ComposedChart
} from 'recharts';

export default function PortSightOperasional() {
  // Monthly throughput Jan - Sep (ribu TEUs)
  const monthlyData = [
    { month: 'Jan', y2025: 98, y2026: 104, rkap2026: 102 },
    { month: 'Feb', y2025: 96, y2026: 101, rkap2026: 100 },
    { month: 'Mar', y2025: 105, y2026: 112, rkap2026: 108 },
    { month: 'Apr', y2025: 100, y2026: 106, rkap2026: 105 },
    { month: 'Mei', y2025: 108, y2026: 115, rkap2026: 110 },
    { month: 'Jun', y2025: 102, y2026: 110, rkap2026: 108 },
    { month: 'Jul', y2025: 112, y2026: 118, rkap2026: 114 },
    { month: 'Agu', y2025: 114, y2026: 121, rkap2026: 116 },
    { month: 'Sep', y2025: 110, y2026: 117, rkap2026: 112 },
  ];

  // Petikemas per terminal
  const terminalData = [
    { name: 'New Makassar', y2026: 412.5, y2025: 380.2, rkap: 400.0, rkapPct: '103,1%', yoy: '+8,5%' },
    { name: 'Makassar', y2026: 268.4, y2025: 271.9, rkap: 275.0, rkapPct: '97,6%', yoy: '−1,3%' },
    { name: 'Bitung', y2026: 196.3, y2025: 181.8, rkap: 190.0, rkapPct: '103,3%', yoy: '+8,0%' },
    { name: 'Ambon', y2026: 88.7, y2025: 85.1, rkap: 92.0, rkapPct: '96,4%', yoy: '+4,2%' },
    { name: 'Sorong', y2026: 74.2, y2025: 66.8, rkap: 70.0, rkapPct: '106,0%', yoy: '+11,1%' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 3 Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        <div className="dark-card">
          <div className="kpi-header-label">Arus petikemas (TEUs)</div>
          <div className="kpi-huge-number">1.040.100</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 700 }}>
            <span className="text-positive">101,3% RKAP</span>
            <span className="text-positive">+5,5% YoY</span>
          </div>
        </div>

        <div className="dark-card">
          <div className="kpi-header-label">Arus barang (ton)</div>
          <div className="kpi-huge-number">8.320.000</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 700 }}>
            <span className="text-positive">100,2% RKAP</span>
            <span className="text-positive">+4,3% YoY</span>
          </div>
        </div>

        <div className="dark-card">
          <div className="kpi-header-label">Kunjungan kapal (call)</div>
          <div className="kpi-huge-number">1.842</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 700 }}>
            <span className="text-positive">102,3% RKAP</span>
            <span className="text-positive">+4,2% YoY</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Charts vs Productivity & Utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '18px' }}>
        {/* Left Side: 2 Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Monthly Trend Chart */}
          <div className="dark-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="dark-card-title" style={{ margin: 0 }}>
                Arus petikemas bulanan (ribu TEUs)
              </div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, backgroundColor: '#64748b', borderRadius: 2 }} /> 2025
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, backgroundColor: '#0284c7', borderRadius: 2 }} /> 2026
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 2, backgroundColor: '#f97316' }} /> RKAP 2026
                </span>
              </div>
            </div>

            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px' }} />
                  <Bar dataKey="y2025" fill="#64748b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="y2026" fill="#0284c7" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="rkap2026" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Terminal Horizontal Comparison */}
          <div className="dark-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div className="dark-card-title" style={{ margin: 0 }}>
                Petikemas per terminal (TEUs)
              </div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, backgroundColor: '#0284c7', borderRadius: 2 }} /> 2026
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 10, height: 10, backgroundColor: '#64748b', borderRadius: 2 }} /> 2025
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 2, backgroundColor: '#f97316' }} /> RKAP
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {terminalData.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <div style={{ width: '130px', fontWeight: 600, color: '#ffffff' }}>{t.name}</div>
                  <div style={{ flex: 1, margin: '0 16px' }}>
                    <div style={{ height: '14px', backgroundColor: '#0f1c30', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div
                        style={{
                          width: `${(t.y2026 / 450) * 100}%`,
                          backgroundColor: '#0284c7',
                          borderRadius: '4px 0 0 4px',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '140px', justifyContent: 'flex-end', fontSize: '11.5px' }}>
                    <strong className={t.rkapPct.startsWith('1') ? 'text-positive' : 'text-alert'}>{t.rkapPct}</strong>
                    <strong className={t.yoy.startsWith('+') ? 'text-positive' : 'text-negative'}>{t.yoy}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Productivity & Utilization */}
        <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dark-card-title">Produktivitas & utilisasi</div>

          {/* 4 Gauges Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* BOR */}
            <div style={{ backgroundColor: '#0e1c30', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>66%</div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>BOR • batas 70%</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 63%</div>
            </div>

            {/* YOR */}
            <div style={{ backgroundColor: '#0e1c30', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>61%</div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>YOR • batas 65%</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 64%</div>
            </div>

            {/* BSH */}
            <div style={{ backgroundColor: '#0e1c30', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>58,4</div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>BSH • RKAP 60</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 55,1</div>
            </div>

            {/* BCH */}
            <div style={{ backgroundColor: '#0e1c30', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>26,3</div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>BCH • RKAP 27</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 25,0</div>
            </div>
          </div>

          {/* Port Stay & ET:BT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Port stay</div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff' }}>1,6 hari</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 1,8 hari</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>ET : BT</div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#ffffff' }}>82%</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>2025: 79%</div>
            </div>
          </div>

          {/* Multipurpose List */}
          <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Balikpapan • 4,82 jt ton</span>
              <strong className="text-positive">102,6%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pantoloan • 2,16 jt ton</span>
              <strong className="text-alert">93,9%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ternate • 1,34 jt ton</span>
              <strong className="text-positive">103,1%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
