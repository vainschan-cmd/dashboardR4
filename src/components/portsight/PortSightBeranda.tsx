'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Wrench, Headphones, TrendingUp, TrendingDown } from 'lucide-react';
import { formatRupiahFull } from '@/lib/formatters';

interface PortSightBerandaProps {
  onSelectTerminal: (terminalId: string) => void;
  onOpenDrilldown: (item: any) => void;
}

export default function PortSightBeranda({
  onSelectTerminal,
  onOpenDrilldown,
}: PortSightBerandaProps) {
  const [finTotals, setFinTotals] = useState({
    revRp: 6776855346193,
    opRp: 1637023735380,
  });

  useEffect(() => {
    async function loadFin() {
      try {
        const res = await fetch('/api/modules-data');
        const json = await res.json();
        if (json.success && json.finansial) {
          const revRows = json.finansial.filter((d: any) => d.rekening.toLowerCase().includes('pendapatan'));
          const opRows = json.finansial.filter((d: any) => d.rekening.toLowerCase() === 'laba usaha');
          const rev = revRows.reduce((a: number, b: any) => a + (b.konsolidasiRp || 0), 0);
          const op = opRows.reduce((a: number, b: any) => a + (b.konsolidasiRp || 0), 0);
          if (rev > 0) {
            setFinTotals({ revRp: rev, opRp: op });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadFin();
  }, []);

  const topKpis = [
    {
      title: 'Petikemas (TEUs)',
      value: '1,04 jt',
      comp1: 'RKAP 101,3%',
      comp1Good: true,
      comp2: 'YoY +5,5%',
      comp2Good: true,
      rawTarget: '1.026.000 TEUs',
      rawRealization: '1.040.100 TEUs',
    },
    {
      title: 'Barang (ton)',
      value: '8,32 jt',
      comp1: 'RKAP 100,2%',
      comp1Good: true,
      comp2: 'YoY +4,3%',
      comp2Good: true,
      rawTarget: '8.300.000 Ton',
      rawRealization: '8.320.000 Ton',
    },
    {
      title: 'Pendapatan',
      value: formatRupiahFull(finTotals.revRp),
      comp1: 'RKAP 101,8%',
      comp1Good: true,
      comp2: 'YoY +7,6%',
      comp2Good: true,
      rawTarget: formatRupiahFull(Math.round(finTotals.revRp / 1.018)),
      rawRealization: formatRupiahFull(finTotals.revRp),
    },
    {
      title: 'Laba usaha',
      value: formatRupiahFull(finTotals.opRp),
      comp1: 'RKAP 110,0%',
      comp1Good: true,
      comp2: 'YoY +14,2%',
      comp2Good: true,
      rawTarget: formatRupiahFull(Math.round(finTotals.opRp / 1.10)),
      rawRealization: formatRupiahFull(finTotals.opRp),
    },
    {
      title: 'Kesiapan alat',
      value: '93,6%',
      comp1: 'Target 92,0%',
      comp1Good: true,
      comp2: '2025: 92,4%',
      comp2Good: true,
      rawTarget: '92,0%',
      rawRealization: '93,6%',
    },
    {
      title: 'SLA keluhan',
      value: '91,3%',
      comp1: 'Target 90,0%',
      comp1Good: true,
      comp2: '2025: 84,6%',
      comp2Good: true,
      rawTarget: '90,0%',
      rawRealization: '91,3%',
    },
  ];

  const terminals = [
    {
      id: 'R01',
      code: 'R01',
      name: 'Makassar',
      subtype: 'Multipurpose',
      status: 'Waspada',
      value: '268,4 rb TEUs',
      rkap: 'RKAP 97,6%',
      yoy: 'YoY −1,3%',
      isGood: false,
    },
    {
      id: 'R02',
      code: 'R02',
      name: 'TPK Makassar',
      subtype: 'Petikemas',
      status: 'Baik',
      value: '412,5 rb TEUs',
      rkap: 'RKAP 103,1%',
      yoy: 'YoY +8,5%',
      isGood: true,
    },
    {
      id: 'R04',
      code: 'R04',
      name: 'Balikpapan',
      subtype: 'Multipurpose',
      status: 'Baik',
      value: '4,82 jt ton',
      rkap: 'RKAP 102,6%',
      yoy: 'YoY +5,9%',
      isGood: true,
    },
    {
      id: 'R05',
      code: 'R05',
      name: 'Bitung',
      subtype: 'Multipurpose',
      status: 'Baik',
      value: '1,45 jt ton',
      rkap: 'RKAP 101,2%',
      yoy: 'YoY +4,1%',
      isGood: true,
    },
    {
      id: 'R06',
      code: 'R06',
      name: 'TPK Bitung',
      subtype: 'Petikemas',
      status: 'Baik',
      value: '196,3 rb TEUs',
      rkap: 'RKAP 103,3%',
      yoy: 'YoY +8,0%',
      isGood: true,
    },
    {
      id: 'R07',
      code: 'R07',
      name: 'Ambon',
      subtype: 'Petikemas',
      status: 'Waspada',
      value: '88,7 rb TEUs',
      rkap: 'RKAP 96,4%',
      yoy: 'YoY +4,2%',
      isGood: false,
    },
    {
      id: 'R08',
      code: 'R08',
      name: 'Sorong',
      subtype: 'Petikemas',
      status: 'Baik',
      value: '74,2 rb TEUs',
      rkap: 'RKAP 106,0%',
      yoy: 'YoY +11,1%',
      isGood: true,
    },
    {
      id: 'R24',
      code: 'R24',
      name: 'Makassar New Port',
      subtype: 'Petikemas Modern',
      status: 'Baik',
      value: '385,0 rb TEUs',
      rkap: 'RKAP 104,8%',
      yoy: 'YoY +12,4%',
      isGood: true,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 6 Top KPI Cards */}
      <div className="kpi-row-6">
        {topKpis.map((kpi, idx) => (
          <div
            key={idx}
            className="kpi-summary-box"
            onClick={() => onOpenDrilldown(kpi)}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpi-header-label">{kpi.title}</div>
            <div className="kpi-huge-number">{kpi.value}</div>
            <div className="kpi-comparison-rows">
              <div className={kpi.comp1Good ? 'text-positive' : 'text-alert'}>
                <strong>{kpi.comp1}</strong>
              </div>
              <div className={kpi.comp2Good ? 'text-positive' : 'text-alert'}>
                <strong>{kpi.comp2}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Split: Kinerja per Terminal (4x2) vs Perlu Perhatian */}
      <div className="split-dashboard-layout">
        {/* Left: Kinerja per terminal */}
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '12px' }}>
            Kinerja per terminal
          </div>

          <div className="terminal-grid">
            {terminals.map((t) => (
              <div
                key={t.id}
                className="terminal-card"
                onClick={() => onSelectTerminal(t.id)}
              >
                <div className="terminal-card-top">
                  <div>
                    <div className="terminal-name">{t.name}</div>
                    <div className="terminal-subtype">{t.subtype}</div>
                  </div>
                  <span className={`status-badge-chip ${t.isGood ? 'status-baik' : 'status-waspada'}`}>
                    {t.status}
                  </span>
                </div>

                <div className="terminal-metric-value">{t.value}</div>

                <div className="terminal-card-footer">
                  <span className={t.isGood ? 'text-positive' : 'text-alert'}>
                    {t.rkap}
                  </span>{' '}
                  <span className={t.isGood ? 'text-positive' : 'text-alert'}>
                    {t.yoy}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Perlu Perhatian Card */}
        <div className="attention-card">
          <div className="attention-title">
            <AlertTriangle size={16} color="#fbbf24" />
            <span>Perlu perhatian</span>
          </div>

          <div className="attention-item">
            <div className="attention-item-header">Makassar</div>
            <div className="attention-item-desc">
              Petikemas 97,6% RKAP, turun 1,3% YoY
            </div>
          </div>

          <div className="attention-item">
            <div className="attention-item-header">Pantoloan</div>
            <div className="attention-item-desc">
              Arus barang 93,9% RKAP, turun 2,3% YoY
            </div>
          </div>

          <div className="attention-item">
            <div className="attention-item-header">RTG TPK Makassar</div>
            <div className="attention-item-desc">
              3 unit dalam pemeliharaan, kesiapan operasional 93,6%
            </div>
          </div>

          <div className="attention-item">
            <div className="attention-item-header">Layanan pelanggan</div>
            <div className="attention-item-desc">
              2 tiket lewat SLA (RTG, gate)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
