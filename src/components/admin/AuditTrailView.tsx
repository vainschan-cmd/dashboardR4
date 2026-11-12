'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, RefreshCw } from 'lucide-react';
import { AuditLog } from '@/lib/types';

export default function AuditTrailView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit?limit=150');
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

  const filtered = logs.filter(l => {
    const text = `${l.action} ${l.user_name} ${l.user_role} ${l.entity} ${l.details}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE': return 'badge-green';
      case 'REVISE': return 'badge-red';
      case 'IMPORT': return 'badge-green';
      case 'UPLOAD': return 'badge-yellow';
      case 'CONFIG_UPDATE': return 'badge-neutral';
      case 'EXPORT': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <History size={20} color="var(--accent-blue-text)" />
              <span>Audit Trail & Log Aktivitas Sistem</span>
            </h2>
            <p className="card-subtitle">
              Pencatatan rekam jejak kepatuhan untuk setiap aksi login, unggah data, verifikasi persetujuan, revisi, dan ekspor laporan.
            </p>
          </div>

          <button onClick={fetchLogs} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            <span>Perbarui Log</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ position: 'relative', minWidth: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '12px' }}
              placeholder="Cari audit log, nama user, aksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Total <strong style={{ color: 'var(--text-title)' }}>{filtered.length}</strong> rekam jejak audit tersimpan
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat rekam audit...</div>
        ) : (
          <div className="table-responsive">
            <table className="card-table data-table">
              <thead>
                <tr>
                  <th scope="col">Waktu / Timestamp</th>
                  <th scope="col">Pengguna (User)</th>
                  <th scope="col">Role</th>
                  <th scope="col">Tindakan (Action)</th>
                  <th scope="col">Entitas Objek</th>
                  <th scope="col">Rincian Aktivitas</th>
                  <th scope="col">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Waktu / Timestamp" style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td data-label="Pengguna (User)" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{log.user_name}</td>
                    <td data-label="Role">
                      <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                        {log.user_role}
                      </span>
                    </td>
                    <td data-label="Tindakan (Action)">
                      <span className={`badge ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td data-label="Entitas Objek" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-blue-text)' }}>{log.entity}</td>
                    <td data-label="Rincian Aktivitas" style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '380px' }}>{log.details}</td>
                    <td data-label="IP Address" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
