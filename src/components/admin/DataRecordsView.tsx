'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
  Layers,
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';
import { MonthlyRecord, Branch, Department, User, UserRole } from '@/lib/types';
import StatusBadge from '../ui/StatusBadge';

interface DataRecordsViewProps {
  branches: Branch[];
  departments: Department[];
  userRole?: UserRole;
  currentUser?: User | null;
  onRefreshNeeded?: () => void;
}

export default function DataRecordsView({
  branches,
  departments,
  userRole,
  currentUser,
  onRefreshNeeded,
}: DataRecordsViewProps) {
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isPicCabang = userRole === 'pic_cabang' || (currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99');
  const userBranchObj = currentUser?.branch_id ? branches.find(b => b.code === currentUser.branch_id || b.id === currentUser.branch_id) : undefined;

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    if (isPicCabang && userBranchObj) {
      return userBranchObj.id;
    }
    return 'ALL';
  });
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/records');
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Filtered records
  const filteredRecords = records.filter((r) => {
    if (selectedBranch !== 'ALL' && r.branch_id !== selectedBranch) return false;
    if (selectedDept !== 'ALL' && r.department_id !== selectedDept) return false;
    if (selectedMonth !== 'ALL' && r.month !== parseInt(selectedMonth, 10)) return false;
    if (selectedStatus !== 'ALL' && r.verification_status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (r.indicator_name || '').toLowerCase().includes(q) ||
        (r.indicator_code || '').toLowerCase().includes(q) ||
        (r.branch_name || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Summary counts
  const totalCount = records.length;
  const verifiedCount = records.filter(r => r.verification_status === 'verified').length;
  const pendingCount = records.filter(r => r.verification_status === 'pending_verification').length;
  const revisionCount = records.filter(r => r.verification_status === 'revision_needed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={15} color="#38bdf8" />
            <span>Total Record Tersimpan</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
            {totalCount.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Database Pelindo Regional 4
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} color="#34d399" />
            <span>Terverifikasi Resmi</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
            {verifiedCount.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Dipublikasikan di Dashboard
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={15} color="#fbbf24" />
            <span>Menunggu Verifikasi</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
            {pendingCount.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Antrean Pengesahan Admin
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={15} color="#f87171" />
            <span>Perlu Revisi</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', marginTop: '6px' }}>
            {revisionCount.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Dikembalikan ke PIC Cabang
          </div>
        </div>
      </div>

      {/* Main Records Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Database size={20} color="#38bdf8" />
              <span>Daftar Data Record Kinerja Pelabuhan (Raw Data)</span>
            </h2>
            <p className="card-subtitle">
              Eksplorasi data berkala bulanan realisasi vs target RKAP per terminal, departemen, dan indikator KPI resmi.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchRecords}
              className="btn btn-secondary btn-sm"
              title="Perbarui data dari database"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', height: '36px', fontSize: '12.5px' }}
              placeholder="Cari indikator, terminal, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Terminal Filter */}
          <select
            className="filter-select"
            style={{
              height: '36px',
              fontSize: '12px',
              opacity: isPicCabang ? 0.9 : 1,
              cursor: isPicCabang ? 'not-allowed' : 'pointer',
            }}
            value={selectedBranch}
            onChange={(e) => {
              if (!isPicCabang) {
                setSelectedBranch(e.target.value);
              }
            }}
            disabled={isPicCabang}
            title={isPicCabang ? `Terkunci: Data khusus cabang ${userBranchObj?.name || currentUser?.branch_id}` : 'Pilih Terminal'}
          >
            {!isPicCabang && <option value="ALL">🏢 Semua Terminal</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id} style={{ background: '#122137' }}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            className="filter-select"
            style={{ height: '36px', fontSize: '12px' }}
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">📂 Semua Departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} style={{ background: '#122137' }}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            className="filter-select"
            style={{ height: '36px', fontSize: '12px' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="ALL">📅 Semua Bulan (YTD)</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => (
              <option key={m} value={m} style={{ background: '#122137' }}>
                Bulan {m} (2026)
              </option>
            ))}
          </select>

          {/* Verification Status Filter */}
          <select
            className="filter-select"
            style={{ height: '36px', fontSize: '12px' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">🛡️ Semua Status Verifikasi</option>
            <option value="verified" style={{ background: '#122137' }}>Terverifikasi</option>
            <option value="pending_verification" style={{ background: '#122137' }}>Menunggu Verifikasi</option>
            <option value="revision_needed" style={{ background: '#122137' }}>Perlu Revisi</option>
          </select>
        </div>

        {/* Counter Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>
            Menampilkan <strong style={{ color: '#ffffff' }}>{filteredRecords.length}</strong> baris data dari total {records.length} record
          </div>
          {(selectedBranch !== 'ALL' || selectedDept !== 'ALL' || selectedMonth !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBranch('ALL');
                setSelectedDept('ALL');
                setSelectedMonth('ALL');
                setSelectedStatus('ALL');
                setSearchQuery('');
              }}
              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
            <div>Memuat data kinerja pelabuhan...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#101c2e', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
            <Database size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Tidak Ada Data Ditemukan</h4>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
              Tidak ada record kinerja yang cocok dengan kombinasi filter yang dipilih.
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '620px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <th>Terminal / Cabang</th>
                  <th>Departemen</th>
                  <th>Periode</th>
                  <th>Indikator KPI</th>
                  <th style={{ textAlign: 'right' }}>Target RKAP</th>
                  <th style={{ textAlign: 'right' }}>Realisasi</th>
                  <th style={{ textAlign: 'center' }}>Satuan</th>
                  <th style={{ textAlign: 'right' }}>Capaian</th>
                  <th style={{ textAlign: 'center' }}>Status KPI</th>
                  <th style={{ textAlign: 'center' }}>Verifikasi</th>
                  <th>Pengunggah</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const branchObj = branches.find(b => b.id === r.branch_id);
                  const deptObj = departments.find(d => d.id === r.department_id);

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        <div>{r.branch_name || branchObj?.name || r.branch_id}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{branchObj?.code}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {deptObj?.code || r.department_id}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                        Bln {r.month}/{r.year}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{r.indicator_name || r.indicator_id}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{r.indicator_code || r.indicator_id}</div>
                      </td>
                      <td style={{ textAlign: 'right', color: '#cbd5e1' }}>
                        {r.target?.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                        {r.realization?.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                        {r.unit}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        <span style={{ color: r.status_color === 'green' ? '#34d399' : r.status_color === 'yellow' ? '#fbbf24' : '#f87171' }}>
                          {r.achievement_pct}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusBadge type="traffic_light" color={r.status_color} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <StatusBadge type="verification" verificationStatus={r.verification_status} />
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <div style={{ color: '#cbd5e1' }}>{r.uploaded_by}</div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          {r.verification_status === 'verified' && r.verified_by ? `Disahkan: ${r.verified_by}` : r.verification_status === 'revision_needed' ? 'Perlu Revisi' : 'Menunggu'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
