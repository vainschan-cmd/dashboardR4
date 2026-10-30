'use client';

import React, { useState, useEffect } from 'react';
import { History, Search, RefreshCw, Shield, User, Clock, CheckCircle2 } from 'lucide-react';
import { AuditLog } from '@/lib/types';

export default function AuditTrailView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
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
  };

  useEffect(() => {
    fetchLogs();
  }, []);

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
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <History size={20} color="var(--blue-primary)" />
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
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
              placeholder="Cari audit log, nama user, aksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Total <strong>{filtered.length}</strong> rekam jejak audit tersimpan
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Memuat rekam audit...</div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu / Timestamp</th>
                  <th>Pengguna (User)</th>
                  <th>Role</th>
                  <th>Tindakan (Action)</th>
                  <th>Entitas Objek</th>
                  <th>Rincian Aktivitas</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{log.user_name}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {log.user_role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>{log.entity}</td>
                    <td style={{ fontSize: '12.5px', color: '#334155', maxWidth: '380px' }}>{log.details}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>
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
