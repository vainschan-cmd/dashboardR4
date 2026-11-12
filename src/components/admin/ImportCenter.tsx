'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Link as LinkIcon,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Branch, Department, ImportBatch, UserRole, ValidationSummary, ValidationErrorItem, MonthlyRecord } from '@/lib/types';
import { formatNumber } from '@/lib/formatters';

interface ImportCenterProps {
  branches: Branch[];
  departments: Department[];
  userRole: UserRole;
  username: string;
  onImportSuccess: () => void;
}

export default function ImportCenter({
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
  const [validationResult, setValidationResult] = useState<ValidationSummary | null>(null);
  const [batchId, setBatchId] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Google Sheets & Drive state
  const [gsheetUrl, setGsheetUrl] = useState('https://docs.google.com/spreadsheets/d/1A2b3C4d5E6F7g8H9i0J_Demo_Spreadsheet_Port_Data/edit#gid=0');
  const [gsheetSheetName, setGsheetSheetName] = useState('Input_Kinerja_Bulanan');
  const [isSyncingGsheets, setIsSyncingGsheets] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingUserPic, setIsSyncingUserPic] = useState(false);
  const [userPicSyncStatus, setUserPicSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

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
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Validasi spreadsheet gagal.' });
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
        // The server distinguishes new / updated / unchanged rows so a repeated
        // upload does not look like it created 40 fresh records.
        text: data.message || `Impor selesai: ${data.savedCount} baris diproses.`
      });
      setFile(null);
      setValidationResult(null);
      onImportSuccess();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan data.' });
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
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyinkronkan Google Sheets.' });
    } finally {
      setIsSyncingGsheets(false);
    }
  };

  const handleDriveSync = async () => {
    setIsSyncingDrive(true);
    setDriveSyncStatus(null);
    try {
      const res = await fetch('/api/import/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setDriveSyncStatus({
          success: true,
          message: `Berhasil sinkronisasi file input_data.xlsx akun regdashr@gmail.com: ${data.stats.branches} Cabang Master, ${data.stats.equipment} Katalog Alat, dan total ${data.stats.totalRecords} rekaman data kinerja & finansial.`
        });
        if (onImportSuccess) onImportSuccess();
      } else {
        setDriveSyncStatus({
          success: false,
          message: data.error || 'Gagal sinkronisasi data dari drive.'
        });
      }
    } catch (e: unknown) {
      setDriveSyncStatus({
        success: false,
        message: e instanceof Error ? e.message : 'Terjadi kesalahan jaringan saat sinkronisasi.'
      });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleUserPicDriveSync = async () => {
    setIsSyncingUserPic(true);
    setUserPicSyncStatus(null);
    try {
      const res = await fetch('/api/users/sync-drive', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUserPicSyncStatus({
          success: true,
          message: data.message || `Master Data PIC berhasil diekspor dan disinkronkan ke My Drive (${data.totalUsers} pengguna terdaftar).`
        });
        if (onImportSuccess) onImportSuccess();
      } else {
        setUserPicSyncStatus({
          success: false,
          message: data.error || 'Gagal menyinkronkan master_user_pic.xlsx.'
        });
      }
    } catch (e: unknown) {
      setUserPicSyncStatus({
        success: false,
        message: e instanceof Error ? e.message : 'Terjadi kesalahan jaringan saat sinkronisasi PIC.'
      });
    } finally {
      setIsSyncingUserPic(false);
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
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <FileSpreadsheet size={20} color="var(--accent-blue-text)" />
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
            <span>Google Drive & Sheets API</span>
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
                  style={{ backgroundColor: 'var(--bg-inner)' }}
                />
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-inner)',
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
              <UploadCloud size={40} color="var(--accent-blue-text)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                {file ? file.name : 'Klik untuk memilih file hasil ekspor spreadsheet'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV (.csv) hingga 10MB
              </div>
              {file && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--accent-blue-text)', fontWeight: 600 }}>
                  Ukuran: {formatNumber(file.size / 1024, 1)} KB • Klik untuk mengganti berkas
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

        {/* TAB 2: GOOGLE SHEETS & DRIVE API */}
        {activeTab === 'gsheets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* GOOGLE DRIVE SYNC CARD - regdashr@gmail.com */}
            <div
              style={{
                border: '1px solid #1e3a5f',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                backgroundColor: '#0a192f',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-blue-text)',
                    }}
                  >
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
                      Sinkronisasi My Drive (input_data.xlsx)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Akun Google Drive: <strong style={{ color: 'var(--accent-blue-text)' }}>regdashr@gmail.com</strong> • Master & Kinerja Multi-Sheet (10 Sheet)
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDriveSync}
                  disabled={isSyncingDrive}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', minWidth: '220px', justifyContent: 'center' }}
                >
                  <RefreshCw size={15} className={isSyncingDrive ? 'spin' : ''} />
                  <span>{isSyncingDrive ? 'Memproses Data Drive...' : 'Sinkronkan My Drive Sekarang'}</span>
                </button>
              </div>

              {driveSyncStatus && (
                <div className={`alert-box ${driveSyncStatus.success ? 'alert-success' : 'alert-error'}`} style={{ margin: 0 }}>
                  <CheckCircle2 size={16} />
                  <div style={{ fontSize: '12px' }}>
                    {driveSyncStatus.message}
                  </div>
                </div>
              )}
            </div>

            {/* Google Drive Card 2: Master PIC / User */}
            <div
              style={{
                backgroundColor: 'var(--bg-inner)',
                border: '1px solid #1e3557',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--status-good-text)',
                    }}
                  >
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
                      Spreadsheet Master PIC (master_user_pic.xlsx)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Akun Google Drive: <strong style={{ color: 'var(--status-good-text)' }}>regdashr@gmail.com</strong> • Master User PIC, NIPP, Divisi & Hak Akses Login
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleUserPicDriveSync}
                    disabled={isSyncingUserPic}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#059669', borderColor: '#10b981', minWidth: '220px', justifyContent: 'center' }}
                  >
                    <RefreshCw size={15} className={isSyncingUserPic ? 'spin' : ''} />
                    <span>{isSyncingUserPic ? 'Memproses PIC...' : 'Sinkronkan Master PIC ke My Drive'}</span>
                  </button>

                  <a
                    href="/api/users/export"
                    download="master_user_pic.xlsx"
                    className="btn btn-dark"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Unduh file Excel master_user_pic.xlsx"
                  >
                    <Download size={14} />
                    <span>Download .xlsx</span>
                  </a>
                </div>
              </div>

              {userPicSyncStatus && (
                <div className={`alert-box ${userPicSyncStatus.success ? 'alert-success' : 'alert-error'}`} style={{ margin: 0 }}>
                  <CheckCircle2 size={16} />
                  <div style={{ fontSize: '12px' }}>
                    {userPicSyncStatus.message}
                  </div>
                </div>
              )}
            </div>

            <div className="alert-box alert-info">
              <LinkIcon size={18} />
              <div>
                <strong>Sinkronisasi Live Google Sheets API:</strong> Anda juga dapat menghubungkan Google Spreadsheet online secara real-time via URL dokumen di bawah ini.
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
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Pastikan Google Spreadsheet telah dibagikan (share) dengan akun: <strong style={{ color: 'var(--accent-blue-text)' }}>regdashr@gmail.com</strong> (Viewer / Editor).
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
                <label className="form-label">Akun Resmi Database & Spreadsheet:</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value="regdashr@gmail.com"
                  style={{ backgroundColor: 'var(--bg-inner)', color: 'var(--accent-blue-text)', fontWeight: 700 }}
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
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Unduh format template spreadsheet resmi (.xlsx) yang telah dilengkapi baris contoh data, nama kolom standar, serta daftar kode cabang dan indikator resmi pada tab lembar petunjuk referensi.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {departments.map((d) => (
                <div key={d.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--bg-inner)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-title)' }}>
                    Departemen {d.name} ({d.code})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
                    PIC: {d.pic_name} • Format Standar v1.2
                  </div>
                  <a
                    href={`/api/reports/export?type=template&department_id=${d.id}`}
                    download
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
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
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat riwayat impor...</div>
            ) : historyBatches.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada histori impor tercatat.</div>
            ) : (
              <div className="table-responsive">
                <table className="card-table data-table">
                  <thead>
                    <tr>
                      <th scope="col">Waktu Upload</th>
                      <th scope="col">Sumber / File</th>
                      <th scope="col">Tipe</th>
                      <th scope="col">Periode</th>
                      <th scope="col">Baris Valid</th>
                      <th scope="col">Baris Gagal</th>
                      <th scope="col">Pengunggah</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBatches.map((b) => (
                      <tr key={b.id}>
                        <td data-label="Waktu Upload" style={{ fontSize: '12px' }}>{new Date(b.uploaded_at).toLocaleString('id-ID')}</td>
                        <td data-label="Sumber / File" style={{ fontWeight: 600 }}>{b.filename_or_url}</td>
                        <td data-label="Tipe"><span className="badge badge-neutral">{b.source_type}</span></td>
                        <td data-label="Periode">{b.period_month}/{b.period_year}</td>
                        <td data-label="Baris Valid" style={{ color: 'var(--status-good-text)', fontWeight: 700 }}>{b.valid_rows}</td>
                        <td data-label="Baris Gagal" style={{ color: b.error_rows > 0 ? 'var(--status-danger-text)' : 'var(--text-muted)', fontWeight: 700 }}>{b.error_rows}</td>
                        <td data-label="Pengunggah">{b.uploaded_by}</td>
                        <td data-label="Status"><span className="badge badge-green">{b.status}</span></td>
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
                  <CheckCircle2 size={18} color="var(--status-good-text)" />
                ) : (
                  <AlertTriangle size={18} color="var(--status-danger-text)" />
                )}
                <span>Laporan Validasi Spreadsheet</span>
              </h3>
              <p className="card-subtitle">
                Total Baris: <strong>{validationResult.totalRows}</strong> • Valid: <strong style={{ color: 'var(--status-good-text)' }}>{validationResult.validRowsCount}</strong> • Bermasalah: <strong style={{ color: 'var(--status-danger-text)' }}>{validationResult.errorRowsCount}</strong>
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
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--status-danger-text)', marginBottom: '8px' }}>
                Daftar Kesalahan yang Wajib Diperbaiki:
              </h4>
              <div className="table-responsive">
                <table className="card-table data-table">
                  <thead>
                    <tr style={{ backgroundColor: '#fef2f2' }}>
                      <th scope="col" style={{ color: 'var(--status-danger-text)' }}>Baris #</th>
                      <th scope="col" style={{ color: 'var(--status-danger-text)' }}>Kolom / Atribut</th>
                      <th scope="col" style={{ color: 'var(--status-danger-text)' }}>Nilai Salah</th>
                      <th scope="col" style={{ color: 'var(--status-danger-text)' }}>Pesan Kesalahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.errors.map((err: ValidationErrorItem & { field?: string }, idx: number) => (
                      <tr key={idx}>
                        <td data-label="Baris #" style={{ fontWeight: 700, color: 'var(--status-danger-text)' }}>Baris {err.row}</td>
                        <td data-label="Kolom / Atribut" style={{ fontWeight: 600 }}>{err.column || err.field}</td>
                        <td data-label="Nilai Salah" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{String(err.value || '(kosong)')}</td>
                        <td data-label="Pesan Kesalahan" style={{ color: 'var(--status-danger-text)' }}>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview of Parsed Rows */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)', marginBottom: '8px' }}>
              Pratinjau Data Valid (15 Baris Pertama):
            </h4>
            <div className="table-responsive">
              <table className="card-table data-table">
                <thead>
                  <tr>
                    <th scope="col">Kode Cabang</th>
                    <th scope="col">Departemen</th>
                    <th scope="col">Periode</th>
                    <th scope="col">Kode Indikator</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Target</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Realisasi</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Satuan</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Capaian</th>
                    <th scope="col" style={{ textAlign: 'center' }}>Status KPI</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.parsedRecords.slice(0, 15).map((r: MonthlyRecord, idx: number) => (
                    <tr key={idx}>
                      <td data-label="Kode Cabang" style={{ fontWeight: 600 }}>{r.branch_id}</td>
                      <td data-label="Departemen">{r.department_id}</td>
                      <td data-label="Periode">{r.month}/{r.year}</td>
                      <td data-label="Kode Indikator" style={{ fontFamily: 'var(--font-mono)' }}>{r.indicator_id}</td>
                      <td data-label="Target" style={{ textAlign: 'right' }}>{r.target.toLocaleString('id-ID')}</td>
                      <td data-label="Realisasi" style={{ textAlign: 'right', fontWeight: 700 }}>{r.realization.toLocaleString('id-ID')}</td>
                      <td data-label="Satuan" style={{ textAlign: 'center' }}>{r.unit}</td>
                      <td data-label="Capaian" style={{ textAlign: 'right', fontWeight: 700 }}>{r.achievement_pct}%</td>
                      <td data-label="Status KPI" style={{ textAlign: 'center' }}>
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
