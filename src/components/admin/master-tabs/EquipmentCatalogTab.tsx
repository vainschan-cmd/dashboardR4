'use client';

import React, { useState, useMemo } from 'react';
import { Search, Wrench, Layers, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { EquipmentItem } from '@/lib/types';

interface EquipmentCatalogTabProps {
  equipment: EquipmentItem[];
}

export default function EquipmentCatalogTab({ equipment }: EquipmentCatalogTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach((eq) => {
      if (eq.category) set.add(eq.category.trim());
    });
    return Array.from(set).sort();
  }, [equipment]);

  // Aggregate summary metrics
  const summary = useMemo(() => {
    const totalCatalog = equipment.length;
    const totalUnits = equipment.reduce((acc, eq) => acc + (eq.unit_count || 0), 0);
    const totalRecords = equipment.reduce((acc, eq) => acc + (eq.record_count || 0), 0);
    const activeUnits = equipment.filter((eq) => (eq.unit_count || 0) > 0).length;
    return { totalCatalog, totalUnits, totalRecords, activeUnits };
  }, [equipment]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return equipment.filter((eq) => {
      const matchesSearch =
        !q ||
        `${eq.code} ${eq.name} ${eq.acronym} ${eq.category}`.toLowerCase().includes(q);
      const matchesCat =
        selectedCategory === 'ALL' ||
        eq.category?.trim().toUpperCase() === selectedCategory.toUpperCase();
      return matchesSearch && matchesCat;
    });
  }, [equipment, searchTerm, selectedCategory]);

  const getCategoryBadgeClass = (category?: string) => {
    const cat = (category || '').toUpperCase();
    if (cat.includes('KAPAL') || cat.includes('DERMAGA')) return 'badge badge-blue';
    if (cat.includes('APUNG')) return 'badge badge-cyan';
    if (cat.includes('LAPANGAN') || cat.includes('CY')) return 'badge badge-neutral';
    return 'badge badge-neutral';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Highlight Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(30, 64, 175, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Katalog Standar
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)' }}>
              {summary.totalCatalog}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Jenis Alat</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-good-text)',
            }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Populasi Unit Fisik
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)' }}>
              {summary.totalUnits.toLocaleString('id-ID')}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Unit di Lapangan</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(30, 64, 175, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue-text)',
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Rekaman Monitoring
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)' }}>
              {summary.totalRecords.toLocaleString('id-ID')}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Log Kesiapan</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-alert-text)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Cakupan Kategori
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)' }}>
              {categories.length}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Kategori Operasi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar & Category Pills */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 16px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
            Filter:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('ALL')}
            style={{ fontSize: '12px', padding: '4px 12px', height: '30px' }}
          >
            Semua ({equipment.length})
          </button>
          {categories.map((cat) => {
            const count = equipment.filter((eq) => eq.category?.trim().toUpperCase() === cat.toUpperCase()).length;
            const isSelected = selectedCategory.toUpperCase() === cat.toUpperCase();
            return (
              <button
                key={cat}
                type="button"
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                style={{ fontSize: '12px', padding: '4px 12px', height: '30px' }}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            className="filter-select"
            placeholder="Cari kode (AL..), nama, singkatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px', width: '100%', height: '34px' }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive">
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '90px' }}>Kode Alat</th>
              <th scope="col">Nama Peralatan Standar</th>
              <th scope="col" style={{ textAlign: 'center', width: '90px' }}>Singkatan</th>
              <th scope="col">Kategori Operasional</th>
              <th scope="col" style={{ textAlign: 'right', width: '150px' }}>Populasi Unit</th>
              <th scope="col" style={{ textAlign: 'right', width: '140px' }}>Log Kesiapan</th>
              <th scope="col" style={{ textAlign: 'center', width: '100px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Tidak ada katalog peralatan yang sesuai dengan filter atau pencarian.
                </td>
              </tr>
            ) : (
              filtered.map((eq) => {
                const hasUnits = (eq.unit_count || 0) > 0;
                return (
                  <tr key={eq.id || eq.code}>
                    <td
                      data-label="Kode Alat"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent-blue-text)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(30, 64, 175, 0.08)',
                        }}
                      >
                        {eq.code}
                      </span>
                    </td>
                    <td data-label="Nama Peralatan" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                      {eq.name}
                    </td>
                    <td data-label="Singkatan" style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700, minWidth: '46px' }}>
                        {eq.acronym}
                      </span>
                    </td>
                    <td data-label="Kategori Operasional">
                      <span className={getCategoryBadgeClass(eq.category)}>
                        {eq.category}
                      </span>
                    </td>
                    <td
                      data-label="Populasi Unit"
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: hasUnits ? 700 : 400,
                        color: hasUnits ? 'var(--text-title)' : 'var(--text-muted)',
                      }}
                    >
                      {hasUnits ? (
                        <span className="badge badge-green" style={{ fontWeight: 700 }}>
                          {eq.unit_count} Unit
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td
                      data-label="Log Kesiapan"
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: hasUnits ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontSize: '13px',
                      }}
                    >
                      {(eq.record_count || 0) > 0 ? (
                        <span>{eq.record_count?.toLocaleString('id-ID')} log</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} />
                        Aktif
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span>
          Menampilkan <strong>{filtered.length}</strong> dari <strong>{equipment.length}</strong> katalog peralatan standar Pelindo Regional 4.
        </span>
        <span>
          Data disinkronkan dengan <strong>6.046</strong> record operasional pada basis data PostgreSQL.
        </span>
      </div>
    </div>
  );
}
