'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function PortSightKeuangan() {
  const monthlyRevenue = [
    { month: 'Jan', y2025: 200, rkap: 213, y2026: 215 },
    { month: 'Feb', y2025: 195, rkap: 211, y2026: 210 },
    { month: 'Mar', y2025: 210, rkap: 221, y2026: 224 },
    { month: 'Apr', y2025: 208, rkap: 219, y2026: 220 },
    { month: 'Mei', y2025: 214, rkap: 226, y2026: 231 },
    { month: 'Jun', y2025: 212, rkap: 225, y2026: 229 },
    { month: 'Jul', y2025: 218, rkap: 228, y2026: 234 },
    { month: 'Agu', y2025: 222, rkap: 230, y2026: 238 },
    { month: 'Sep', y2025: 223, rkap: 232, y2026: 241.5 },
  ];

  const profitLossRows = [
    { pos: 'Pendapatan usaha', y2026: '2.046,5', rkap: '2.010,0', rkapPct: '101,8%', y2025: '1.902,3', yoy: '+7,6%' },
    { pos: 'Beban usaha', y2026: '1.402,8', rkap: '1.425,0', rkapPct: '98,4%', y2025: '1.338,6', yoy: '+4,8%' },
    { pos: 'EBITDA', y2026: '812,4', rkap: '760,0', rkapPct: '106,9%', y2025: '731,5', yoy: '+11,1%' },
    { pos: 'Laba usaha', y2026: '643,7', rkap: '585,0', rkapPct: '110,0%', y2025: '563,7', yoy: '+14,2%' },
    { pos: 'Laba bersih', y2026: '468,9', rkap: '430,0', rkapPct: '109,0%', y2025: '405,2', yoy: '+15,7%' },
    { pos: 'Margin EBITDA', y2026: '39,7%', rkap: '37,8%', rkapPct: '—', y2025: '38,5%', yoy: '+1,2 pp' },
  ];

  const terminalRev = [
    { name: 'New Makassar', rkapPct: '102,8%', yoy: '+9,5%', widthPct: 88 },
    { name: 'Makassar', rkapPct: '98,7%', yoy: '+1,9%', widthPct: 75, isOrange: true },
    { name: 'Bitung', rkapPct: '103,3%', yoy: '+9,3%', widthPct: 56 },
    { name: 'Ambon', rkapPct: '97,5%', yoy: '+5,8%', widthPct: 35, isOrange: true },
    { name: 'Sorong', rkapPct: '109,4%', yoy: '+14,0%', widthPct: 32 },
    { name: 'Balikpapan', rkapPct: '105,2%', yoy: '+8,0%', widthPct: 38 },
    { name: 'Pantoloan', rkapPct: '96,2%', yoy: '+10,3%', widthPct: 22, isOrange: true },
    { name: 'Ternate', rkapPct: '104,2%', yoy: '+20,7%', widthPct: 18 },
  ];

  // Donut data for 74%
  const donutData = [
    { name: 'Tercapai', value: 74, color: '#f97316' },
    { name: 'Sisa Target', value: 26, color: '#1e3557' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Split: Pendapatan Usaha with Donut vs Pendapatan Bulanan Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '18px' }}>
        {/* Left Box */}
        <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="kpi-header-label">Pendapatan usaha</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
              Rp 2.046,5 M
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
              <span className="text-positive" style={{ fontWeight: 700 }}>101,8% dari RKAP YTD</span>
              <span className="text-positive" style={{ fontWeight: 700 }}>+7,6% dari 2025</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ width: '80px', height: '80px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} innerRadius={26} outerRadius={38} dataKey="value" startAngle={90} endAngle={-270}>
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                74%
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>RKAP 2026 setahun</strong>
              <div>Rp 2.760 M</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>74% tercapai per Sep</div>
            </div>
          </div>
        </div>

        {/* Top Right: Pendapatan Bulanan Chart */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>Pendapatan bulanan</div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 14, height: 2, backgroundColor: '#64748b' }} /> 2025
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 14, height: 2, backgroundColor: '#f97316' }} /> RKAP 2026
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 14, height: 2, backgroundColor: '#0284c7' }} /> Realisasi 2026
              </span>
            </div>
          </div>

          <div style={{ height: '180px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[180, 260]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="y2025" stroke="#64748b" strokeDasharray="3 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="rkap" stroke="#f97316" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="y2026" stroke="#0284c7" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Split: Laba Rugi Ringkas Table vs Pendapatan per Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        {/* Table Laba Rugi */}
        <div className="dark-card">
          <div className="dark-card-title">Laba rugi ringkas</div>
          <table className="dark-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th style={{ textAlign: 'right' }}>2026</th>
                <th style={{ textAlign: 'right' }}>RKAP</th>
                <th style={{ textAlign: 'right' }}>% RKAP</th>
                <th style={{ textAlign: 'right' }}>2025</th>
                <th style={{ textAlign: 'right' }}>YoY</th>
              </tr>
            </thead>
            <tbody>
              {profitLossRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: '#ffffff' }}>{r.pos}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.y2026}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.rkap}</td>
                  <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }}>{r.rkapPct}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.y2025}</td>
                  <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }}>{r.yoy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pendapatan per Terminal */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>Pendapatan per terminal</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>| RKAP</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {terminalRev.map((t, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ width: '105px', fontWeight: 600, color: '#ffffff' }}>{t.name}</div>
                <div style={{ flex: 1, margin: '0 12px' }}>
                  <div style={{ height: '12px', backgroundColor: '#0e1c30', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${t.widthPct}%`, backgroundColor: t.isOrange ? '#f59e0b' : '#0284c7', height: '100%', borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', width: '100px', justifyContent: 'flex-end', fontSize: '11px' }}>
                  <strong className={t.isOrange ? 'text-alert' : 'text-positive'}>{t.rkapPct}</strong>
                  <strong className="text-positive">{t.yoy}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
