import type { VerificationStatus } from './types';

/**
 * Explicit data status (`DATA-04`).
 *
 * The problem this solves: absence was represented by `0`. A branch that never
 * reported TEUs and a branch that reported "0 TEUs" produced the same number, so
 * the dashboard could not tell "belum ada data" from "nihil". Those are different
 * statements to an executive — one means the port is empty, the other means
 * nobody filed a report — and only one of them is a performance problem.
 *
 * Every figure now carries a status alongside its value, and the status is
 * derived once here rather than re-inferred by each screen from `null`/`0`.
 */

/**
 * The seven states the tasklist asks for, plus `partial` for a branch that has
 * some modules but not others (common: opkom without financials).
 */
export type DataStatus =
  /** Nothing was ever submitted for this scope and period. */
  | 'no_data'
  /** Rows exist but no figure has been verified — visible to operators only. */
  | 'not_verified'
  /** Rows exist and are queued for approval. */
  | 'pending'
  /** A verifier returned the submission for correction. */
  | 'revision'
  /** Approved figures. The only state a BOD should treat as final. */
  | 'verified'
  /** Demonstration data, never to be read as a real report. */
  | 'simulated'
  /** The submission was imported but could not be applied. */
  | 'failed';

export interface DataStatusInfo {
  status: DataStatus;
  /** Indonesian label for the UI. */
  label: string;
  /** Tone hint that maps onto the status colour tokens. */
  tone: 'neutral' | 'good' | 'alert' | 'danger' | 'info';
  /** May this be shown as an official figure? */
  isFinal: boolean;
  /** Should the value be rendered at all, or replaced by the label? */
  hasValue: boolean;
}

const STATUS_INFO: Record<DataStatus, Omit<DataStatusInfo, 'status'>> = {
  no_data: {
    label: 'Belum ada data',
    tone: 'neutral',
    isFinal: false,
    hasValue: false,
  },
  not_verified: {
    label: 'Belum diverifikasi',
    tone: 'alert',
    isFinal: false,
    hasValue: true,
  },
  pending: {
    label: 'Menunggu verifikasi',
    tone: 'alert',
    isFinal: false,
    hasValue: true,
  },
  revision: {
    label: 'Perlu revisi',
    tone: 'danger',
    isFinal: false,
    hasValue: true,
  },
  verified: {
    label: 'Terverifikasi',
    tone: 'good',
    isFinal: true,
    hasValue: true,
  },
  simulated: {
    label: 'Data simulasi',
    tone: 'info',
    isFinal: false,
    hasValue: true,
  },
  failed: {
    label: 'Gagal diproses',
    tone: 'danger',
    isFinal: false,
    hasValue: false,
  },
};

export function describeDataStatus(status: DataStatus): DataStatusInfo {
  return { status, ...STATUS_INFO[status] };
}

/** Every status, for tests and exhaustive UI switches. */
export const ALL_DATA_STATUSES: DataStatus[] = [
  'no_data',
  'not_verified',
  'pending',
  'revision',
  'verified',
  'simulated',
  'failed',
];

export interface StatusInput {
  /** Number of source rows found for the scope. `0` means nothing was reported. */
  rowCount: number;
  /** Verification statuses present among those rows. */
  verificationStatuses: VerificationStatus[];
  /** True when any contributing row came from the simulator. */
  isSimulated?: boolean;
  /** True when the import batch itself failed. */
  failed?: boolean;
  /** True when the scope is a single branch; multi-branch consolidation differs. */
  isConsolidated?: boolean;
}

/**
 * Collapse the rows behind a figure into one status.
 *
 * Ordering matters. A single `revision_needed` row must not be hidden behind
 * three verified ones — the figure is not trustworthy until the revision is
 * resolved, so the least-final status wins.
 *
 * Returns `no_data` when there are no rows at all, even if the caller passed a
 * numeric `0` as the figure. That separation is the point of this module.
 */
export function resolveDataStatus(input: StatusInput): DataStatus {
  if (input.failed) return 'failed';
  if (input.rowCount <= 0) return 'no_data';

  const statuses = new Set(input.verificationStatuses);

  // Revision outranks everything: a rejected submission is not final even if the
  // other rows were approved.
  if (statuses.has('revision_needed')) return 'revision';

  // Nothing verified or queued means the rows were never submitted for approval.
  if (statuses.size === 0) return input.isSimulated ? 'simulated' : 'not_verified';

  if (statuses.has('pending_verification') || statuses.has('draft')) return 'pending';
  if (statuses.has('verified')) {
    // Mixed verified + something else is only possible for draft/pending, already
    // handled above, so reaching here means every row is verified.
    return input.isSimulated ? 'simulated' : 'verified';
  }

  return input.isSimulated ? 'simulated' : 'not_verified';
}

/**
 * Aggregate several statuses (e.g. six modules for one branch) into one.
 *
 * `no_data` only wins when **nothing** was reported; otherwise the least-final
 * status present is surfaced so a partial report is not mistaken for a complete
 * one.
 */
export function mergeDataStatuses(statuses: DataStatus[]): DataStatus {
  const reported = statuses.filter((s): s is Exclude<DataStatus, 'no_data'> => s !== 'no_data');
  if (reported.length === 0) return 'no_data';

  const order: Array<Exclude<DataStatus, 'no_data'>> = [
    'failed',
    'revision',
    'pending',
    'not_verified',
    'simulated',
    'verified',
  ];
  for (const candidate of order) {
    if (reported.includes(candidate)) return candidate;
  }
  return 'no_data';
}

/**
 * Format a figure with its status. A missing value never renders as `0`:
 * `formatReportedValue(null, 'no_data')` returns the label, not "0".
 */
export function formatReportedValue(
  value: number | null | undefined,
  status: DataStatus,
  formatter: (value: number) => string
): { text: string; status: DataStatus; isPlaceholder: boolean } {
  const info = describeDataStatus(status);
  if (!info.hasValue || value === null || value === undefined || !Number.isFinite(value)) {
    return { text: info.label, status, isPlaceholder: true };
  }
  return { text: formatter(value), status, isPlaceholder: false };
}
