'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Building2, Compass, Layers, Warehouse, Search, Waves } from 'lucide-react';

interface FasilitasItem {
  year: number;
  month: number;
  branchCode: string;
  branchName: string;
  namaFasilitas: string;
  jenisFasilitas: string;
  panjangM: number;
  lebarM: number;
  mLws: number;
  luasSqm: number;
  kapasitas: string | null;
  keterangan: string;
}

interface PortSightFasilitasProps {
  selectedTerminal?: string;
}

export default function PortSightFasilitas({ selectedTerminal = 'ALL' }: PortSightFasilitasProps) {
  const [data, setData] = useState<FasilitasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules-data`);
        const json = await res.json();
        if (json.success && json.fasilitas) {
          setData(json.fasilitas);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredData = data.filter(d => {
    if (selectedTerminal !== 'ALL') {
      const matchTerminal =
        d.branchCode === selectedTerminal ||
        `term_${d.branchName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` === selectedTerminal;
      if (!matchTerminal) return false;
    }
    if (selectedJenis !== 'ALL') {
      if (selectedJenis === 'Dermaga' && !d.jenisFasilitas.toLowerCase().includes('dermaga')) return false;
      if (selectedJenis === 'Lapangan' && !d.jenisFasilitas.toLowerCase().includes('lapangan')) return false;
      if (selectedJenis === 'Gudang' && !d.jenisFasilitas.toLowerCase().includes('gudang')) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !d.branchName.toLowerCase().includes(q) &&
        !d.namaFasilitas.toLowerCase().includes(q) &&
        !d.branchCode.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Calculate aggregates
  const totalDermagaM = filteredData
    .filter(d => d.jenisFasilitas.toLowerCase().includes('dermaga'))
    .reduce((acc, cur) => acc + (cur.panjangM || 0), 0);

  const totalLapanganSqm = filteredData
    .filter(d => d.jenisFasilitas.toLowerCase().includes('lapangan'))
    .reduce((acc, cur) => acc + (cur.luasSqm || 0), 0);

  const totalGudangSqm = filteredData
    .filter(d => d.jenisFasilitas.toLowerCase().includes('gudang'))
    .reduce((acc, cur) => acc + (cur.luasSqm || 0), 0);

  const maxDepthMlws = filteredData.reduce((acc, cur) => {
    if (cur.mLws < 0 && cur.mLws < acc) return cur.mLws;
    return acc;
  }, -9);

  // Chart data: Top Wharfs length
  const wharfByBranch: Record<string, { code: string; name: string; panjang: number }> = {};
  filteredData
    .filter(d => d.jenisFasilitas.toLowerCase().includes('dermaga'))
    .forEach(d => {
      if (!wharfByBranch[d.branchCode]) {
        wharfByBranch[d.branchCode] = { code: d.branchCode, name: d.branchName, panjang: 0 };
      }
      wharfByBranch[d.branchCode].panjang += d.panjangM || 0;
    });

  const chartData = Object.values(wharfByBranch)
    .sort((a, b) => b.panjang - a.panjang)
    .slice(0, 10)
    .map(b => ({
      name: b.name.length > 10 ? b.name.slice(0, 8) + '..' : b.name,
      fullName: `[${b.code}] ${b.name}`,
      panjang: b.panjang,
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="dark-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Panjang Dermaga</span>
            <Building2 size={20} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {totalDermagaM.toLocaleString('id-ID')} Meter
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Tambatan kapal operasional Regional 4
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Luas Lapangan</span>
            <Layers size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {(totalLapanganSqm / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ribu m&sup2;
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Kapasitas lapangan penumpukan kargo & box
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Total Luas Gudang</span>
            <Warehouse size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {totalGudangSqm.toLocaleString('id-ID')} m&sup2;
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Gudang tertutup CFS & general cargo
          </div>
        </div>

        <div className="dark-card" style={{ borderLeft: '4px solid #06b6d4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-header-label">Kedalaman Kolam Maksimum</span>
            <Waves size={20} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
            {maxDepthMlws} mLWS
          </div>
          <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
            Dapat disandari kapal kargo samudera
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Kapasitas Panjang Dermaga Total (Meter) per Cabang Utama
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Panjang fasilitas dermaga tambat kapal komersial
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>Sumber: Sheet fasilitas (2)</span>
        </div>

        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e3557" />
              <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#14233c', border: '1px solid #1e3557', borderRadius: '8px', color: '#fff' }}
                formatter={(val: any) => [`${val} Meter`, 'Panjang Dermaga']}
              />
              <Bar dataKey="panjang" fill="#0284c7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div className="dark-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="dark-card-title" style={{ margin: 0 }}>
              Tabel Inventaris Fasilitas Pelabuhan Regional 4
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Menampilkan {filteredData.length} baris dermaga, lapangan, dan gudang dari sheet fasilitas (2)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
              <input
                type="text"
                className="filter-select"
                placeholder="Cari cabang / fasilitas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', width: '190px' }}
              />
            </div>

            <select
              className="filter-select"
              value={selectedJenis}
              onChange={e => setSelectedJenis(e.target.value)}
            >
              <option value="ALL">Semua Jenis Fasilitas</option>
              <option value="Dermaga">Dermaga</option>
              <option value="Lapangan">Lapangan Penumpukan</option>
              <option value="Gudang">Gudang</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="dark-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Cabang</th>
                <th>Nama Fasilitas</th>
                <th>Jenis Fasilitas</th>
                <th style={{ textAlign: 'right' }}>Panjang (m)</th>
                <th style={{ textAlign: 'right' }}>Lebar (m)</th>
                <th style={{ textAlign: 'center' }}>Kedalaman (mLWS)</th>
                <th style={{ textAlign: 'right' }}>Luas (m&sup2;)</th>
                <th>Kode / Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{r.branchCode}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.branchName}</td>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{r.namaFasilitas}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                      {r.jenisFasilitas}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#cbd5e1' }}>
                    {r.panjangM > 0 ? `${r.panjangM} m` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: '#cbd5e1' }}>
                    {r.lebarM > 0 ? `${r.lebarM} m` : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                    {r.mLws !== 0 ? `${r.mLws} mLWS` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    {r.luasSqm > 0 ? `${r.luasSqm.toLocaleString('id-ID')} m²` : '-'}
                  </td>
                  <td style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    {r.keterangan || r.kapasitas || '-'}
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
