'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, Lock, TriangleAlert } from 'lucide-react';

/**
 * The one way to announce success, error, warning, or "no access" (`A11Y-03`).
 *
 * Before this component the app rendered coloured `<div>`s with no ARIA role, so
 * a screen-reader user submitted a form and heard nothing — the error was drawn
 * on screen but never announced. Errors now use `role="alert"` (assertive: it
 * interrupts) and successes/info use `role="status"` (polite: it waits its turn),
 * which is the distinction that matters for assistive tech.
 */

export type AlertTone = 'error' | 'success' | 'warning' | 'info' | 'denied';

const TONE_STYLES: Record<
  AlertTone,
  { bg: string; border: string; color: string; Icon: typeof AlertCircle }
> = {
  error: {
    bg: 'var(--status-danger-bg)',
    border: 'var(--status-danger-border)',
    color: 'var(--status-danger-text)',
    Icon: AlertCircle,
  },
  success: {
    bg: 'var(--status-good-bg)',
    border: 'var(--status-good-border)',
    color: 'var(--status-good-text)',
    Icon: CheckCircle2,
  },
  warning: {
    bg: 'var(--status-alert-bg)',
    border: 'var(--status-alert-border)',
    color: 'var(--status-alert-text)',
    Icon: TriangleAlert,
  },
  info: {
    bg: 'var(--bg-inner)',
    border: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
    Icon: Info,
  },
  denied: {
    bg: 'var(--bg-inner)',
    border: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
    Icon: Lock,
  },
};

export interface AlertProps {
  tone: AlertTone;
  children: React.ReactNode;
  /** Optional next step. An error the user cannot act on is only half a message. */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function Alert({ tone, children, action, style }: AlertProps) {
  const { bg, border, color, Icon } = TONE_STYLES[tone];
  // `role="alert"` implies aria-live="assertive" but pairing them explicitly keeps
  // behaviour stable across older screen readers.
  const isUrgent = tone === 'error' || tone === 'warning';

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        color,
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1.5,
        ...style,
      }}
    >
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <span>{children}</span>
        {action}
      </div>
    </div>
  );
}
