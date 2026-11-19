'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { AuditLog } from '@/lib/types';
import { downloadCsvFile } from '@/lib/governanceNav';

type ActionCategory = 'ALL' | 'LOGIN' | 'APPROVE' | 'REVISE' | 'IMPORT_UPLOAD' | 'CONFIG_UPDATE' | 'EXPORT';

export default function AuditTrailView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionCategory>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit?limit=250');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);

  const distinctRoles = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.user_role) set.add(l.user_role);
    });
    return Array.from(set).sort();
  }, [logs]);

  const actionCounts = useMemo(() => {
    return {
      ALL: logs.length,
      LOGIN: logs.filter((l) => l.action === 'LOGIN').length,
      APPROVE: logs.filter((l) => l.action === 'APPROVE').length,
      REVISE: logs.filter((l) => l.action === 'REVISE').length,
      IMPORT_UPLOAD: logs.filter((l) => l.action === 'IMPORT' || l.action === 'UPLOAD').length,
      CONFIG_UPDATE: logs.filter((l) => l.action === 'CONFIG_UPDATE').length,
      EXPORT: logs.filter((l) => l.action === 'EXPORT').length,
    };
  }, [logs]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return logs.filter((l) => {
      if (actionFilter === 'LOGIN' && l.action !== 'LOGIN') return false;
      if (actionFilter === 'APPROVE' && l.action !== 'APPROVE') return false;
      if (actionFilter === 'REVISE' && l.action !== 'REVISE') return false;
      if (actionFilter === 'IMPORT_UPLOAD' && l.action !== 'IMPORT' && l.action !== 'UPLOAD') {
        return false;
      }
      if (actionFilter === 'CONFIG_UPDATE' && l.action !== 'CONFIG_UPDATE') return false;
      if (actionFilter === 'EXPORT' && l.action !== 'EXPORT') return false;

      if (roleFilter !== 'ALL' && l.user_role !== roleFilter) return false;

      if (fromTime || toTime) {
        const ts = new Date(l.timestamp).getTime();
        if (Number.isFinite(ts)) {
          if (fromTime && ts < fromTime) return false;
          if (toTime && ts > toTime) return false;
        }
      }

      if (!q) return true;
      const text = `${l.action} ${l.user_name} ${l.user_role} ${l.entity} ${l.details} ${l.ip_address || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [logs, actionFilter, roleFilter, dateFrom, dateTo, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedLogs = useMemo(
    () => filtered.slice(startIdx, startIdx + pageSize),
    [filtered, startIdx, pageSize]
  );

  const hasFilters =
    actionFilter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    searchTerm.trim().length > 0;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE':
        return 'badge-green';
      case 'REVISE':
        return 'badge-red';
      case 'IMPORT':
        return 'badge-blue';
      case 'UPLOAD':
        return 'badge-yellow';
      case 'CONFIG_UPDATE':
        return 'badge-neutral';
      case 'EXPORT':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Waktu',
      'Pengguna',
      'Peran',
      'Tindakan',
      'Entitas',
      'Rincian Aktivitas',
      'IP Address',
    ];
    const rows = filtered.map((l) => [
      new Date(l.timestamp).toLocaleString('id-ID'),
      l.user_name,
      l.user_role,
      l.action,
      l.entity,
      l.details,
      l.ip_address || '127.0.0.1',
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`jejak_audit_portsight_${stamp}.csv`, headers, rows);
  };

  const ACTION_PILLS: { id: ActionCategory; label: string }[] = [
    { id: 'ALL', label: `Semua (${actionCounts.ALL})` },
    { id: 'LOGIN', label: `Login & Sesi (${actionCounts.LOGIN})` },
    { id: 'APPROVE', label: `Persetujuan (${actionCounts.APPROVE})` },
    { id: 'REVISE', label: `Revisi (${actionCounts.REVISE})` },
    { id: 'IMPORT_UPLOAD', label: `Impor & Unggah (${actionCounts.IMPORT_UPLOAD})` },
    { id: 'CONFIG_UPDATE', label: `Konfigurasi (${actionCounts.CONFIG_UPDATE})` },
    { id: 'EXPORT', label: `Ekspor (${actionCounts.EXPORT})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <History size={20} color="var(--accent-blue-text)" />
              <span>Jejak Audit Sistem &amp; Kepatuhan</span>
            </h2>
            <p className="card-subtitle">
              Pencatatan rekam jejak kepatuhan untuk setiap aksi autentikasi, impor data, pengesahan, revisi, dan perubahan konfigurasi.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="btn btn-dark btn-sm"
              title="Ekspor hasil filter log audit ke CSV untuk arsip kepatuhan"
            >
              <Download size={14} />
              <span>Ekspor Audit CSV ({filtered.length})</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Action Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {ACTION_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setActionFilter(pill.id);
                setPage(1);
              }}
              className={`role-preset-chip ${actionFilter === pill.id ? 'active' : ''}`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search + Date Range + Role Filter Bar */}
        <div className="gov-filter-bar" style={{ marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Cari pengguna, entitas, rincian, atau alamat IP..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              aria-label="Cari jejak audit"
            />
          </div>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter peran pengguna"
          >
            <option value="ALL">Semua Peran</option>
            {distinctRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} />
              <span>Dari</span>
            </span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal mulai audit"
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>s/d</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal akhir audit"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActionFilter('ALL');
                setRoleFilter('ALL');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="pwd-action-chip"
            >
              Reset Filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="gov-skeleton-stack" aria-label="Memuat jejak audit">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="gov-skeleton-row" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '38px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-inner)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <History size={34} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
              Tidak Ada Rekam Audit yang Cocok
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Sesuaikan filter jenis aksi, rentang tanggal, atau kata kunci pencarian.
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="card-table data-table">
                <thead>
                  <tr>
                    <th scope="col">Waktu / Timestamp</th>
                    <th scope="col">Pengguna</th>
                    <th scope="col">Peran</th>
                    <th scope="col">Tindakan</th>
                    <th scope="col">Entitas</th>
                    <th scope="col">Rincian Aktivitas</th>
                    <th scope="col">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td
                        data-label="Waktu / Timestamp"
                        style={{
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td data-label="Pengguna" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                        {log.user_name}
                      </td>
                      <td data-label="Peran">
                        <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                          {log.user_role}
                        </span>
                      </td>
                      <td data-label="Tindakan">
                        <span className={`badge ${getActionBadge(log.action)}`}>{log.action}</span>
                      </td>
                      <td
                        data-label="Entitas"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: 'var(--accent-blue-text)',
                        }}
                      >
                        {log.entity}
                      </td>
                      <td
                        data-label="Rincian Aktivitas"
                        style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '380px' }}
                      >
                        {log.details}
                      </td>
                      <td
                        data-label="IP Address"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="gov-pagination">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Menampilkan{' '}
                  <strong style={{ color: 'var(--text-title)', fontFamily: 'var(--font-mono)' }}>
                    {startIdx + 1}–{Math.min(startIdx + pageSize, filtered.length)}
                  </strong>{' '}
                  dari{' '}
                  <strong style={{ color: 'var(--text-title)', fontFamily: 'var(--font-mono)' }}>
                    {filtered.length}
                  </strong>{' '}
                  log audit
                </span>

                <select
                  className="filter-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Jumlah baris log per halaman"
                  style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
                >
                  <option value={25}>25 / halaman</option>
                  <option value={50}>50 / halaman</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="pwd-action-chip"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  <span>Sebelumnya</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="pwd-action-chip"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Berikutnya</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
