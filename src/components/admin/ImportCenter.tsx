'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Link as LinkIcon,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Branch, Department, ImportBatch, UserRole } from '@/lib/types';

interface ImportCenterProps {
  branches: Branch[];
  departments: Department[];
  userRole: UserRole;
  username: string;
  onImportSuccess: () => void;
}

export default function ImportCenter({
  branches,
  departments,
  userRole,
  username,
  onImportSuccess,
}: ImportCenterProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'gsheets' | 'template' | 'history'>('upload');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [batchId, setBatchId] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Google Sheets state
  const [gsheetUrl, setGsheetUrl] = useState('https://docs.google.com/spreadsheets/d/1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data/edit#gid=0');
  const [gsheetSheetName, setGsheetSheetName] = useState('Input_Kinerja_Bulanan');
  const [isSyncingGsheets, setIsSyncingGsheets] = useState(false);

  // History state
  const [historyBatches, setHistoryBatches] = useState<ImportBatch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Handle file drop/change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setValidationResult(null);
      setMessage(null);
    }
  };

  // Validate uploaded file
  const handleValidateFile = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file .xlsx atau .csv terlebih dahulu.' });
      return;
    }

    setIsValidating(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('department_id', selectedDeptId);
      formData.append('uploader', username);

      const res = await fetch('/api/import/validate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Validasi spreadsheet gagal.');
      }

      setValidationResult(data.validation);
      setBatchId(data.batchId);
      if (data.validation.isValid) {
        setMessage({
          type: 'success',
          text: `Validasi Berhasil: ${data.validation.validRowsCount} baris data siap diimpor. Silakan periksa pratinjau dan konfirmasi penyimpanan.`
        });
      } else {
        setMessage({
          type: 'error',
          text: `Ditemukan ${data.validation.errors.length} kesalahan validasi pada spreadsheet. Harap perbaiki sebelum menyimpan.`
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsValidating(false);
    }
  };

  // Commit valid records
  const handleCommit = async () => {
    if (!validationResult || !validationResult.parsedRecords || validationResult.parsedRecords.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada baris data valid untuk disimpan.' });
      return;
    }

    setIsCommitting(true);
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          filename: file?.name || 'Uploaded File',
          records: validationResult.parsedRecords,
          sourceType: file?.name.endsWith('.csv') ? 'upload_csv' : 'upload_xlsx',
          uploader: username,
          userRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan data.');
      }

      setMessage({
        type: 'success',
        text: `Sukses! ${data.savedCount} record data kinerja berhasil disimpan ke database. Status: Menunggu Verifikasi.`
      });
      setFile(null);
      setValidationResult(null);
      onImportSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsCommitting(false);
    }
  };

  // Google Sheets Sync
  const handleGsheetsSync = async () => {
    setIsSyncingGsheets(true);
    setMessage(null);
    try {
      const res = await fetch('/api/import/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetUrl: gsheetUrl,
          sheetName: gsheetSheetName,
          uploader: username,
          userRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyinkronkan Google Sheets.');
      }

      setValidationResult(data.validation);
      setBatchId(data.batchId);
      setMessage({
        type: 'info',
        text: `${data.message} Ditemukan ${data.validation.validRowsCount} baris valid.`
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSyncingGsheets(false);
    }
  };

  // Load history
  const handleLoadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.batches) {
        setHistoryBatches(data.batches);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <FileSpreadsheet size={20} color="var(--blue-primary)" />
              <span>Pusat Impor Data Kinerja & Integrasi Google Sheets</span>
            </h2>
            <p className="card-subtitle">
              Sistem input data berkala pelabuhan melalui file spreadsheet (.xlsx/.csv) dan sinkronisasi langsung Google Sheets API
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('upload')}
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          >
            <UploadCloud size={16} />
            <span>Upload File (.xlsx / .csv)</span>
          </button>
          <button
            onClick={() => setActiveTab('gsheets')}
            className={`tab-btn ${activeTab === 'gsheets' ? 'active' : ''}`}
          >
            <LinkIcon size={16} />
            <span>Google Sheets API</span>
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`tab-btn ${activeTab === 'template' ? 'active' : ''}`}
          >
            <Download size={16} />
            <span>Unduh Template Resmi</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              handleLoadHistory();
            }}
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          >
            <Clock size={16} />
            <span>Riwayat Impor</span>
          </button>
        </div>

        {/* Notification Message */}
        {message && (
          <div className={`alert-box alert-${message.type === 'error' ? 'danger' : message.type === 'success' ? 'success' : 'info'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div>{message.text}</div>
          </div>
        )}

        {/* TAB 1: FILE UPLOAD */}
        {activeTab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Pilih Departemen Pelaporan:</label>
                <select
                  className="form-input"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name} (PIC: {d.pic_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pengunggah Resmi:</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={`${username} (${userRole})`}
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              style={{
                border: '2px dashed var(--slate-300)',
                borderRadius: 'var(--radius-lg)',
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => document.getElementById('spreadsheet-file-input')?.click()}
            >
              <input
                id="spreadsheet-file-input"
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <UploadCloud size={40} color="var(--blue-primary)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy-800)' }}>
                {file ? file.name : 'Klik untuk memilih file hasil ekspor spreadsheet'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV (.csv) hingga 10MB
              </div>
              {file && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--blue-primary)', fontWeight: 600 }}>
                  Ukuran: {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleValidateFile}
                disabled={!file || isValidating}
                className="btn btn-primary"
              >
                {isValidating ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                <span>{isValidating ? 'Memvalidasi Data...' : 'Validasi & Preview Data'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE SHEETS API */}
        {activeTab === 'gsheets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="alert-box alert-info">
              <LinkIcon size={18} />
              <div>
                <strong>Metode Integrasi Google Sheets API:</strong> Menghubungkan langsung spreadsheet pelaporan bulanan tanpa perlu mengekspor file secara manual. Token dan kredensial aman dienkripsi di server backend.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">URL atau Spreadsheet ID Google Docs:</label>
              <input
                type="text"
                className="form-input"
                value={gsheetUrl}
                onChange={(e) => setGsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1A2b3C.../edit"
              />
              <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Pastikan Google Spreadsheet telah dibagikan (share) dengan email service account pelabuhan.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nama Sheet Tab:</label>
                <input
                  type="text"
                  className="form-input"
                  value={gsheetSheetName}
                  onChange={(e) => setGsheetSheetName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Service Account Email (Backend):</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value="ed-dashboard-sync@port-analytics.iam.gserviceaccount.com"
                  style={{ backgroundColor: '#f1f5f9' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleGsheetsSync}
                disabled={isSyncingGsheets}
                className="btn btn-primary"
              >
                {isSyncingGsheets ? <RefreshCw size={15} className="spin" /> : <RefreshCw size={15} />}
                <span>{isSyncingGsheets ? 'Sinkronisasi Berjalan...' : 'Sinkronkan Google Sheets Sekarang'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: DOWNLOAD TEMPLATE */}
        {activeTab === 'template' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
              Unduh format template spreadsheet resmi (.xlsx) yang telah dilengkapi baris contoh data, nama kolom standar, serta daftar kode cabang dan indikator resmi pada tab lembar petunjuk referensi.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {departments.map((d) => (
                <div key={d.id} style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '16px', background: '#ffffff' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--navy-800)' }}>
                    Departemen {d.name} ({d.code})
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '14px' }}>
                    PIC: {d.pic_name} • Format Standar v1.2
                  </div>
                  <a
                    href={`/api/reports/export?type=template&department_id=${d.id}`}
                    download
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                  >
                    <Download size={14} />
                    <span>Unduh Template .xlsx</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <div>
            {isLoadingHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Memuat riwayat impor...</div>
            ) : historyBatches.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Belum ada histori impor tercatat.</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Waktu Upload</th>
                      <th>Sumber / File</th>
                      <th>Tipe</th>
                      <th>Periode</th>
                      <th>Baris Valid</th>
                      <th>Baris Gagal</th>
                      <th>Pengunggah</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBatches.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontSize: '12px' }}>{new Date(b.uploaded_at).toLocaleString('id-ID')}</td>
                        <td style={{ fontWeight: 600 }}>{b.filename_or_url}</td>
                        <td><span className="badge badge-neutral">{b.source_type}</span></td>
                        <td>{b.period_month}/{b.period_year}</td>
                        <td style={{ color: '#059669', fontWeight: 700 }}>{b.valid_rows}</td>
                        <td style={{ color: b.error_rows > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>{b.error_rows}</td>
                        <td>{b.uploaded_by}</td>
                        <td><span className="badge badge-green">{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VALIDATION PREVIEW & ERRORS SECTION */}
      {validationResult && (
        <div className="card" style={{ border: validationResult.isValid ? '1px solid #a7f3d0' : '1px solid #fecaca' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">
                {validationResult.isValid ? (
                  <CheckCircle2 size={18} color="#059669" />
                ) : (
                  <AlertTriangle size={18} color="#dc2626" />
                )}
                <span>Laporan Validasi Spreadsheet</span>
              </h3>
              <p className="card-subtitle">
                Total Baris: <strong>{validationResult.totalRows}</strong> • Valid: <strong style={{ color: '#059669' }}>{validationResult.validRowsCount}</strong> • Bermasalah: <strong style={{ color: '#dc2626' }}>{validationResult.errorRowsCount}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setValidationResult(null)}
                className="btn btn-secondary btn-sm"
              >
                Batal Impor
              </button>

              <button
                onClick={handleCommit}
                disabled={!validationResult.isValid || isCommitting}
                className="btn btn-success btn-sm"
                title={!validationResult.isValid ? 'Selesaikan error validasi sebelum menyimpan' : undefined}
              >
                {isCommitting ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                <span>{isCommitting ? 'Menyimpan...' : 'Simpan ke Database (Menunggu Verifikasi)'}</span>
              </button>
            </div>
          </div>

          {/* Validation Errors Table if any */}
          {validationResult.errors.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>
                Daftar Kesalahan yang Wajib Diperbaiki:
              </h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr style={{ backgroundColor: '#fef2f2' }}>
                      <th style={{ color: '#991b1b' }}>Baris #</th>
                      <th style={{ color: '#991b1b' }}>Kolom / Atribut</th>
                      <th style={{ color: '#991b1b' }}>Nilai Salah</th>
                      <th style={{ color: '#991b1b' }}>Pesan Kesalahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.errors.map((err: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: '#dc2626' }}>Baris {err.row}</td>
                        <td style={{ fontWeight: 600 }}>{err.column || err.field}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{String(err.value || '(kosong)')}</td>
                        <td style={{ color: '#991b1b' }}>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview of Parsed Rows */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '8px' }}>
              Pratinjau Data Valid (15 Baris Pertama):
            </h4>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode Cabang</th>
                    <th>Departemen</th>
                    <th>Periode</th>
                    <th>Kode Indikator</th>
                    <th style={{ textAlign: 'right' }}>Target</th>
                    <th style={{ textAlign: 'right' }}>Realisasi</th>
                    <th style={{ textAlign: 'center' }}>Satuan</th>
                    <th style={{ textAlign: 'right' }}>Capaian</th>
                    <th style={{ textAlign: 'center' }}>Status KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.parsedRecords.slice(0, 15).map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{r.branch_id}</td>
                      <td>{r.department_id}</td>
                      <td>{r.month}/{r.year}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{r.indicator_id}</td>
                      <td style={{ textAlign: 'right' }}>{r.target.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.realization.toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'center' }}>{r.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.achievement_pct}%</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${r.status_color === 'green' ? 'badge-green' : r.status_color === 'yellow' ? 'badge-yellow' : 'badge-red'}`}>
                          {r.status_color.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
