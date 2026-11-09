'use client';

import React from 'react';
import { Branch, Department } from '@/lib/types';

interface BranchesTabProps {
  mode: 'branches' | 'departments';
  branches: Branch[];
  departments: Department[];
}

export default function BranchesTab({ mode, branches, departments }: BranchesTabProps) {
  if (mode === 'departments') {
    return (
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
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {d.code}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>{d.name}</td>
                <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>{d.pic_name}</td>
                <td style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>{d.pic_email}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.description}</td>
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

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Cabang</th>
            <th>Wilayah / Regional</th>
            <th>Alamat Kantor</th>
            <th>Telepon & Kontak</th>
            <th style={{ textAlign: 'right' }}>Dermaga (m)</th>
            <th style={{ textAlign: 'right' }}>Kolam (mLWS)</th>
            <th style={{ textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {b.code}
              </td>
              <td style={{ fontWeight: 600, color: 'var(--text-title)' }}>{b.name}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{b.region}</td>
              <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '240px' }}>{b.address}</td>
              <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {b.phone}
              </td>
              <td className="num-cell" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                {(b.facilities?.dermaga_length_m || 0).toLocaleString('id-ID')} m
              </td>
              <td className="num-cell" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                {b.facilities?.kolam_depth_mlws || 0} mLWS
              </td>
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

