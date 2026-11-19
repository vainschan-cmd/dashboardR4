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
  PlusCircle,
  Printer,
} from 'lucide-react';
import { Branch, Department, ImportBatch, UserRole, ValidationSummary, ValidationErrorItem, MonthlyRecord } from '@/lib/types';
import { formatNumber } from '@/lib/formatters';

interface ImportCenterProps {
  branches: Branch[];
  departments: Department[];
  userRole: UserRole;
  username: string;
  onImportSuccess: () => void;
  onOpenManualInput?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
}

export default function ImportCenter({
  departments,
  userRole,
  username,
  onImportSuccess,
  onOpenManualInput,
  onExportExcel,
  onPrint,
}: ImportCenterProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'gsheets' | 'template' | 'history'>('upload');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
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
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              <FileSpreadsheet size={20} color="var(--accent-blue-text)" />
              <span>Pusat Penginputan &amp; Ekspor Data Kinerja</span>
            </h2>
            <p className="card-subtitle">
              Input data manual, unggah berkas spreadsheet (.xlsx/.csv), sinkronisasi Google Sheets/Drive, serta ekspor &amp; cetak ringkasan
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenManualInput && (
              <button
                type="button"
                onClick={onOpenManualInput}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '7px 12px', gap: '6px' }}
                title="Input Data Manual (Finance, Opkom, Kinerja, Utilisasi, Peralatan, Fasilitas)"
              >
                <PlusCircle size={14} aria-hidden="true" />
                <span>Input Data Manual</span>
              </button>
            )}
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="btn btn-dark"
                style={{ fontSize: '12px', padding: '7px 12px', gap: '6px' }}
                title="Ekspor data kinerja ke Excel (.xlsx)"
              >
                <Download size={14} aria-hidden="true" />
                <span>Ekspor Excel</span>
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="btn btn-dark"
                style={{ fontSize: '12px', padding: '7px 12px', gap: '6px' }}
                title="Cetak ringkasan laporan"
              >
                <Printer size={14} aria-hidden="true" />
                <span>Cetak Ringkasan</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Entry Pathway Cards (Manual vs Massal Excel) */}
        {onOpenManualInput && (
          <div className="gov-pathway-grid" style={{ marginBottom: '18px' }}>
            <button
              type="button"
              onClick={onOpenManualInput}
              className="gov-pathway-card"
            >
              <div className="gov-pathway-icon">
                <PlusCircle size={18} />
              </div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Input Manual Cepat (Per Indikator)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Cocok untuk pembaruan satuan modul Keuangan, Opkom, Kinerja, Utilisasi, Peralatan, atau Fasilitas.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`gov-pathway-card ${activeTab === 'upload' ? 'active' : ''}`}
            >
              <div className="gov-pathway-icon">
                <UploadCloud size={18} />
              </div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
                  Impor Massal Spreadsheet (.xlsx / .csv)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Unggah seluruh laporan bulanan cabang sekaligus dengan validasi pratinjau otomatis sebelum kirim.
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="tabs-nav">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          >
            <UploadCloud size={16} />
            <span>Upload File (.xlsx / .csv)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gsheets')}
            className={`tab-btn ${activeTab === 'gsheets' ? 'active' : ''}`}
          >
            <LinkIcon size={16} />
            <span>Google Drive &amp; Sheets API</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`tab-btn ${activeTab === 'template' ? 'active' : ''}`}
          >
            <Download size={16} />
            <span>Unduh Template Resmi</span>
          </button>
          <button
            type="button"
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
            {/* Visual 3-Step Import Stepper */}
            <ol className="gov-stepper" aria-label="Tahapan impor data spreadsheet">
              <li className={`gov-step ${file ? 'done' : 'active'}`}>
                <span className="gov-step-num">{file ? <CheckCircle2 size={14} /> : '1'}</span>
                <div>
                  <div className="gov-step-title">Pilih Departemen &amp; Berkas</div>
                  <div className="gov-step-sub">{file ? file.name : 'Tarik atau pilih berkas Excel/CSV'}</div>
                </div>
              </li>
              <li className={`gov-step ${validationResult ? 'done' : file ? 'active' : ''}`}>
                <span className="gov-step-num">{validationResult ? <CheckCircle2 size={14} /> : '2'}</span>
                <div>
                  <div className="gov-step-title">Validasi &amp; Pratinjau Baris</div>
                  <div className="gov-step-sub">
                    {validationResult
                      ? `${validationResult.validRowsCount} baris valid terdeteksi`
                      : 'Pemeriksaan format & kolom wajib'}
                  </div>
                </div>
              </li>
              <li className={`gov-step ${validationResult?.isValid ? 'active' : ''}`}>
                <span className="gov-step-num">3</span>
                <div>
                  <div className="gov-step-title">Kirim ke Antrean Verifikasi</div>
                  <div className="gov-step-sub">Diteruskan ke Admin Regional untuk pengesahan</div>
                </div>
              </li>
            </ol>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Pilih Departemen Pelaporan:</label>
                <select
                  className="form-select"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name} (PIC: {d.pic_name})
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
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFile}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '32px 20px',
                textAlign: 'center',
                backgroundColor: isDragging ? 'var(--blue-soft)' : 'var(--bg-inner)',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
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
              <UploadCloud size={38} color="var(--accent-blue-text)" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                {file ? file.name : 'Tarik berkas ke sini atau klik untuk memilih spreadsheet'}
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
                type="button"
                onClick={handleValidateFile}
                disabled={!file || isValidating}
                className="btn btn-primary"
              >
                {isValidating ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                <span>{isValidating ? 'Memvalidasi Data...' : 'Validasi & Pratinjau Data'}</span>
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
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                backgroundColor: 'var(--bg-inner)',
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
                border: '1px solid var(--border-subtle)',
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
                    <tr style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
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
