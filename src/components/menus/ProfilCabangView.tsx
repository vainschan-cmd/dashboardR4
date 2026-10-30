'use client';

import React, { useState } from 'react';
import {
  Building2,
  Anchor,
  Compass,
  Phone,
  Mail,
  MapPin,
  Ruler,
  Layers,
  Wrench,
  Ship,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Branch, MonthlyRecord } from '@/lib/types';
import DataTable from '../ui/DataTable';

interface ProfilCabangViewProps {
  branches: Branch[];
  records: MonthlyRecord[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  onSelectRecord: (record: MonthlyRecord) => void;
}

export default function ProfilCabangView({
  branches,
  records,
  selectedBranchId,
  onSelectBranch,
  onSelectRecord,
}: ProfilCabangViewProps) {
  // If ALL selected, default to first branch for the detailed view
  const currentBranchId = selectedBranchId === 'ALL' ? branches[0]?.id : selectedBranchId;
  const activeBranch = branches.find(b => b.id === currentBranchId) || branches[0];

  const branchRecords = records.filter(r => r.branch_id === activeBranch?.id);

  if (!activeBranch) {
    return <div>Data cabang tidak ditemukan.</div>;
  }

  const fac = activeBranch.facilities || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Branch Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {branches.map(b => (
          <button
            key={b.id}
            onClick={() => onSelectBranch(b.id)}
            className={`btn ${b.id === activeBranch.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            <Building2 size={16} />
            <span>{b.name}</span>
          </button>
        ))}
      </div>

      {/* Hero Branch Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628, #16284f)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(56, 189, 248, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              {activeBranch.code}
            </span>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{activeBranch.region}</span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '10px' }}>
            {activeBranch.name}
          </h2>

          <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '16px' }}>
            {activeBranch.overview}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12.5px', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="#38bdf8" />
              <span>{activeBranch.address}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={15} color="#38bdf8" />
              <span>{activeBranch.phone}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} color="#38bdf8" />
              <span>{activeBranch.email}</span>
            </div>
          </div>
        </div>

        {/* Port Status Quick Badge */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px',
          minWidth: '220px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status Operasional
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <strong style={{ fontSize: '15px' }}>Beroperasi 24/7</strong>
          </div>
          <div style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
            ISPS Code Certified • Terminal Internasional & Domestik
          </div>
        </div>
      </div>

      {/* Facilities & Infrastructure Metrics Grid */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Anchor size={18} color="var(--blue-primary)" />
          <span>Fasilitas Pelabuhan & Sarana Penunjang</span>
        </h3>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Panjang Dermaga</span>
              <Ruler size={18} color="#2563eb" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{(fac.dermaga_length_m || 0).toLocaleString('id-ID')}</span>
              <span className="kpi-unit">Meter</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-target-label">Dermaga Petikemas & Curah</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Kedalaman Kolam</span>
              <Compass size={18} color="#0284c7" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{fac.kolam_depth_mlws || 0}</span>
              <span className="kpi-unit">mLWS</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-target-label">Draft Alur Pelayaran</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Lapangan Penumpukan</span>
              <Layers size={18} color="#059669" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{((fac.lapangan_sqm || 0) / 1000).toLocaleString('id-ID')}</span>
              <span className="kpi-unit">Ribu m²</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-target-label">Container Yard (CY)</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Armada Crane (CC/RTG)</span>
              <Wrench size={18} color="#d97706" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{fac.crane_units || 0}</span>
              <span className="kpi-unit">Unit</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-target-label">Alat Bongkar Muat Utama</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-title">Kapal Tunda & Pandu</span>
              <Ship size={18} color="#7c3aed" />
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value">{(fac.tugboat_units || 0) + (fac.pilotboat_units || 0)}</span>
              <span className="kpi-unit">Armada</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-target-label">{fac.tugboat_units} Tunda + {fac.pilotboat_units} Pandu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Specific Performance Records */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Kinerja Bulanan Terverifikasi – {activeBranch.name}</h3>
            <p className="card-subtitle">Daftar seluruh indikator departemen pada cabang terpilih</p>
          </div>
        </div>

        <DataTable records={branchRecords} onSelectRecord={onSelectRecord} showBranchColumn={false} />
      </div>
    </div>
  );
}
