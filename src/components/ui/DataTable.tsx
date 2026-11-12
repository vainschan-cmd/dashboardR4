'use client';

import React, { useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { MonthlyRecord } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface DataTableProps {
  records: MonthlyRecord[];
  onSelectRecord?: (record: MonthlyRecord) => void;
  showBranchColumn?: boolean;
}

export default function DataTable({
  records,
  onSelectRecord,
  showBranchColumn = true,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof MonthlyRecord>('indicator_code');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: keyof MonthlyRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (field: keyof MonthlyRecord) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} aria-hidden="true" style={{ opacity: 0.55 }} />;
    }
    return sortAsc ? (
      <ArrowUp size={12} aria-hidden="true" color="var(--blue-500)" />
    ) : (
      <ArrowDown size={12} aria-hidden="true" color="var(--blue-500)" />
    );
  };

  const getAriaSort = (field: keyof MonthlyRecord): 'ascending' | 'descending' | 'none' => {
    if (sortField !== field) return 'none';
    return sortAsc ? 'ascending' : 'descending';
  };

  const filtered = records.filter((r) => {
    const text = `${r.indicator_code || ''} ${r.indicator_name || ''} ${r.branch_name || ''} ${r.department_name || ''} ${r.notes || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  filtered.sort((a, b) => {
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const sortBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'transparent',
    border: 'none',
    padding: '2px 4px',
    margin: '-2px -4px',
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    borderRadius: '4px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            aria-label="Cari indikator, cabang, atau kode"
            className="form-input"
            style={{ paddingLeft: '36px', height: '38px', fontSize: '12px' }}
            placeholder="Cari indikator, cabang, kode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Menampilkan <strong>{filtered.length}</strong> dari {records.length} indikator
        </div>
      </div>

      <div className="table-responsive">
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={getAriaSort('indicator_code')}>
                <button
                  type="button"
                  onClick={() => handleSort('indicator_code')}
                  style={sortBtnStyle}
                  aria-label={`Urutkan berdasarkan Kode (${sortField === 'indicator_code' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                >
                  <span>Kode</span>
                  {renderSortIcon('indicator_code')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('indicator_name')}>
                <button
                  type="button"
                  onClick={() => handleSort('indicator_name')}
                  style={sortBtnStyle}
                  aria-label={`Urutkan berdasarkan Nama Indikator (${sortField === 'indicator_name' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                >
                  <span>Nama Indikator</span>
                  {renderSortIcon('indicator_name')}
                </button>
              </th>
              {showBranchColumn && (
                <th scope="col" aria-sort={getAriaSort('branch_name')}>
                  <button
                    type="button"
                    onClick={() => handleSort('branch_name')}
                    style={sortBtnStyle}
                    aria-label={`Urutkan berdasarkan Cabang (${sortField === 'branch_name' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                  >
                    <span>Cabang</span>
                    {renderSortIcon('branch_name')}
                  </button>
                </th>
              )}
              <th scope="col" style={{ textAlign: 'right' }} aria-sort={getAriaSort('target')}>
                <button
                  type="button"
                  onClick={() => handleSort('target')}
                  style={{ ...sortBtnStyle, justifyContent: 'flex-end', width: '100%' }}
                  aria-label={`Urutkan berdasarkan Target (${sortField === 'target' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                >
                  <span>Target</span>
                  {renderSortIcon('target')}
                </button>
              </th>
              <th scope="col" style={{ textAlign: 'right' }} aria-sort={getAriaSort('realization')}>
                <button
                  type="button"
                  onClick={() => handleSort('realization')}
                  style={{ ...sortBtnStyle, justifyContent: 'flex-end', width: '100%' }}
                  aria-label={`Urutkan berdasarkan Realisasi (${sortField === 'realization' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                >
                  <span>Realisasi</span>
                  {renderSortIcon('realization')}
                </button>
              </th>
              <th scope="col" style={{ textAlign: 'center' }}>Satuan</th>
              <th scope="col" style={{ textAlign: 'right' }} aria-sort={getAriaSort('achievement_pct')}>
                <button
                  type="button"
                  onClick={() => handleSort('achievement_pct')}
                  style={{ ...sortBtnStyle, justifyContent: 'flex-end', width: '100%' }}
                  aria-label={`Urutkan berdasarkan Capaian (${sortField === 'achievement_pct' ? (sortAsc ? 'naik' : 'turun') : 'belum diurutkan'})`}
                >
                  <span>Capaian (%)</span>
                  {renderSortIcon('achievement_pct')}
                </button>
              </th>
              <th scope="col" style={{ textAlign: 'center' }}>Status KPI</th>
              <th scope="col" style={{ textAlign: 'center' }}>Verifikasi</th>
              <th scope="col" style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showBranchColumn ? 10 : 9} style={{ textAlign: 'center', padding: '32px' }}>
                  {/* `COPY-08`: an empty table has two possible causes and the old
                      copy named neither. Say why, and give the reader the one
                      action that changes the outcome. */}
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>
                    {records.length === 0
                      ? 'Belum ada data kinerja pada periode dan cabang yang dipilih.'
                      : 'Tidak ada baris yang cocok dengan kata kunci pencarian.'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>
                    {records.length === 0
                      ? 'Coba pilih periode lain, atau masukkan data melalui Input Manual bila memang belum dilaporkan.'
                      : `Kata kunci "${searchTerm}" tidak ditemukan pada kode, nama indikator, cabang, atau catatan.`}
                  </div>
                  {searchTerm.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: '32px' }}
                      onClick={() => setSearchTerm('')}
                    >
                      Hapus kata kunci pencarian
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                    {r.indicator_code || r.indicator_id}
                  </td>
                  <td data-label="Nama Indikator" style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
                    {r.indicator_name || r.indicator_id}
                  </td>
                  {showBranchColumn && (
                    <td data-label="Cabang" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {r.branch_name || r.branch_code}
                    </td>
                  )}
                  <td data-label="Target" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {r.target.toLocaleString('id-ID')}
                  </td>
                  <td data-label="Realisasi" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {r.realization.toLocaleString('id-ID')}
                  </td>
                  <td data-label="Satuan" style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {r.unit}
                  </td>
                  <td data-label="Capaian (%)" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    <span
                      style={{
                        color:
                          r.status_color === 'green'
                            ? '#059669'
                            : r.status_color === 'yellow'
                              ? '#d97706'
                              : '#dc2626',
                      }}
                    >
                      {r.achievement_pct}%
                    </span>
                  </td>
                  <td data-label="Status KPI" style={{ textAlign: 'center' }}>
                    <StatusBadge type="traffic_light" color={r.status_color} />
                  </td>
                  <td data-label="Verifikasi" style={{ textAlign: 'center' }}>
                    <StatusBadge type="verification" verificationStatus={r.verification_status} />
                  </td>
                  <td data-label="Aksi" style={{ textAlign: 'center' }}>
                    {onSelectRecord && (
                      <button
                        type="button"
                        onClick={() => onSelectRecord(r)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', height: '28px' }}
                        title="Lihat Detail & Audit"
                        aria-label={`Lihat detail dan audit untuk ${r.indicator_name || r.indicator_code}`}
                      >
                        <Eye size={13} aria-hidden="true" />
                        <span>Detail</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
