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
        <table className="card-table data-table">
          <thead>
            <tr>
              <th scope="col">Kode</th>
              <th scope="col">Nama Departemen</th>
              <th scope="col">PIC Penanggung Jawab</th>
              <th scope="col">Email PIC</th>
              <th scope="col">Deskripsi Tugas & Ruang Lingkup</th>
              <th scope="col" style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id}>
                <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue-text)' }}>
                  {d.code}
                </td>
                <td data-label="Nama Departemen" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{d.name}</td>
                <td data-label="PIC Penanggung Jawab" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{d.pic_name}</td>
                <td data-label="Email PIC" style={{ fontSize: '12px', color: 'var(--accent-blue-text)' }}>{d.pic_email}</td>
                <td data-label="Deskripsi Tugas & Ruang Lingkup" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.description}</td>
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

  return (
    <div className="table-responsive">
      <table className="card-table data-table">
        <thead>
          <tr>
            <th scope="col">Kode</th>
            <th scope="col">Nama Cabang</th>
            <th scope="col">Wilayah / Regional</th>
            <th scope="col">Alamat Kantor</th>
            <th scope="col">Telepon & Kontak</th>
            <th scope="col" style={{ textAlign: 'right' }}>Dermaga (m)</th>
            <th scope="col" style={{ textAlign: 'right' }}>Kolam (mLWS)</th>
            <th scope="col" style={{ textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id}>
              <td data-label="Kode" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue-text)' }}>
                {b.code}
              </td>
              <td data-label="Nama Cabang" style={{ fontWeight: 600, color: 'var(--text-title)' }}>{b.name}</td>
              <td data-label="Wilayah / Regional" style={{ color: 'var(--text-secondary)' }}>{b.region}</td>
              <td data-label="Alamat Kantor" style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '240px' }}>{b.address}</td>
              <td data-label="Telepon & Kontak" className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {b.phone}
              </td>
              <td data-label="Dermaga (m)" className="num-cell" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                {(b.facilities?.dermaga_length_m || 0).toLocaleString('id-ID')} m
              </td>
              <td data-label="Kolam (mLWS)" className="num-cell" style={{ fontWeight: 600, color: 'var(--text-title)' }}>
                {b.facilities?.kolam_depth_mlws || 0} mLWS
              </td>
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

