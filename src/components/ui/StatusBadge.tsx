'use client';

import React from 'react';
import { CheckCircle, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { VerificationStatus, StatusColor } from '@/lib/types';

interface StatusBadgeProps {
  type: 'traffic_light' | 'verification';
  color?: StatusColor;
  verificationStatus?: VerificationStatus | 'belum_upload';
  label?: string;
}

export default function StatusBadge({
  type,
  color = 'neutral',
  verificationStatus,
  label
}: StatusBadgeProps) {
  if (type === 'traffic_light') {
    const colorClasses: Record<StatusColor, string> = {
      green: 'badge-green',
      yellow: 'badge-yellow',
      red: 'badge-red',
      neutral: 'badge-neutral',
    };

    const defaultLabels: Record<StatusColor, string> = {
      green: 'Tercapai (Hijau)',
      yellow: 'Perhatian (Kuning)',
      red: 'Di Bawah Target (Merah)',
      neutral: 'Belum Ada Target',
    };

    return (
      <span className={`badge ${colorClasses[color]}`}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
        <span>{label || defaultLabels[color]}</span>
      </span>
    );
  }

  // Verification status
  switch (verificationStatus) {
    case 'verified':
      return (
        <span className="badge badge-green">
          <CheckCircle2 size={12} />
          <span>{label || 'Terverifikasi'}</span>
        </span>
      );
    case 'pending_verification':
      return (
        <span className="badge badge-yellow">
          <Clock size={12} />
          <span>{label || 'Menunggu Verifikasi'}</span>
        </span>
      );
    case 'revision_needed':
      return (
        <span className="badge badge-red">
          <AlertTriangle size={12} />
          <span>{label || 'Perlu Revisi'}</span>
        </span>
      );
    case 'draft':
      return (
        <span className="badge badge-neutral">
          <FileText size={12} />
          <span>{label || 'Draft'}</span>
        </span>
      );
    case 'belum_upload':
    default:
      return (
        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
          <span>Belum Upload</span>
        </span>
      );
  }
}
