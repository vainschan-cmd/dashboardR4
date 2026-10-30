'use client';

import React from 'react';

export default function PortSightPelanggan() {
  const tickets = [
    { id: 'KL-1031', terminal: 'New Makassar', category: 'Aplikasi', age: '3 jam', status: 'Diproses', statusClass: 'status-baik' },
    { id: 'KL-1029', terminal: 'Bitung', category: 'RTG', age: '9 jam', status: 'Diproses', statusClass: 'status-baik' },
    { id: 'KL-1027', terminal: 'Makassar', category: 'CC', age: '14 jam', status: 'Diproses', statusClass: 'status-baik' },
    { id: 'KL-1024', terminal: 'New Makassar', category: 'Tagihan', age: '20 jam', status: 'Hampir SLA', statusClass: 'status-waspada' },
    { id: 'KL-1019', terminal: 'New Makassar', category: 'RTG', age: '31 jam', status: 'Lewat SLA', statusClass: 'status-danger' },
    { id: 'KL-1016', terminal: 'Ambon', category: 'RS', age: '11 jam', status: 'Diproses', statusClass: 'status-baik' },
    { id: 'KL-1012', terminal: 'Makassar', category: 'Gate', age: '40 jam', status: 'Lewat SLA', statusClass: 'status-danger' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Row: 3 Blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 240px 1fr', gap: '14px' }}>
        {/* Kepatuhan SLA Gauge Card */}
        <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="kpi-header-label" style={{ marginBottom: '8px' }}>Kepatuhan SLA</div>
          <div style={{
            width: '120px',
            height: '60px',
            borderTopLeftRadius: '120px',
            borderTopRightRadius: '120px',
            border: '10px solid #059669',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '2px',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>91,3%</div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            target 90% • <strong>2025: 84,6%</strong>
          </div>
        </div>

        {/* Indeks Kepuasan Pelanggan */}
        <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#0e1c30' }}>
          <div>
            <div className="kpi-header-label">Indeks kepuasan pelanggan</div>
            <div style={{ fontSize: '38px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>4,21</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>skala 1–5</div>
          </div>
          <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: 600, borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            2025: 4,02 (+0,19)
          </div>
        </div>

        {/* Keluhan Masuk YTD & Rata-rata */}
        <div className="dark-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          <div>
            <div className="kpi-header-label">Keluhan masuk YTD</div>
            <div className="kpi-huge-number">312</div>
            <div className="text-positive" style={{ fontSize: '11.5px', fontWeight: 700 }}>−15,9% vs 371</div>
          </div>

          <div>
            <div className="kpi-header-label">Rata-rata penyelesaian</div>
            <div className="kpi-huge-number">18,4 jam</div>
            <div className="text-positive" style={{ fontSize: '11.5px', fontWeight: 700 }}>−29% vs 26,1 jam</div>
          </div>

          <div>
            <div className="kpi-header-label">Tiket terbuka</div>
            <div className="kpi-huge-number">8</div>
            <div className="text-negative" style={{ fontSize: '11.5px', fontWeight: 700 }}>2 lewat SLA</div>
          </div>
        </div>
      </div>

      {/* Bottom Split: Keluhan per Kategori vs Tiket Terbuka Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '18px' }}>
        {/* Keluhan per Kategori Grid */}
        <div className="dark-card">
          <div className="dark-card-title">Keluhan per kategori • 2026 (2025)</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Aplikasi layanan */}
            <div style={{ gridColumn: 'span 2', backgroundColor: '#0284c7', borderRadius: 'var(--radius-md)', padding: '14px', color: '#ffffff' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Aplikasi layanan e-service & billing</div>
              <div style={{ fontSize: '32px', fontWeight: 900, margin: '4px 0' }}>118</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>2025: 152 • −22%</div>
            </div>

            {/* RTG */}
            <div style={{ backgroundColor: '#0369a1', borderRadius: 'var(--radius-md)', padding: '12px', color: '#ffffff' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600 }}>RTG</div>
              <div style={{ fontSize: '24px', fontWeight: 900, margin: '2px 0' }}>54</div>
              <div style={{ fontSize: '10.5px', opacity: 0.9 }}>2025: 61</div>
            </div>

            {/* Container crane */}
            <div style={{ backgroundColor: '#0369a1', borderRadius: 'var(--radius-md)', padding: '12px', color: '#ffffff' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600 }}>Container crane</div>
              <div style={{ fontSize: '24px', fontWeight: 900, margin: '2px 0' }}>46</div>
              <div style={{ fontSize: '10.5px', opacity: 0.9 }}>2025: 52</div>
            </div>

            {/* Gate & truk */}
            <div style={{ backgroundColor: '#f97316', borderRadius: 'var(--radius-md)', padding: '12px', color: '#ffffff' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600 }}>Gate & truk</div>
              <div style={{ fontSize: '24px', fontWeight: 900, margin: '2px 0' }}>41</div>
              <div style={{ fontSize: '10.5px', opacity: 0.9 }}>2025: 47</div>
            </div>

            {/* Tagihan */}
            <div style={{ backgroundColor: '#ea580c', borderRadius: 'var(--radius-md)', padding: '12px', color: '#ffffff' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600 }}>Tagihan</div>
              <div style={{ fontSize: '24px', fontWeight: 900, margin: '2px 0' }}>31</div>
              <div style={{ fontSize: '10.5px', opacity: 0.9 }}>2025: 34</div>
            </div>
          </div>
        </div>

        {/* Tiket Terbuka Table */}
        <div className="dark-card">
          <div className="dark-card-title">Tiket terbuka (8) • urut terbaru</div>
          <table className="dark-table">
            <thead>
              <tr>
                <th>Tiket</th>
                <th>Terminal</th>
                <th>Kategori</th>
                <th>Umur</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{t.id}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{t.terminal}</td>
                  <td>{t.category}</td>
                  <td>{t.age}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: t.status === 'Diproses' ? '#064e3b' : t.status === 'Hampir SLA' ? '#451a03' : '#4c0519',
                        color: t.status === 'Diproses' ? '#34d399' : t.status === 'Hampir SLA' ? '#fbbf24' : '#f87171',
                        border: `1px solid ${t.status === 'Diproses' ? '#059669' : t.status === 'Hampir SLA' ? '#d97706' : '#dc2626'}`,
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
