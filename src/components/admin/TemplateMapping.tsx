'use client';

import React, { useState } from 'react';
import { Sliders, Plus, Trash2, Save, Download, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Department, TemplateConfig, TemplateColumnDef, UserRole } from '@/lib/types';

interface TemplateMappingProps {
  departments: Department[];
  templates: TemplateConfig[];
  userRole: UserRole;
  username: string;
  onTemplateUpdated: () => void;
}

export default function TemplateMapping({
  departments,
  templates,
  userRole,
  username,
  onTemplateUpdated,
}: TemplateMappingProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || '');
  const activeTemplate = templates.find(t => t.department_id === selectedDeptId) || templates[0];

  const [currentCols, setCurrentCols] = useState<TemplateColumnDef[]>(activeTemplate?.columns || []);
  const [templateName, setTemplateName] = useState(activeTemplate?.name || '');
  const [templateVersion, setTemplateVersion] = useState(activeTemplate?.version || 'v1.2');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDeptChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    const tpl = templates.find(t => t.department_id === deptId) || templates[0];
    if (tpl) {
      setCurrentCols([...tpl.columns]);
      setTemplateName(tpl.name);
      setTemplateVersion(tpl.version);
      setMessage(null);
    }
  };

  const handleUpdateColumn = (index: number, field: keyof TemplateColumnDef, val: any) => {
    const updated = [...currentCols];
    updated[index] = { ...updated[index], [field]: val };
    setCurrentCols(updated);
  };

  const handleAddColumn = () => {
    const newCol: TemplateColumnDef = {
      column_name: 'Kolom Baru',
      field_key: 'custom_field_' + Math.random().toString(36).substring(2, 6),
      data_type: 'string',
      required: false,
      sample_value: 'Nilai Contoh'
    };
    setCurrentCols([...currentCols, newCol]);
  };

  const handleDeleteColumn = (index: number) => {
    if (currentCols.length <= 1) return;
    setCurrentCols(currentCols.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
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
          updated_at: new Date().toISOString()
        },
        userRole,
        username
      };

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan template mapping.');
      }

      setMessage({ type: 'success', text: 'Konfigurasi template mapping dinamis berhasil disimpan tanpa mengubah kode!' });
      onTemplateUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: '18px' }}>
              <Sliders size={20} color="var(--blue-primary)" />
              <span>Studio Template Mapping & Konfigurasi Kolom Dinamis</span>
            </h2>
            <p className="card-subtitle">
              Admin dapat menambah, mengubah, dan memetakan nama kolom spreadsheet ke field sistem tanpa memerlukan perubahan source code.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary btn-sm"
            >
              {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              <span>Simpan Perubahan Mapping</span>
            </button>
          </div>
        </div>

        {message && (
          <div className={`alert-box alert-${message.type === 'error' ? 'danger' : 'success'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div>{message.text}</div>
          </div>
        )}

        {/* Form header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label">Pilih Departemen:</label>
            <select
              className="form-input"
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Nama Template:</label>
            <input
              type="text"
              className="form-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Versi Template:</label>
            <input
              type="text"
              className="form-input"
              value={templateVersion}
              onChange={(e) => setTemplateVersion(e.target.value)}
            />
          </div>
        </div>

        {/* Columns Editor Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy-800)' }}>
            Daftar Pemetaan Kolom Spreadsheet ({currentCols.length} Kolom):
          </h3>
          <button onClick={handleAddColumn} className="btn btn-secondary btn-sm">
            <Plus size={14} />
            <span>Tambah Kolom Kustom</span>
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Kolom di Excel/Sheet</th>
                <th>Target Field Database</th>
                <th>Tipe Data</th>
                <th style={{ textAlign: 'center' }}>Wajib?</th>
                <th>Nilai Contoh (Sample)</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentCols.map((col, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '34px', fontSize: '13px' }}
                      value={col.column_name}
                      onChange={(e) => handleUpdateColumn(idx, 'column_name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '34px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                      value={col.field_key}
                      onChange={(e) => handleUpdateColumn(idx, 'field_key', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ height: '34px', fontSize: '13px' }}
                      value={col.data_type}
                      onChange={(e) => handleUpdateColumn(idx, 'data_type', e.target.value)}
                    >
                      <option value="string">Teks (String)</option>
                      <option value="number">Numerik (Number)</option>
                      <option value="date">Tanggal (Date)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={col.required}
                      onChange={(e) => handleUpdateColumn(idx, 'required', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '34px', fontSize: '13px' }}
                      value={String(col.sample_value || '')}
                      onChange={(e) => handleUpdateColumn(idx, 'sample_value', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteColumn(idx)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                      title="Hapus Kolom"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
