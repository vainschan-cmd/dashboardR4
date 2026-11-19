'use client';

import React from 'react';

export interface ChartLegendItem {
  label: string;
  color: string;
  meta?: string;
}

interface ChartInlineLegendProps {
  items: ChartLegendItem[];
  compact?: boolean;
}

/**
 * Unified horizontal inline legend for all dashboard charts.
 * Uses theme tokens for caption foreground (`CODE-06`) so labels remain
 * legible across both light and dark modes regardless of series fill color.
 */
export default function ChartInlineLegend({ items, compact = false }: ChartInlineLegendProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: compact ? '6px 10px' : '8px 14px',
        paddingTop: compact ? 6 : 8,
        marginTop: compact ? 2 : 6,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: compact ? 10.5 : 11.5,
        fontWeight: 600,
        color: 'var(--text-secondary)',
      }}
    >
      {items.map((item) => (
        <span
          key={`${item.label}-${item.meta ?? ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              backgroundColor: item.color,
              flexShrink: 0,
            }}
          />
          <span>{item.label}</span>
          {item.meta ? (
            <strong style={{ color: 'var(--text-title)', fontWeight: 700 }}>{item.meta}</strong>
          ) : null}
        </span>
      ))}
    </div>
  );
}
