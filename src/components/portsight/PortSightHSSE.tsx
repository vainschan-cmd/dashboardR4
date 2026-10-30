'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function PortSightHSSE() {
  const patrolTrend = [
    { month: 'Jan', y2025: 34, y2026: 24 },
    { month: 'Feb', y2025: 30, y2026: 22 },
    { month: 'Mar', y2025: 33, y2026: 27 },
    { month: 'Apr', y2025: 31, y2026: 25 },
    { month: 'Mei', y2025: 34, y2026: 28 },
    { month: 'Jun', y2025: 33, y2026: 26 },
    { month: 'Jul', y2025: 35, y2026: 29 },
    { month: 'Agu', y2025: 34, y2026: 31 },
    { month: 'Sep', y2025: 30, y2026: 26 },
  ];

  const heatmapTerminals = [
    { name: 'New Makassar', apd: 18, rapi: 14, lalin: 12, alat: 9, listrik: 5 },
    { name: 'Makassar', apd: 12, rapi: 10, lalin: 9, alat: 6, listrik: 4 },
    { name: 'Bitung', apd: 9, rapi: 8, lalin: 7, alat: 5, listrik: 3 },
    { name: 'Ambon', apd: 6, rapi: 5, lalin: 4, alat: 3, listrik: 2 },
    { name: 'Sorong', apd: 5, rapi: 4, lalin: 4, alat: 2, listrik: 2 },
    { name: 'Balikpapan', apd: 10, rapi: 8, lalin: 6, alat: 5, listrik: 3 },
    { name: 'Pantoloan', apd: 6, rapi: 5, lalin: 4, alat: 3, listrik: 2 },
    { name: 'Ternate', apd: 5, rapi: 4, lalin: 4, alat: 3, listrik: 2 },
  ];

  const getHeatmapBg = (val: number) => {
    if (val >= 13) return '#b91c1c'; // dark red
    if (val >= 9) return '#c2410c'; // red-orange
    if (val >= 5) return '#d97706'; // amber
    return '#854d0e'; // muted amber/yellow
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 4 Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '12px' }}>
        <div className="dark-card" style={{ backgroundColor: '#064e3b', borderColor: '#059669' }}>
          <div className="kpi-header-label" style={{ color: '#a7f3d0' }}>Hari tanpa LTI</div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, margin: '4px 0' }}>214</div>
          <div style={{ fontSize: '11px', color: '#d1fae5' }}>
            LTI terakhir 21 Mar 2026 • <strong>Rekor 2025: 187 hari</strong>
          </div>
        </div>

        <div className="dark-card">
          <div className="kpi-header-label">Patroli YTD</div>
          <div className="kpi-huge-number">186</div>
          <div className="kpi-comparison-rows">target 180</div>
        </div>

        <div className="dark-card">
          <div className="kpi-header-label">Temuan ditutup</div>
          <div className="kpi-huge-number" style={{ color: '#34d399' }}>95,4%</div>
          <div className="kpi-comparison-rows">227 dari 238</div>
        </div>

        <div className="dark-card">
          <div className="kpi-header-label">Temuan YoY</div>
          <div className="kpi-huge-number" style={{ color: '#34d399' }}>−17,4%</div>
          <div className="kpi-comparison-rows">238 vs 288</div>
        </div>
      </div>

      {/* Main 3-Column: Pyramid vs Patrol Trend & Feed vs Heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 340px', gap: '18px' }}>
        {/* Left: Piramida Keselamatan YTD */}
        <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="dark-card-title">Piramida keselamatan YTD</div>

          <div style={{ backgroundColor: '#7f1d1d', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>Fatality: 0</div>
            <div style={{ fontSize: '10.5px', color: '#fca5a5' }}>2025: 0</div>
          </div>

          <div style={{ backgroundColor: '#991b1b', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>LTI: 1</div>
            <div style={{ fontSize: '10.5px', color: '#fca5a5' }}>2025: 2</div>
          </div>

          <div style={{ backgroundColor: '#c2410c', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>Accident: 3</div>
            <div style={{ fontSize: '10.5px', color: '#fed7aa' }}>2025: 5</div>
          </div>

          <div style={{ backgroundColor: '#ea580c', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>Near miss: 14</div>
            <div style={{ fontSize: '10.5px', color: '#ffedd5' }}>2025: 11 (pelaporan naik)</div>
          </div>

          <div style={{ backgroundColor: '#d97706', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>Unsafe condition: 96</div>
            <div style={{ fontSize: '10.5px', color: '#fef3c7' }}>2025: 118</div>
          </div>

          <div style={{ backgroundColor: '#ca8a04', borderRadius: '4px', padding: '8px', textAlign: 'center', color: '#ffffff' }}>
            <div style={{ fontWeight: 800, fontSize: '13px' }}>Unsafe act: 142</div>
            <div style={{ fontSize: '10.5px', color: '#fef9c3' }}>2025: 165</div>
          </div>
        </div>

        {/* Center: Temuan patroli per bulan + Temuan terbaru */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Chart */}
          <div className="dark-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div className="dark-card-title" style={{ margin: 0 }}>Temuan patroli per bulan</div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 2, backgroundColor: '#64748b' }} /> 2025
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 2, backgroundColor: '#0284c7' }} /> 2026
                </span>
              </div>
            </div>

            <div style={{ height: '170px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={patrolTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="y2025" stroke="#64748b" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="y2026" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Temuan Terbaru Feed */}
          <div className="dark-card">
            <div className="dark-card-title">Temuan terbaru</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#0e1c30', borderRadius: '6px', borderLeft: '3px solid #f97316' }}>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>Unsafe act • operator tanpa APD</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>New Makassar • Blok B • terbuka</div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#0e1c30', borderRadius: '6px', borderLeft: '3px solid #fbbf24' }}>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>Unsafe condition • lampu yard padam</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Makassar • Blok D • dalam perbaikan</div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#0e1c30', borderRadius: '6px', borderLeft: '3px solid #34d399' }}>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>Near miss • head truck di jalur gate</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Bitung • Gate 2 • selesai</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Peta Temuan Terminal x Kategori */}
        <div className="dark-card">
          <div className="dark-card-title">Peta temuan: terminal × kategori</div>
          <table className="dark-table" style={{ fontSize: '11.5px' }}>
            <thead>
              <tr>
                <th>Terminal</th>
                <th style={{ textAlign: 'center' }}>APD</th>
                <th style={{ textAlign: 'center' }}>Rapi</th>
                <th style={{ textAlign: 'center' }}>Lalin</th>
                <th style={{ textAlign: 'center' }}>Alat</th>
                <th style={{ textAlign: 'center' }}>Listrik</th>
              </tr>
            </thead>
            <tbody>
              {heatmapTerminals.map((t, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{t.name}</td>
                  <td style={{ textAlign: 'center', backgroundColor: getHeatmapBg(t.apd), color: '#ffffff', fontWeight: 700 }}>{t.apd}</td>
                  <td style={{ textAlign: 'center', backgroundColor: getHeatmapBg(t.rapi), color: '#ffffff', fontWeight: 700 }}>{t.rapi}</td>
                  <td style={{ textAlign: 'center', backgroundColor: getHeatmapBg(t.lalin), color: '#ffffff', fontWeight: 700 }}>{t.lalin}</td>
                  <td style={{ textAlign: 'center', backgroundColor: getHeatmapBg(t.alat), color: '#ffffff', fontWeight: 700 }}>{t.alat}</td>
                  <td style={{ textAlign: 'center', backgroundColor: getHeatmapBg(t.listrik), color: '#ffffff', fontWeight: 700 }}>{t.listrik}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Heatmap Legend */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '10.5px', marginTop: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#854d0e', borderRadius: 2 }} /> ≤4
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#d97706', borderRadius: 2 }} /> 5–8
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#c2410c', borderRadius: 2 }} /> 9–12
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#b91c1c', borderRadius: 2 }} /> ≥13
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
