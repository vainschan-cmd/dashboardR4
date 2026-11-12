'use client';

import React from 'react';
import { EquipmentItem } from '@/lib/types';

interface EquipmentCatalogTabProps {
  equipment: EquipmentItem[];
}

export default function EquipmentCatalogTab({ equipment }: EquipmentCatalogTabProps) {
  return (
    <div className="table-responsive">
      <table className="card-table data-table">
        <thead>
          <tr>
            <th scope="col">Kode Alat</th>
            <th scope="col">Nama Peralatan</th>
            <th scope="col" style={{ textAlign: 'center' }}>Singkatan</th>
            <th scope="col">Kategori Operasional</th>
            <th scope="col" style={{ textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {equipment.map((eq) => (
            <tr key={eq.id}>
              <td data-label="Kode Alat" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue-text)' }}>
                {eq.code}
              </td>
              <td data-label="Nama Peralatan" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{eq.name}</td>
              <td data-label="Singkatan" style={{ textAlign: 'center' }}>
                <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                  {eq.acronym}
                </span>
              </td>
              <td data-label="Kategori Operasional" style={{ color: 'var(--text-secondary)' }}>{eq.category}</td>
              <td data-label="Status" style={{ textAlign: 'center' }}>
                <span className="badge badge-green">Aktif</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

