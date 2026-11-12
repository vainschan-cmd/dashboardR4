/**
 * Four-eyes rule (`RBAC-14`).
 *
 * One person may not submit a figure and then approve it. That is the whole
 * control: if the uploader can also verify, "verification" is a formality that
 * documents nothing, and an accidental or deliberate error reaches the board
 * with a green tick beside it.
 *
 * The rule lives here rather than inline in the verification handler because it
 * now applies to several sources of identity:
 *
 * - `monthly_records.uploaded_by`
 * - `module_*.uploaded_by` — the same figures are written into six module tables,
 *   each with its own uploader
 * - legacy rows that stored a display name instead of a NIPP
 *
 * Kept dependency-free so it can be reasoned about and tested without a database.
 */

export interface ActorIdentity {
  /** Stable employee id. This is the identity that matters. */
  nipp?: string | null;
  /** Display name, used only to recognise legacy rows that stored a name. */
  name?: string | null;
  /** Session subject (users.id), for the same purpose. */
  sub?: string | null;
}

export interface UploaderConflict {
  /** The uploader value that matched the actor. */
  uploader: string;
  /** Which field matched — useful for the audit trail and for support. */
  matchedOn: 'nipp' | 'name' | 'sub';
}

function normalise(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Does any of these uploader identities belong to the acting user?
 *
 * NIPP and session id are compared exactly (after trimming and case folding).
 * Display names are compared too, but only as a fallback for rows written before
 * NIPPs were recorded — a name match is weaker evidence, and the audit message
 * says which one matched so nobody has to guess.
 *
 * Returns the first conflict, or `null` when the actor is a genuinely different
 * person from every uploader.
 */
export function findUploaderConflict(
  actor: ActorIdentity,
  uploaders: Array<string | null | undefined>
): UploaderConflict | null {
  const nipp = normalise(actor.nipp);
  const name = normalise(actor.name);
  const sub = normalise(actor.sub);

  for (const raw of uploaders) {
    const uploader = normalise(raw);
    if (!uploader) continue;
    // Report the uploader as it is stored: the audit trail and support should see
    // the value that is actually in the database, not a normalised copy.
    const asStored = String(raw ?? '').trim();
    if (nipp && uploader === nipp) return { uploader: asStored, matchedOn: 'nipp' };
    if (sub && uploader === sub) return { uploader: asStored, matchedOn: 'sub' };
    if (name && uploader === name) return { uploader: asStored, matchedOn: 'name' };
  }
  return null;
}

/**
 * The full chain check: a verifier must differ from the uploader, and — when a
 * separate approval step exists — the approver must differ from both.
 *
 * Currently the same person performs "verify" and "approve" in one action, so this
 * collapses to the uploader check; it is expressed as a chain so adding a distinct
 * approval role later cannot silently reintroduce self-approval.
 */
export function checkSeparationOfDuties(
  actor: ActorIdentity,
  chain: { uploaders: Array<string | null | undefined> }
): { allowed: true } | { allowed: false; conflict: UploaderConflict } {
  const conflict = findUploaderConflict(actor, chain.uploaders);
  return conflict ? { allowed: false, conflict } : { allowed: true };
}

/** Message shown to the user; names the record so support can find it. */
export function fourEyesMessage(conflict: UploaderConflict, recordId?: string): string {
  const where = recordId ? ` (${recordId})` : '';
  const basis =
    conflict.matchedOn === 'name'
      ? 'nama akun Anda tercatat sebagai pengunggah'
      : 'akun Anda tercatat sebagai pengunggah';
  return `Prinsip Four-Eyes: data${where} harus diverifikasi oleh orang lain, tetapi ${basis}. Minta rekan lain memverifikasi, atau minta Admin Regional meninjau ulang.`;
}
