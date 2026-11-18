import { describe, it, expect } from 'vitest';
import React from 'react';
import ModuleStateView from '@/components/ui/ModuleStateView';

describe('ModuleStateView (UX-06 & PERF-10)', () => {
  it('renders loading state properly', () => {
    const el = ModuleStateView({ state: 'loading', title: 'Memuat data...' });
    expect(el).not.toBeNull();
    expect(el.props.role).toBe('status');
  });

  it('renders empty state properly', () => {
    const el = ModuleStateView({ state: 'empty', title: 'Data kosong', message: 'Tidak ada baris' });
    expect(el).not.toBeNull();
    expect(el.props.role).toBe('status');
  });

  it('renders error state with retry callback', () => {
    let retried = false;
    const el = ModuleStateView({
      state: 'error',
      title: 'Koneksi gagal',
      onRetry: () => {
        retried = true;
      },
    });
    expect(el).not.toBeNull();
    expect(el.props.role).toBe('alert');
    // Button is the 4th child (index 3) in error state
    const button = el.props.children[3];
    button.props.onClick();
    expect(retried).toBe(true);
  });

  it('renders no-access state properly', () => {
    const el = ModuleStateView({ state: 'no-access', title: 'Akses Ditolak' });
    expect(el).not.toBeNull();
    expect(el.props.role).toBe('alert');
  });

  it('renders children when state is success', () => {
    const child = React.createElement('div', { id: 'content' }, 'Data loaded');
    const el = ModuleStateView({ state: 'success', children: child });
    expect(el).toEqual(React.createElement(React.Fragment, null, child));
  });
});
