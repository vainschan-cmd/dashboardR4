'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  /** Short, specific description of what is being fetched. */
  label?: string;
  /** Optional compact variant for use inside cards. */
  compact?: boolean;
}

/**
 * Consistent loading placeholder. Rendering an explicit state (instead of a
 * zero-filled dashboard) prevents users from mistaking "still loading" for
 * "the value is zero".
 */
export default function LoadingState({ label = 'Memuat data…', compact = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'flex-start' : 'center',
        gap: '10px',
        padding: compact ? '16px' : '48px 16px',
        color: 'var(--text-muted)',
        fontSize: '12px',
      }}
    >
      <Loader2 size={compact ? 16 : 20} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
