/**
 * Tab vocabulary for the dashboard shell (`CODE-02`).
 *
 * The tab identifiers used to be a `Set` literal buried in `page.tsx`, with a
 * second, hand-maintained list for the governance tabs. Two lists meant the
 * `?tab=` guard and the "is this a governance view" check could drift apart, and
 * a typo would silently render an empty page. Both now come from here.
 */

/** Every tab the shell can render. Anything else in `?tab=` is ignored. */
export const VALID_TABS = [
  'beranda',
  'periode',
  'keuangan',
  'opkom',
  'kinerja',
  'utilisasi',
  'peralatan',
  'fasilitas',
  'data_records',
  'master_data',
  'verification',
  'import_center',
  'templates',
  'audit_trail',
] as const;

export type DashboardTab = (typeof VALID_TABS)[number];

const VALID_TAB_SET: ReadonlySet<string> = new Set(VALID_TABS);

export function isValidTab(value: string | null): value is DashboardTab {
  return value !== null && VALID_TAB_SET.has(value);
}

/**
 * Tabs that expose raw records, import, or audit trails.
 *
 * These are hidden from the `viewer` (BOD) persona: the persona is meant to read
 * results, not inspect the machinery that produced them.
 */
export const GOVERNANCE_TABS = [
  'data_records',
  'master_data',
  'verification',
  'import_center',
  'templates',
  'audit_trail',
] as const;

const GOVERNANCE_TAB_SET: ReadonlySet<string> = new Set(GOVERNANCE_TABS);

export function isGovernanceTab(tab: string): boolean {
  return GOVERNANCE_TAB_SET.has(tab);
}
