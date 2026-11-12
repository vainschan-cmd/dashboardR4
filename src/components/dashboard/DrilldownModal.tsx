'use client';

import { X } from 'lucide-react';

/**
 * Drill-down modal for a KPI card (`CODE-02`).
 *
 * Extracted verbatim from `page.tsx` apart from the alert text colour, which
 * now comes from `--text-on-alert` so the "Pencapaian" figures stay readable in
 * both themes instead of relying on a hardcoded hex.
 */
export type DrilldownItem = {
  title?: string;
  value?: string;
  fullValue?: string;
  rawTarget?: string;
  rawRealization?: string;
  comp1?: string;
  comp1Good?: boolean;
  comp2?: string;
  comp2Good?: boolean;
  [key: string]: unknown;
};

export interface DrilldownModalProps {
  item: DrilldownItem;
  onClose: () => void;
}

export default function DrilldownModal({ item, onClose }: DrilldownModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={item.title || 'Detail Indikator'}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-main)',
          maxWidth: '580px',
        }}
      >
        <div className="modal-header" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <span className="illustration-pill" style={{ fontSize: '12px', padding: '2px 8px' }}>
              Detail Indikator
            </span>
            <h3 className="modal-title" style={{ color: 'var(--text-title)', marginTop: '6px' }}>
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Tutup detail indikator"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              backgroundColor: 'var(--bg-inner)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target RKAP YTD</div>
              <div
                className="tabular-nums"
                style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-title)', marginTop: '4px' }}
              >
                {item.rawTarget || item.comp1}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Realisasi Aktual YTD</div>
              <div
                className="tabular-nums"
                style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-blue-text)', marginTop: '4px' }}
              >
                {item.fullValue || item.rawRealization || item.value}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--bg-inner)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Pencapaian terhadap Target:</span>
            <strong className={`tabular-nums ${item.comp1Good ? 'text-positive' : 'text-alert'}`}>
              {item.comp1}
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--bg-inner)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Pertumbuhan Tahunan (YoY):</span>
            <strong className={`tabular-nums ${item.comp2Good ? 'text-positive' : 'text-alert'}`}>
              {item.comp2}
            </strong>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-inner)' }}
        >
          <button onClick={onClose} className="btn-dark" style={{ fontSize: '12px' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
