'use client';

import React from 'react';

export default function PortSightTeknik() {
  const ccUnits = [
    { id: 'CC01', status: 'operasi' },
    { id: 'CC02', status: 'operasi' },
    { id: 'CC03', status: 'operasi' },
    { id: 'CC04', status: 'operasi' },
    { id: 'CC05', status: 'operasi' },
    { id: 'CC06', status: 'operasi' },
    { id: 'CC07', status: 'operasi' },
    { id: 'CC08', status: 'operasi' },
    { id: 'CC09', status: 'siaga' },
    { id: 'CC10', status: 'perawatan' },
  ];

  // 30 RTGs
  const rtgUnits = Array.from({ length: 30 }, (_, i) => {
    const num = i + 1;
    const id = `R${String(num).padStart(2, '0')}`;
    let status = 'operasi';
    if ([7, 18, 26].includes(num)) status = 'rusak';
    else if ([12].includes(num)) status = 'perawatan';
    else if ([3, 15, 21, 29].includes(num)) status = 'siaga';
    return { id, status };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operasi': return { bg: '#065f46', text: '#34d399', border: '#059669' };
      case 'siaga': return { bg: '#1e3a5f', text: '#93c5fd', border: '#2563eb' };
      case 'perawatan': return { bg: '#854d0e', text: '#fde047', border: '#ca8a04' };
      case 'rusak': return { bg: '#991b1b', text: '#fca5a5', border: '#dc2626' };
      default: return { bg: '#1e293b', text: '#cbd5e1', border: '#475569' };
    }
  };

  const equipmentTypeRfu = [
    { type: 'Container crane', rfu: 96.2, diff: '+1,4' },
    { type: 'RTG', rfu: 93.1, diff: '+1,7' },
    { type: 'Reach stacker', rfu: 91.8, diff: '+1,3' },
    { type: 'Head truck', rfu: 94.5, diff: '+1,5' },
    { type: 'Mobile crane', rfu: 89.7, diff: '+1,5' },
    { type: 'Forklift', rfu: 95.0, diff: '+0,9' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '18px' }}>
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Status Unit Saat Ini */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>Status unit saat ini</div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669' }} /> Operasi
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb' }} /> Siaga
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ca8a04' }} /> Perawatan
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626' }} /> Rusak
              </span>
            </div>
          </div>

          {/* Container Crane */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Container crane • 8 operasi, 1 siaga, 1 perawatan
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '6px' }}>
              {ccUnits.map((u) => {
                const c = getStatusColor(u.status);
                return (
                  <div
                    key={u.id}
                    style={{
                      backgroundColor: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                      borderRadius: '4px',
                      padding: '8px 0',
                      textAlign: 'center',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {u.id}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RTG */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              RTG • 22 operasi, 4 siaga, 1 perawatan, 3 rusak
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '6px' }}>
              {rtgUnits.map((u) => {
                const c = getStatusColor(u.status);
                return (
                  <div
                    key={u.id}
                    style={{
                      backgroundColor: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                      borderRadius: '4px',
                      padding: '7px 0',
                      textAlign: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {u.id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kesiapan Alat per Jenis */}
        <div className="dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Kesiapan alat per jenis • Regional 4
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 14, height: 2, backgroundColor: '#f97316' }} /> Target 92%
              </span>
              <span>2025</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {equipmentTypeRfu.map((eq, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <div style={{ width: '130px', color: '#ffffff', fontWeight: 600 }}>{eq.type}</div>
                <div style={{ flex: 1, margin: '0 16px', position: 'relative' }}>
                  <div style={{ height: '14px', backgroundColor: '#0e1c30', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${eq.rfu}%`, backgroundColor: '#0284c7', height: '100%', borderRadius: '4px' }} />
                  </div>
                  {/* Target 92% tick */}
                  <div style={{ position: 'absolute', top: -3, left: '92%', width: '2px', height: '20px', backgroundColor: '#f97316' }} />
                </div>
                <div style={{ width: '90px', textAlign: 'right' }}>
                  <strong style={{ color: '#ffffff' }}>{eq.rfu}%</strong>{' '}
                  <span className="text-positive" style={{ fontSize: '11px' }}>{eq.diff}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Key Technical Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* 4 Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="dark-card" style={{ padding: '14px' }}>
            <div className="kpi-header-label">Kesiapan alat R4</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', margin: '4px 0' }}>93,6%</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>+1,2 pp vs 2025</div>
          </div>

          <div className="dark-card" style={{ padding: '14px' }}>
            <div className="kpi-header-label">MTTR</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>3,8 jam</div>
            <div style={{ fontSize: '11px', color: '#34d399' }}>2025: 4,6 jam (−17%)</div>
          </div>

          <div className="dark-card" style={{ padding: '14px' }}>
            <div className="kpi-header-label">MTBF</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>212 jam</div>
            <div style={{ fontSize: '11px', color: '#34d399' }}>2025: 186 jam (+14%)</div>
          </div>

          <div className="dark-card" style={{ padding: '14px' }}>
            <div className="kpi-header-label">Breakdown YTD</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>412</div>
            <div style={{ fontSize: '11px', color: '#34d399' }}>2025: 468 (−12%)</div>
          </div>
        </div>

        {/* Uptime Sistem TI */}
        <div className="dark-card">
          <div className="dark-card-title">Uptime sistem TI • bulan ini</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>TOS</span>
              <strong style={{ color: '#34d399' }}>99,93%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Jaringan</span>
              <strong style={{ color: '#34d399' }}>99,71%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Billing & e-service</span>
              <strong style={{ color: '#34d399' }}>99,88%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>CCTV (3 offline)</span>
              <strong style={{ color: '#fbbf24' }}>97,4%</strong>
            </div>
          </div>
        </div>

        {/* Fasilitas & Instalasi Chips */}
        <div className="dark-card">
          <div className="dark-card-title">Fasilitas & instalasi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Dermaga 1–4 • baik
            </span>
            <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              CY blok A, B, D • baik
            </span>
            <span style={{ backgroundColor: '#451a03', color: '#fbbf24', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              CY blok C • perbaikan
            </span>
            <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Gate in/out • baik
            </span>
            <span style={{ backgroundColor: '#451a03', color: '#fbbf24', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Genset 2 • servis
            </span>
            <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '4px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
              Air bersih • baik
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
