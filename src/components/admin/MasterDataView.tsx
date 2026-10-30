'use client';

import React, { useState } from 'react';
import { Database, Building2, Layers, Target, Wrench, CheckCircle2, UserCheck, UserPlus, Download, RefreshCw, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Branch, Department, KPIIndicator, EquipmentItem, User, UserRole } from '@/lib/types';
import AuthModal from '@/components/auth/AuthModal';

interface MasterDataViewProps {
  branches: Branch[];
  departments: Department[];
  indicators: KPIIndicator[];
  equipment?: EquipmentItem[];
  users?: User[];
  onRefreshUsers?: () => void;
}

export default function MasterDataView({
  branches,
  departments,
  indicators,
  equipment = [],
  users = [],
  onRefreshUsers,
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<'kpi' | 'branches' | 'departments' | 'equipment' | 'users'>('users');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filteredIndicators = indicators.filter(i =>
    selectedDeptFilter === 'ALL' || i.department_id === selectedDeptFilter
  );

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/users/sync-drive', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`Spreadsheet master_user_pic.xlsx berhasil diperbarui & disinkronkan ke My Drive (regdashr@gmail.com)`);
        if (onRefreshUsers) onRefreshUsers();
      } else {
        setSyncMessage(`Gagal sinkron: ${data.error}`);
      }
    } catch (e: any) {
      setSyncMessage(`Gagal sinkron: ${e.message}`);
    } finally {
      setSyncingDrive(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus user PIC ${name}?`)) return;
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (onRefreshUsers) onRefreshUsers();
      } else {
        alert(data.error || 'Gagal menghapus user');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Database size={20} color="var(--blue-primary)" />
              <span>Manajemen Master Data Pelabuhan</span>
            </h2>
            <p className="card-subtitle">
              Struktur katalog master cabang pelabuhan, departemen, PIC pengguna, serta definisi indikator KPI dan peralatan operasional.
            </p>
          </div>
        </div>

        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('users')}
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <UserCheck size={16} />
            <span>Master User & PIC ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`tab-btn ${activeTab === 'kpi' ? 'active' : ''}`}
          >
            <Target size={16} />
            <span>Master Indikator & KPI ({indicators.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          >
            <Building2 size={16} />
            <span>Master Cabang Pelabuhan ({branches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Master Departemen ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`tab-btn ${activeTab === 'equipment' ? 'active' : ''}`}
          >
            <Wrench size={16} />
            <span>Master Katalog Peralatan ({equipment.length})</span>
          </button>
        </div>

        {/* TAB: MASTER USER & PIC */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Toolbar: My Drive Integration & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-inner)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                    Spreadsheet Master PIC (master_user_pic.xlsx)
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Tersimpan di My Drive akun: <strong style={{ color: 'var(--accent-blue)' }}>regdashr@gmail.com</strong> (Sinkron dengan Sistem Login)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} />
                  <span>Tambah PIC Baru</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncDrive}
                  disabled={syncingDrive}
                  className="btn-dark"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Sinkronkan data akun ke file master_user_pic.xlsx di My Drive"
                >
                  <RefreshCw size={13} className={syncingDrive ? 'spin' : ''} />
                  <span>{syncingDrive ? 'Menyinkronkan...' : 'Sinkron ke My Drive'}</span>
                </button>

                <a
                  href="/api/users/export"
                  download="master_user_pic.xlsx"
                  className="btn-dark"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  title="Unduh file spreadsheet Excel master PIC"
                >
                  <Download size={13} />
                  <span>Download .xlsx</span>
                </a>
              </div>
            </div>

            {/* Sync Notification Banner */}
            {syncMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#34d399',
                  fontSize: '12px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{syncMessage}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>NIPP (Username)</th>
                    <th>Nama Pegawai</th>
                    <th>Divisi</th>
                    <th>Departemen</th>
                    <th>Hak Akses / Role</th>
                    <th>Penugasan Cabang</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '80px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const roleLabels: Record<string, { label: string; badge: string }> = {
                      super_admin: { label: 'Super Admin', badge: 'badge-blue' },
                      admin_regional: { label: 'Admin Regional 4', badge: 'badge-green' },
                      pic_dept_regional: { label: 'PIC Dept Regional', badge: 'badge-yellow' },
                      pic_cabang: { label: 'PIC Cabang', badge: 'badge-neutral' },
                      viewer: { label: 'BOD (Viewer)', badge: 'badge-neutral' },
                    };
                    const roleInfo = roleLabels[u.role] || { label: u.role, badge: 'badge-neutral' };

                    return (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {u.nipp || u.username}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                          {u.name}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {u.divisi || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {u.departemen || '-'}
                        </td>
                        <td>
                          <span className={`badge ${roleInfo.badge}`}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {u.branch_id ? u.branch_id : 'Regional 4 (Pusat)'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${u.active ? 'badge-green' : 'badge-neutral'}`}>
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {u.username !== '10001' && u.username !== 'superadmin' ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                              title={`Hapus user ${u.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sistem</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        Belum ada data PIC yang terdaftar. Klik tombol "Tambah PIC Baru" untuk mendaftarkan akun.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Tambah User PIC Baru */}
            <AuthModal
              isOpen={isAddUserOpen}
              onClose={() => setIsAddUserOpen(false)}
              currentUser={null}
              initialMode="register"
              onLoginSuccess={() => {
                if (onRefreshUsers) onRefreshUsers();
              }}
            />
          </div>
        )}

        {/* TAB 1: MASTER KPI */}
        {activeTab === 'kpi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Filter Departemen:</span>
              <select
                className="filter-select"
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '220px' }}
              >
                <option value="ALL">Semua Departemen (Semua Indikator)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} style={{ background: '#122137' }}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Indikator</th>
                    <th>Departemen</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'center' }}>Satuan</th>
                    <th style={{ textAlign: 'center' }}>Arah Target</th>
                    <th style={{ textAlign: 'right' }}>Target Standar</th>
                    <th style={{ textAlign: 'center' }}>KPI Utama</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndicators.map((ind) => (
                    <tr key={ind.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>{ind.code}</td>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        <div>{ind.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ind.formula_desc || 'Target operasional tahunan'}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {departments.find(d => d.id === ind.department_id)?.code || ind.department_id}
                        </span>
                      </td>
                      <td>{ind.category}</td>
                      <td style={{ textAlign: 'center' }}>{ind.unit}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${ind.direction === 'higher_is_better' ? 'badge-green' : 'badge-yellow'}`}>
                          {ind.direction === 'higher_is_better' ? 'Semakin Besar Lebih Baik' : 'Semakin Kecil Lebih Baik'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{ind.default_target.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'center' }}>
                        {ind.is_core_kpi ? (
                          <span className="badge badge-green">Core KPI</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER BRANCHES */}
        {activeTab === 'branches' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Wilayah / Regional</th>
                  <th>Alamat Kantor</th>
                  <th>Telepon & Kontak</th>
                  <th>Dermaga (m)</th>
                  <th>Kolam (mLWS)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{b.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.name}</td>
                    <td style={{ color: '#cbd5e1' }}>{b.region}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px' }}>{b.address}</td>
                    <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{b.phone}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{(b.facilities?.dermaga_length_m || 0).toLocaleString('id-ID')} m</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{b.facilities?.kolam_depth_mlws || 0} mLWS</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: MASTER DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Departemen</th>
                  <th>PIC Penanggung Jawab</th>
                  <th>Email PIC</th>
                  <th>Deskripsi Tugas & Ruang Lingkup</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{d.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.name}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{d.pic_name}</td>
                    <td style={{ fontSize: '12px', color: '#38bdf8' }}>{d.pic_email}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{d.description}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: MASTER EQUIPMENT */}
        {activeTab === 'equipment' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode Alat</th>
                  <th>Nama Peralatan</th>
                  <th style={{ textAlign: 'center' }}>Singkatan</th>
                  <th>Kategori Operasional</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{eq.code}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{eq.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {eq.acronym}
                      </span>
                    </td>
                    <td style={{ color: '#cbd5e1' }}>{eq.category}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">Aktif</span>
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
