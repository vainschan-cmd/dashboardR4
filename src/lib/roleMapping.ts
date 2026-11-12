import type { UserRole } from './types';

/**
 * Strict role parsing for data that comes from a file (`FEAT-10`).
 *
 * Why this exists
 * ---------------
 * The previous parser matched substrings:
 *
 * ```ts
 * if (str.includes('super')) return 'super_admin';
 * ```
 *
 * That is a privilege-escalation path, not a formatting convenience. In a port
 * company "Supervisor" and "Superintendent" are ordinary job titles, so a staff
 * spreadsheet imported by a Super Admin silently promoted every supervisor to
 * Super Admin. The same bug also ran the other way: `"PIC Dept Regional 4"`
 * contains "regional 4" and became `admin_regional`.
 *
 * The rule now: a role is only honoured when the cell matches a known name
 * exactly (after normalising case, spacing, and punctuation). Anything else
 * returns `null`, and the caller rejects the row with a message naming the value
 * it could not understand. Refusing to guess is the whole point — a wrong guess
 * here grants access.
 */

/** Canonical roles, ranked so "may this actor grant that role?" is answerable. */
export const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 3,
  admin_regional: 2,
  pic_dept_regional: 1,
  pic_cabang: 1,
  viewer: 0,
};

/**
 * Accepted spellings per role. Keys are already normalised by `normaliseToken`,
 * so they must be lowercase, single-spaced, and free of punctuation.
 */
const ROLE_SYNONYMS: Record<UserRole, string[]> = {
  super_admin: ['super admin', 'superadmin', 'super admin regional'],
  admin_regional: [
    'admin regional',
    'admin regional 4',
    'administrator regional',
    'administrator regional 4',
  ],
  pic_dept_regional: [
    'pic dept regional',
    'pic dept regional 4',
    'pic departemen regional',
    'pic departemen regional 4',
  ],
  pic_cabang: ['pic cabang', 'pic cabang pelabuhan', 'pic terminal', 'pic pelabuhan'],
  // The UI labels this role "BOD Regional 4 (Viewer)"; a file written from that
  // label must land on `viewer`, not on an administrative role.
  viewer: ['viewer', 'bod', 'bod regional', 'bod regional 4', 'viewer bod', 'bod viewer'],
};

/**
 * Lowercase, collapse whitespace, and drop characters that vary between
 * spreadsheet exports (`_`, `-`, `.`, parentheses, slashes).
 */
export function normaliseToken(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[_.\-()/[\]%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYM_INDEX: Map<string, UserRole> = new Map(
  (Object.entries(ROLE_SYNONYMS) as Array<[UserRole, string[]]>).flatMap(([role, names]) => [
    [normaliseToken(role), role] as [string, UserRole],
    ...names.map((name) => [normaliseToken(name), role] as [string, UserRole]),
  ])
);

/**
 * Resolve a role cell to a canonical role, or `null` when it is not recognised.
 * Never guesses and never falls back to a default.
 */
export function parseRoleStrict(raw: unknown): UserRole | null {
  const token = normaliseToken(raw);
  if (!token) return null;
  return SYNONYM_INDEX.get(token) ?? null;
}

/** Every accepted spelling, for error messages. */
export function describeAllowedRoles(): string {
  return Object.entries(ROLE_SYNONYMS)
    .map(([role, names]) => `${role} (${names.join(' / ')})`)
    .join('; ');
}

/**
 * May `actorRole` grant `requestedRole` through a bulk channel such as a file
 * import? An actor may only hand out roles strictly below its own rank, with one
 * exception: a Super Admin may create another Super Admin.
 *
 * This is deliberately stricter than the interactive form. A single mistaken
 * cell in a spreadsheet affects many accounts at once and nobody reads a
 * 300-row import result carefully, so the blast radius is capped.
 */
export function canGrantRole(actorRole: UserRole | null | undefined, requestedRole: UserRole): boolean {
  if (!actorRole) return false;
  if (actorRole === 'super_admin') return true;
  const actorRank = ROLE_RANK[actorRole] ?? 0;
  const requestedRank = ROLE_RANK[requestedRole] ?? 0;
  // Strictly below, and never `super_admin` (handled above).
  return requestedRank < actorRank && requestedRole !== 'super_admin';
}
