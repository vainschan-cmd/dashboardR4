'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, BarChart3, Printer, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { formatRupiahFull } from '@/lib/formatters';
import {
  averageValidMetric,
  canonicalRekening,
  parseMetricPercent,
  parseRealisasi,
} from '@/lib/finansialHelpers';
import { isBranchMatch, getSelectedBranchLabel, parseSelectedBranches } from '@/lib/constants';
import type { FinansialRecord } from '@/lib/types';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  selectedTerminal: string;
}

interface MetricComparisonItem {
  id: string;
  category: 'opkom' | 'finansial' | 'operasional';
  name: string;
  satuan: string;
  real2025: number;
  targetRkap: number;
  real2026: number;
  rkaPct: number;
  yoyPct: number;
  gapRkap: number;
  gapYoY: number;
  isGood: boolean;
}

export default function ComparisonModal({
  isOpen,
  onClose,
  selectedPeriod,
  selectedTerminal,
}: ComparisonModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [dataItems, setDataItems] = useState<MetricComparisonItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'opkom' | 'finansial' | 'operasional'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const branchLabel = useMemo(() => {
    return getSelectedBranchLabel(selectedTerminal);
  }, [selectedTerminal]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadComparisonData() {
      try {
        setLoading(true);
        if (selectedTerminal === 'NONE') {
          setDataItems([]);
          setLoading(false);
          return;
        }

        const selectedCodes = parseSelectedBranches(selectedTerminal);
        const isAll = !selectedTerminal || selectedTerminal === 'ALL' || selectedCodes.includes('ALL');
        const isMultiBranch = !isAll && selectedCodes.length > 1;

        const params = new URLSearchParams();
        if (selectedPeriod) params.append('period', selectedPeriod);
        if (selectedTerminal && selectedTerminal !== 'ALL') {
          params.append('branchCode', selectedTerminal);
        }

        const res = await fetch(`/api/modules-data?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const items: MetricComparisonItem[] = [];

          // 1. Process Finansial (9 field standar; mode konsolidasi menjumlahkan seluruh entitas termasuk ELIMINASI)
          const finRows: FinansialRecord[] = json.finansial || [];
          const targetFinRows = finRows.filter(f => isBranchMatch(selectedTerminal, f.KODE_CBG, f.NM_CBG));

          // If multi-branch, keep branches separate; if ALL or single, aggregate across ENTITAS
          const finMap: Record<string, { real: number; rkaArr: number[]; yoyArr: number[]; rekName: string; branchName: string }> = {};
          targetFinRows.forEach(f => {
            const rek = canonicalRekening(f.REKENING);
            const bName = f.NM_CBG || f.KODE_CBG || 'Cabang';
            const key = isMultiBranch ? `[${bName}] ${rek}` : rek;
            if (!finMap[key]) finMap[key] = { real: 0, rkaArr: [], yoyArr: [], rekName: rek, branchName: bName };
            const realVal = parseRealisasi(f.REALISASI);
            finMap[key].real += realVal;
            const rkaParsed = parseMetricPercent(f.RKA);
            const yoyParsed = parseMetricPercent(f.YOY);
            if (realVal !== 0 && rkaParsed !== null) finMap[key].rkaArr.push(rkaParsed);
            if (realVal !== 0 && yoyParsed !== null) finMap[key].yoyArr.push(yoyParsed);
          });

          Object.entries(finMap).forEach(([key, val], idx) => {
            const avgRkaRaw = averageValidMetric(val.rkaArr);
            const avgYoyRaw = averageValidMetric(val.yoyArr);
            const avgRka = typeof avgRkaRaw === 'number' ? avgRkaRaw : 0;
            const avgYoy = typeof avgYoyRaw === 'number' ? avgYoyRaw : 0;
            const targetRkap = avgRka > 0 ? Math.round(val.real / (avgRka / 100)) : val.real;
            const real2025 = avgYoy > 0 ? Math.round(val.real / (avgYoy / 100)) : val.real;
            const isCost = val.rekName.toLowerCase().includes('beban') || val.real < 0;

            items.push({
              id: `fin_${idx}`,
              category: 'finansial',
              name: isMultiBranch ? key : `Keuangan: ${key}`,
              satuan: 'Rp',
              real2025,
              targetRkap,
              real2026: val.real,
              rkaPct: Number(avgRka.toFixed(2)),
              yoyPct: Number(avgYoy.toFixed(2)),
              gapRkap: val.real - targetRkap,
              gapYoY: val.real - real2025,
              isGood: isCost ? (avgRka === 0 || avgRka <= 100) : (avgRka >= 100),
            });
          });

          // 2. Process Opkom
          // Shape of the Opkom rows as serialised by `/api/modules-data`
          // (camelCase, not the snake_case database columns).
          interface OpkomPayloadRow {
            branchCode?: string;
            branchName?: string;
            layanan?: string;
            satuan?: string;
            jumlahRp?: number;
            rka?: number;
            yoy?: number;
          }
          const opRows: OpkomPayloadRow[] = json.opkom || [];
          const targetOpRows = opRows.filter(o => isBranchMatch(selectedTerminal, o.branchCode, o.branchName));

          const opMap: Record<string, { real: number; satuan: string; rkaArr: number[]; yoyArr: number[]; layName: string; branchName: string }> = {};
          targetOpRows.forEach(o => {
            const bName = o.branchName || o.branchCode || 'Cabang';
            const lay = o.layanan || 'LAYANAN';
            const sat = o.satuan || 'Rp';
            const key = isMultiBranch ? `[${bName}] ${lay} (${sat})` : `${lay} (${sat})`;
            if (!opMap[key]) opMap[key] = { real: 0, satuan: sat, rkaArr: [], yoyArr: [], layName: lay, branchName: bName };
            opMap[key].real += (o.jumlahRp || 0);
            if (o.rka) opMap[key].rkaArr.push(o.rka);
            if (o.yoy) opMap[key].yoyArr.push(o.yoy);
          });

          Object.entries(opMap).forEach(([key, val], idx) => {
            const avgRka = val.rkaArr.length > 0 ? (val.rkaArr.reduce((a, b) => a + b, 0) / val.rkaArr.length) : 100;
            const avgYoy = val.yoyArr.length > 0 ? (val.yoyArr.reduce((a, b) => a + b, 0) / val.yoyArr.length) : 100;
            const targetRkap = avgRka > 0 ? Math.round(val.real / (avgRka / 100)) : val.real;
            const real2025 = avgYoy > 0 ? Math.round(val.real / (avgYoy / 100)) : val.real;
            const isRp = val.satuan === 'Rp';

            items.push({
              id: `op_${idx}`,
              category: isRp ? 'opkom' : 'operasional',
              name: isMultiBranch ? `Layanan: ${key}` : `Layanan ${key}`,
              satuan: val.satuan,
              real2025,
              targetRkap,
              real2026: val.real,
              rkaPct: Number(avgRka.toFixed(1)),
              yoyPct: Number(avgYoy.toFixed(1)),
              gapRkap: val.real - targetRkap,
              gapYoY: val.real - real2025,
              isGood: avgRka >= 100,
            });
          });

          setDataItems(items);
        }
      } catch (err) {
        console.error('Error loading comparison modal data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadComparisonData();
  }, [isOpen, selectedPeriod, selectedTerminal]);

  // Filtered Items for Table and Charts
  const filteredItems = useMemo(() => {
    return dataItems.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.satuan.toLowerCase().includes(q);
      }
      return true;
    });
  }, [dataItems, categoryFilter, searchQuery]);

  // Chart Data: Top 6 metrics formatted in Miliar Rp or Thousands for readability
  const chartData = useMemo(() => {
    return filteredItems
      .filter(i => i.satuan === 'Rp' && Math.abs(i.real2026) > 0)
      .slice(0, 6)
      .map(i => ({
        name: i.name.replace('Keuangan: ', '').replace('Layanan ', '').replace(' (Rp)', ''),
        'Realisasi 2025': Number((i.real2025 / 1_000_000_000).toFixed(2)),
        'Target RKAP 2026': Number((i.targetRkap / 1_000_000_000).toFixed(2)),
        'Realisasi 2026': Number((i.real2026 / 1_000_000_000).toFixed(2)),
      }));
  }, [filteredItems]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1060px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a1628',
          border: '1px solid #1e3557',
          borderRadius: '14px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1e3557',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: '#0d1f38',
            borderTopLeftRadius: '14px',
            borderTopRightRadius: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-blue-text)',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                <BarChart3 size={13} />
                Analisis Komparasi Kinerja
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-muted)',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                Periode: {selectedPeriod || 'YTD Sep 2026'}
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--status-good-text)',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                Cabang: {branchLabel}
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>
              Matriks Komparasi Realisasi 2026 vs RKAP vs Realisasi 2025
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Membandingkan realisasi tahun berjalan terhadap target RKAP 2026 dan baseline tahun lalu (2025 YoY) secara menyeluruh.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #1e3557',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Cetak Laporan Komparasi"
            >
              <Printer size={13} />
              Cetak / PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
              title="Tutup Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body Container (Scrollable) */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Memuat data komparasi vs RKAP & 2025...</div>
            </div>
          ) : (
            <>
              {/* Category Filter Tabs & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '4px 0',
                }}
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(
                    [
                      { id: 'all', label: 'Semua Indikator' },
                      { id: 'opkom', label: 'Pendapatan Layanan Opkom' },
                      { id: 'finansial', label: 'Keuangan (Finance)' },
                      { id: 'operasional', label: 'Volume Trafik Operasional' },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCategoryFilter(tab.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: categoryFilter === tab.id ? '1px solid var(--accent-cyan)' : '1px solid #1e3557',
                        backgroundColor: categoryFilter === tab.id ? 'rgba(56, 189, 248, 0.18)' : '#0d1f38',
                        color: categoryFilter === tab.id ? 'var(--text-on-accent)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Cari indikator..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      backgroundColor: '#0d1f38',
                      border: '1px solid #1e3557',
                      borderRadius: '6px',
                      color: 'var(--text-title)',
                      fontSize: '11.5px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Chart Comparison View */}
              {chartData.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#0d1f38',
                    border: '1px solid #1e3557',
                    borderRadius: '10px',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                      Visualisasi Perbandingan 3 Dimensi (Miliar Rp)
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 10, height: 10, backgroundColor: '#64748b', borderRadius: '2px' }} />
                        Realisasi 2025
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 10, height: 10, backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                        Target RKAP 2026
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 10, height: 10, backgroundColor: '#38bdf8', borderRadius: '2px' }} />
                        Realisasi 2026
                      </span>
                    </div>
                  </div>

                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f223d',
                            border: '1px solid #1e3557',
                            borderRadius: '8px',
                            color: 'var(--text-title)',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="Realisasi 2025" fill="#64748b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Target RKAP 2026" fill="var(--status-alert-text)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Realisasi 2026" fill="var(--accent-cyan)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Detailed Comparison Table */}
              <div
                style={{
                  backgroundColor: '#0d1f38',
                  border: '1px solid #1e3557',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }} className="card-table">
                    <thead>
                      <tr style={{ backgroundColor: '#13284a', borderBottom: '1px solid #1e3557', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 700 }}>Indikator / Rekening</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>Satuan</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Realisasi 2025</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Target RKAP 2026</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right', color: 'var(--accent-blue-text)' }}>
                          Realisasi 2026
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>% RKAP</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>YoY Growth</th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Tidak ada data komparasi yang sesuai dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item, idx) => {
                          const formatVal = (v: number) => {
                            if (item.satuan === 'Rp') return formatRupiahFull(v);
                            return `${v.toLocaleString('id-ID')} ${item.satuan}`;
                          };

                          const hasRka = item.rkaPct > 0;
                          const hasYoy = item.yoyPct > 0;
                          const yoyGrowth = item.yoyPct - 100;
                          const isYoYPos = yoyGrowth >= 0;

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid rgba(30, 53, 87, 0.6)',
                                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                              }}
                            >
                              <td data-label="Indikator / Rekening" style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-title)' }}>
                                {item.name}
                              </td>
                              <td data-label="Satuan" style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                                {item.satuan}
                              </td>
                              <td data-label="Realisasi 2025" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {formatVal(item.real2025)}
                              </td>
                              <td data-label="Target RKAP 2026" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--status-alert-text)', fontWeight: 600 }}>
                                {formatVal(item.targetRkap)}
                              </td>
                              <td data-label="Realisasi 2026" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--accent-blue-text)', fontWeight: 700 }}>
                                {formatVal(item.real2026)}
                              </td>
                              <td data-label="% RKAP" style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: !hasRka ? 'var(--text-muted)' : item.rkaPct >= 100 ? 'var(--status-good-text)' : 'var(--status-danger-text)',
                                  }}
                                >
                                  {hasRka ? `${item.rkaPct.toFixed(2)}%` : '-'}
                                </span>
                              </td>
                              <td data-label="YoY Growth" style={{ padding: '10px 14px', textAlign: 'right' }}>
                                {hasYoy ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      fontWeight: 700,
                                      color: isYoYPos ? 'var(--status-good-text)' : 'var(--status-danger-text)',
                                    }}
                                  >
                                    {isYoYPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {item.yoyPct.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>-</span>
                                )}
                              </td>
                              <td data-label="Status" style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    backgroundColor: item.isGood ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: item.isGood ? 'var(--status-good-text)' : 'var(--status-danger-text)',
                                    border: item.isGood ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                >
                                  {item.isGood ? 'Tercapai' : 'Waspada'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #1e3557',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0d1f38',
            borderBottomLeftRadius: '14px',
            borderBottomRightRadius: '14px',
          }}
        >
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Sumber Data: Lembar Kerja Keuangan & Operasional Pelabuhan Terverifikasi
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              backgroundColor: '#1e3557',
              border: '1px solid #2d4f7c',
              borderRadius: '6px',
              color: 'var(--text-title)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
