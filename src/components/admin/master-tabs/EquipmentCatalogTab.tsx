'use client';

import React from 'react';
import { EquipmentItem } from '@/lib/types';

interface EquipmentCatalogTabProps {
  equipment: EquipmentItem[];
}

export default function EquipmentCatalogTab({ equipment }: EquipmentCatalogTabProps) {
  return (
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
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {eq.code}
              </td>
              <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>{eq.name}</td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                  {eq.acronym}
                </span>
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>{eq.category}</td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-green">Aktif</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

