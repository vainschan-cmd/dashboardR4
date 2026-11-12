'use client';

import React from 'react';
import { glossaryTooltip } from '@/lib/glossary';

/**
 * An abbreviation with its definition attached as a native tooltip (`COPY-02`).
 *
 * Uses `title` plus `abbr` semantics: the `title` gives sighted users a hover
 * hint, and `<abbr>` gives assistive tech the expansion. No custom popover — a
 * half-built tooltip that cannot be opened by keyboard or touch is worse than the
 * platform default.
 */
export default function Term({
  term,
  children,
  style,
}: {
  term: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const tooltip = glossaryTooltip(term);
  return (
    <abbr
      title={tooltip ?? undefined}
      style={{
        textDecoration: 'underline dotted',
        textUnderlineOffset: '2px',
        cursor: 'help',
        ...style,
      }}
    >
      {children ?? term}
    </abbr>
  );
}
