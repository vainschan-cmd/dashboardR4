import { describe, it, expect } from 'vitest';
import {
  ALL_DATA_STATUSES,
  describeDataStatus,
  formatReportedValue,
  mergeDataStatuses,
  resolveDataStatus,
} from '@/lib/dataStatus';

/**
 * `DATA-04` — an explicit data status model.
 *
 * The bug being fixed: absence was represented by `0`, so "tidak ada kapal masuk"
 * and "tidak ada laporan kapal masuk" rendered identically. Only one of those is
 * a performance problem for the reader, and the dashboard could not tell them
 * apart. These tests pin the distinction and the precedence rules.
 */

describe('resolveDataStatus — nilai vs ketiadaan', () => {
  it('melaporkan no_data ketika tidak ada baris, apa pun nilai angkanya', () => {
    // `rowCount: 0` with a figure of 0 is *missing*, not zero.
    expect(resolveDataStatus({ rowCount: 0, verificationStatuses: [] })).toBe('no_data');
    expect(resolveDataStatus({ rowCount: -1, verificationStatuses: [] })).toBe('no_data');
  });

  it('baris dengan nilai nol tetap dianggap data yang dilaporkan', () => {
    // A verified "0 TEUs" report is a real statement about an empty terminal.
    const status = resolveDataStatus({ rowCount: 1, verificationStatuses: ['verified'] });
    expect(status).toBe('verified');
    expect(describeDataStatus(status).hasValue).toBe(true);
  });

  it('membedakan belum diverifikasi dari menunggu verifikasi', () => {
    // No status on any row: the submission was never sent for approval.
    expect(resolveDataStatus({ rowCount: 5, verificationStatuses: [] })).toBe('not_verified');
    expect(resolveDataStatus({ rowCount: 5, verificationStatuses: ['pending_verification'] })).toBe(
      'pending'
    );
    expect(resolveDataStatus({ rowCount: 5, verificationStatuses: ['draft'] })).toBe('pending');
  });

  it('revisi mengalahkan status lain, termasuk verified', () => {
    // One rejected row makes the whole figure untrustworthy: it may be the row
    // that carries most of the total.
    expect(
      resolveDataStatus({ rowCount: 3, verificationStatuses: ['verified', 'revision_needed', 'verified'] })
    ).toBe('revision');
  });

  it('kegagalan impor mengalahkan segalanya', () => {
    expect(
      resolveDataStatus({ rowCount: 3, verificationStatuses: ['verified'], failed: true })
    ).toBe('failed');
  });

  it('menandai data simulasi agar tidak terbaca sebagai laporan sungguhan', () => {
    expect(resolveDataStatus({ rowCount: 2, verificationStatuses: ['verified'], isSimulated: true })).toBe(
      'simulated'
    );
    expect(resolveDataStatus({ rowCount: 2, verificationStatuses: [], isSimulated: true })).toBe('simulated');
  });
});

describe('mergeDataStatuses', () => {
  it('no_data hanya bila tidak ada satu pun modul yang melapor', () => {
    expect(mergeDataStatuses(['no_data', 'no_data'])).toBe('no_data');
    expect(mergeDataStatuses([])).toBe('no_data');
  });

  it('laporan sebagian tidak boleh terlihat seperti laporan lengkap', () => {
    // Two modules verified and one missing is still a partial report.
    expect(mergeDataStatuses(['verified', 'verified', 'no_data'])).toBe('verified');
    // But a pending module must surface, otherwise the gap is invisible.
    expect(mergeDataStatuses(['verified', 'pending', 'no_data'])).toBe('pending');
  });

  it('memakai status paling tidak final yang ada', () => {
    expect(mergeDataStatuses(['verified', 'not_verified'])).toBe('not_verified');
    expect(mergeDataStatuses(['not_verified', 'revision'])).toBe('revision');
    expect(mergeDataStatuses(['revision', 'failed'])).toBe('failed');
    expect(mergeDataStatuses(['simulated', 'verified'])).toBe('simulated');
  });
});

describe('describeDataStatus', () => {
  it('hanya verified yang dianggap final', () => {
    for (const status of ALL_DATA_STATUSES) {
      const info = describeDataStatus(status);
      expect(info.isFinal, status).toBe(status === 'verified');
    }
  });

  it('no_data dan failed tidak membawa nilai, status lain membawa nilai', () => {
    for (const status of ALL_DATA_STATUSES) {
      const info = describeDataStatus(status);
      const shouldHaveValue = status !== 'no_data' && status !== 'failed';
      expect(info.hasValue, status).toBe(shouldHaveValue);
    }
  });

  it('setiap status punya label Indonesia dan tone yang dikenal', () => {
    for (const status of ALL_DATA_STATUSES) {
      const info = describeDataStatus(status);
      expect(info.label.length).toBeGreaterThan(3);
      expect(['neutral', 'good', 'alert', 'danger', 'info']).toContain(info.tone);
    }
  });

  it('mencakup tepat tujuh status yang diminta tasklist', () => {
    expect(new Set(ALL_DATA_STATUSES)).toEqual(
      new Set(['no_data', 'not_verified', 'pending', 'revision', 'verified', 'simulated', 'failed'])
    );
  });
});

describe('formatReportedValue', () => {
  const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  it('menampilkan label, bukan "0", ketika data tidak ada', () => {
    const result = formatReportedValue(null, 'no_data', rupiah);
    expect(result.text).toBe('Belum ada data');
    expect(result.text).not.toContain('0');
    expect(result.isPlaceholder).toBe(true);
  });

  it('menampilkan nilai nol yang benar-benar dilaporkan sebagai nol', () => {
    const result = formatReportedValue(0, 'verified', rupiah);
    expect(result.text).toBe('Rp 0');
    expect(result.isPlaceholder).toBe(false);
  });

  it('memakai label status ketika nilai hilang meski statusnya bukan no_data', () => {
    // A partially imported module can have a status but no figure yet.
    expect(formatReportedValue(null, 'pending', rupiah).text).toBe('Menunggu verifikasi');
    expect(formatReportedValue(Number.NaN, 'verified', rupiah).isPlaceholder).toBe(true);
  });

  it('meneruskan nilai apa adanya ke formatter untuk status yang membawa nilai', () => {
    expect(formatReportedValue(1234, 'pending', rupiah)).toEqual({
      text: 'Rp 1.234',
      status: 'pending',
      isPlaceholder: false,
    });
  });
});
