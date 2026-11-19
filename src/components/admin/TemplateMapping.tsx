'use client';

import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Department, TemplateConfig, TemplateColumnDef, UserRole } from '@/lib/types';
import { downloadCsvFile } from '@/lib/governanceNav';

interface TemplateMappingProps {
  departments: Department[];
  templates: TemplateConfig[];
  userRole: UserRole;
  username: string;
  onTemplateUpdated: () => void;
}

function columnLetter(index: number): string {
  let n = index;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export default function TemplateMapping(props: TemplateMappingProps) {
  const { departments, templates } = props;
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const effectiveDeptId = selectedDeptId || departments[0]?.id || '';
  const activeTemplate =
    templates.find((t) => t.department_id === effectiveDeptId) || templates[0] || null;
  const editorKey = `${effectiveDeptId}_${activeTemplate?.id || 'empty'}_${activeTemplate?.columns?.length || 0}_${activeTemplate?.updated_at || ''}`;

  return (
    <TemplateMappingEditor
      key={editorKey}
      {...props}
      selectedDeptId={effectiveDeptId}
      activeTemplate={activeTemplate}
      onSelectDeptId={setSelectedDeptId}
    />
  );
}

interface TemplateMappingEditorProps extends TemplateMappingProps {
  selectedDeptId: string;
  activeTemplate: TemplateConfig | null;
  onSelectDeptId: (deptId: string) => void;
}

function TemplateMappingEditor({
  departments,
  selectedDeptId,
  activeTemplate,
  onSelectDeptId,
  userRole,
  username,
  onTemplateUpdated,
}: TemplateMappingEditorProps) {
  const canEdit = ['super_admin', 'admin_regional'].includes(userRole);

  const [currentCols, setCurrentCols] = useState<TemplateColumnDef[]>(
    () => (activeTemplate?.columns ? [...activeTemplate.columns] : [])
  );
  const [templateName, setTemplateName] = useState(activeTemplate?.name || '');
  const [templateVersion, setTemplateVersion] = useState(activeTemplate?.version || 'v1.2');
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      name: activeTemplate?.name || '',
      version: activeTemplate?.version || 'v1.2',
      columns: activeTemplate?.columns || [],
    })
  );
  const [pendingDeptSwitch, setPendingDeptSwitch] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDirty = useMemo(() => {
    const current = JSON.stringify({
      name: templateName,
      version: templateVersion,
      columns: currentCols,
    });
    return current !== savedSnapshot;
  }, [templateName, templateVersion, currentCols, savedSnapshot]);

  const applyDeptChange = (deptId: string) => {
    setPendingDeptSwitch(null);
    onSelectDeptId(deptId);
  };

  const handleDeptChange = (deptId: string) => {
    if (deptId === selectedDeptId) return;
    if (isDirty && canEdit) {
      setPendingDeptSwitch(deptId);
      return;
    }
    applyDeptChange(deptId);
  };

  const handleUpdateColumn = (
    index: number,
    field: keyof TemplateColumnDef,
    val: TemplateColumnDef[keyof TemplateColumnDef]
  ) => {
    if (!canEdit) return;
    const updated = [...currentCols];
    updated[index] = { ...updated[index], [field]: val };
    setCurrentCols(updated);
  };

  const handleAddColumn = () => {
    if (!canEdit) return;
    const newCol: TemplateColumnDef = {
      column_name: 'Kolom Baru',
      field_key: 'custom_field_' + Math.random().toString(36).substring(2, 6),
      data_type: 'string',
      required: false,
      sample_value: 'Nilai Contoh',
    };
    setCurrentCols([...currentCols, newCol]);
  };

  const handleDeleteColumn = (index: number) => {
    if (!canEdit || currentCols.length <= 1) return;
    setCurrentCols(currentCols.filter((_, i) => i !== index));
  };

  const handleDownloadSampleCsv = () => {
    const headers = currentCols.map((c) => c.column_name || c.field_key);
    const sampleRow = currentCols.map((c) => c.sample_value ?? '');
    const deptCode = departments.find((d) => d.id === selectedDeptId)?.code || selectedDeptId || 'template';
    downloadCsvFile(`contoh_template_${deptCode.toLowerCase()}_${templateVersion}.csv`, headers, [
      sampleRow,
    ]);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        template: {
          id: activeTemplate?.id || `tpl_${selectedDeptId}`,
          department_id: selectedDeptId,
          version: templateVersion,
          name: templateName,
          description: `Konfigurasi dinamis pemetaan kolom spreadsheet untuk Departemen ID ${selectedDeptId}`,
          columns: currentCols,
          updated_at: new Date().toISOString(),
        },
        userRole,
        username,
      };

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan template mapping.');
      }

      setSavedSnapshot(
        JSON.stringify({
          name: templateName,
          version: templateVersion,
          columns: currentCols,
        })
      );
      setPendingDeptSwitch(null);
      setMessage({
        type: 'success',
        text: 'Konfigurasi pemetaan kolom template berhasil disimpan tanpa mengubah kode sistem.',
      });
      onTemplateUpdated();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan template mapping.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="card-title" style={{ fontSize: '16px', margin: 0 }}>
                <Sliders size={20} color="var(--accent-blue-text)" />
                <span>Pemetaan Template &amp; Konfigurasi Kolom Dinamis</span>
              </h2>
              {isDirty && canEdit && (
                <span className="badge badge-yellow">Perubahan belum disimpan</span>
              )}
              {!canEdit && <span className="badge badge-neutral">Read-Only</span>}
            </div>
            <p className="card-subtitle" style={{ marginTop: '4px' }}>
              Kelola struktur kolom spreadsheet per departemen, validasi tipe data, dan tinjau pratinjau header Excel secara langsung.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              disabled={currentCols.length === 0}
              className="btn btn-dark btn-sm"
              title="Unduh contoh berkas CSV sesuai susunan kolom aktif"
            >
              <Download size={14} />
              <span>Unduh Contoh (.csv)</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Mapping'}</span>
              </button>
            )}
          </div>
        </div>

        {!canEdit && (
          <div className="alert-box alert-info" style={{ marginBottom: '16px' }}>
            <Lock size={16} />
            <div>
              <strong>Mode Baca Saja:</strong> Pengubahan struktur kolom template hanya diizinkan
              untuk <strong>Admin Regional</strong> atau <strong>Super Admin</strong>.
            </div>
          </div>
        )}

        {pendingDeptSwitch && (
          <div className="admin-dirty-banner" style={{ borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--status-alert-border)' }} role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--status-alert-text)' }} />
              <span>Ada perubahan pemetaan kolom yang belum disimpan. Yakin pindah departemen?</span>
            </div>
            <div className="admin-dirty-banner-actions">
              <button
                type="button"
                className="pwd-action-chip"
                onClick={() => setPendingDeptSwitch(null)}
              >
                Tetap di Sini
              </button>
              <button
                type="button"
                className="pwd-action-chip"
                onClick={() => applyDeptChange(pendingDeptSwitch)}
                style={{
                  borderColor: 'var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                }}
              >
                Buang &amp; Pindah
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`alert-box alert-${message.type === 'error' ? 'danger' : 'success'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div>{message.text}</div>
          </div>
        )}

        {/* Form header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginBottom: '18px',
          }}
        >
          <div className="form-group">
            <label htmlFor="tpl-dept-select" className="form-label">
              Pilih Departemen
            </label>
            <select
              id="tpl-dept-select"
              className="form-select"
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tpl-name-input" className="form-label">
              Nama Template
            </label>
            <input
              id="tpl-name-input"
              type="text"
              className="form-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tpl-ver-input" className="form-label">
              Versi Template
            </label>
            <input
              id="tpl-ver-input"
              type="text"
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)' }}
              value={templateVersion}
              onChange={(e) => setTemplateVersion(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Live Excel Header Preview Strip */}
        <div className="template-excel-preview" style={{ marginBottom: '20px' }}>
          <div className="template-excel-preview-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={15} style={{ color: 'var(--accent-blue-text)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-title)' }}>
                Pratinjau Live Header Excel ({currentCols.length} Kolom)
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Tanda <strong style={{ color: 'var(--status-danger-text)' }}>*</strong> menandakan kolom wajib diisi PIC
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="card-table template-preview-sheet" aria-label="Pratinjau struktur kolom spreadsheet">
              <thead>
                <tr>
                  <th scope="col" className="template-sheet-corner">
                    #
                  </th>
                  {currentCols.map((col, i) => (
                    <th scope="col" key={`col_idx_${i}`} className="template-sheet-col-letter">
                      {columnLetter(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Baris" className="template-sheet-rownum">
                    1
                  </td>
                  {currentCols.map((col, i) => (
                    <td
                      key={`col_hdr_${i}`}
                      data-label={columnLetter(i)}
                      className="template-sheet-header-cell"
                    >
                      <span>{col.column_name || '(Tanpa Nama)'}</span>
                      {col.required && (
                        <span style={{ color: 'var(--status-danger-text)', marginLeft: '3px' }}>
                          *
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td data-label="Baris" className="template-sheet-rownum">
                    2
                  </td>
                  {currentCols.map((col, i) => (
                    <td
                      key={`col_smp_${i}`}
                      data-label={col.column_name || columnLetter(i)}
                      className="template-sheet-sample-cell"
                    >
                      {String(col.sample_value || '—')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Columns Editor Table */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
            Editor Pemetaan Kolom ({currentCols.length} Kolom)
          </h3>
          {canEdit && (
            <button type="button" onClick={handleAddColumn} className="btn btn-secondary btn-sm">
              <Plus size={14} />
              <span>Tambah Kolom Kustom</span>
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="card-table data-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: '48px', textAlign: 'center' }}>
                  Kol
                </th>
                <th scope="col">Nama Kolom di Excel / Sheet</th>
                <th scope="col">Target Field Database</th>
                <th scope="col">Tipe Data</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Wajib?
                </th>
                <th scope="col">Nilai Contoh (Sample)</th>
                {canEdit && (
                  <th scope="col" style={{ textAlign: 'center', width: '70px' }}>
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {currentCols.map((col, idx) => (
                <tr key={idx}>
                  <td
                    data-label="Kolom"
                    style={{
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--accent-blue-text)',
                    }}
                  >
                    {columnLetter(idx)}
                  </td>
                  <td data-label="Nama Kolom di Excel / Sheet">
                    <input
                      type="text"
                      className="form-input"
                      style={{ minHeight: '36px', fontSize: '12px' }}
                      value={col.column_name}
                      onChange={(e) => handleUpdateColumn(idx, 'column_name', e.target.value)}
                      disabled={!canEdit}
                      aria-label={`Nama kolom Excel baris ${idx + 1}`}
                    />
                  </td>
                  <td data-label="Target Field Database">
                    <input
                      type="text"
                      className="form-input"
                      style={{ minHeight: '36px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      value={col.field_key}
                      onChange={(e) => handleUpdateColumn(idx, 'field_key', e.target.value)}
                      disabled={!canEdit}
                      aria-label={`Target field database baris ${idx + 1}`}
                    />
                  </td>
                  <td data-label="Tipe Data">
                    <select
                      className="form-select"
                      style={{ minHeight: '36px', fontSize: '12px' }}
                      value={col.data_type}
                      onChange={(e) => handleUpdateColumn(idx, 'data_type', e.target.value)}
                      disabled={!canEdit}
                      aria-label={`Tipe data baris ${idx + 1}`}
                    >
                      <option value="string">Teks (String)</option>
                      <option value="number">Numerik (Number)</option>
                      <option value="date">Tanggal (Date)</option>
                    </select>
                  </td>
                  <td data-label="Wajib?" style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={col.required}
                      onChange={(e) => handleUpdateColumn(idx, 'required', e.target.checked)}
                      disabled={!canEdit}
                      aria-label={`Wajib diisi untuk ${col.column_name}`}
                    />
                  </td>
                  <td data-label="Nilai Contoh (Sample)">
                    <input
                      type="text"
                      className="form-input"
                      style={{ minHeight: '36px', fontSize: '12px' }}
                      value={String(col.sample_value || '')}
                      onChange={(e) => handleUpdateColumn(idx, 'sample_value', e.target.value)}
                      disabled={!canEdit}
                      aria-label={`Nilai contoh baris ${idx + 1}`}
                    />
                  </td>
                  {canEdit && (
                    <td data-label="Aksi" style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(idx)}
                        disabled={currentCols.length <= 1}
                        className="btn btn-secondary btn-sm"
                        style={{
                          color: 'var(--status-danger-text)',
                          borderColor: 'var(--status-danger-border)',
                        }}
                        title="Hapus Kolom"
                        aria-label={`Hapus kolom ${col.column_name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
