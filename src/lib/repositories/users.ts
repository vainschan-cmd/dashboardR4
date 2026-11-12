import { randomBytes } from 'node:crypto';
import type { User, UserRole } from '../types';
import {
  hashPassword,
  hashPasswordAsync,
  isPasswordHashed,
  verifyPassword,
  verifyPasswordAsync,
} from '../passwordHash';
import { checkPasswordStrength } from '../passwordPolicy';
import { getDb } from '../db/connection';
import { toSafeUser } from '../db/helpers';
import { scheduleUsersSpreadsheetSync, getDummyPasswordHash } from '../db/maintenance';
import { authSessionsRepository } from './authSessions';

/**
 * User accounts (`CODE-03`): CRUD plus authentication.
 *
 * Any change that alters a user's security posture (password, role, branch,
 * department, active flag) bumps `token_version` and drops their sessions, so a
 * privilege reduction takes effect on the next request, not at token expiry.
 */
export const usersRepository = {
  // Users / PIC (Always sanitized via toSafeUser so password hash is never exposed)
  getUsers: (): User[] => {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY nipp ASC, name ASC').all();
    return rows.map(toSafeUser);
  },
  getUserByNipp: (nipp: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE nipp = ? OR username = ?').get(nipp, nipp);
    if (!r) return null;
    return toSafeUser(r);
  },
  getUserByUsername: (username: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE username = ? OR nipp = ?').get(username, username);
    if (!r) return null;
    return toSafeUser(r);
  },
  getUserById: (id: string): User | null => {
    const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!r) return null;
    return toSafeUser(r);
  },
  createUser: (data: {
    nipp: string;
    name: string;
    divisi: string;
    departemen: string;
    password: string;
    role?: UserRole;
    email?: string;
    branch_id?: string | null;
    department_id?: string | null;
    /** Force a password change at first login (used for bootstrap/imported credentials). */
    mustChangePassword?: boolean;
  }): User => {
    const db = getDb();
    const cleanNipp = String(data.nipp).trim();
    const rawPassword = String(data.password || '').trim();
    const passwordPolicy = checkPasswordStrength(rawPassword);
    if (!passwordPolicy.valid) {
      throw new Error(passwordPolicy.error || 'Kata sandi tidak memenuhi kebijakan keamanan.');
    }
    const id = `usr_${cleanNipp}_${Date.now()}`;
    const role: UserRole = data.role || 'pic_cabang';
    const email = data.email || `${cleanNipp}@pelindo.co.id`;
    const hashedPassword = hashPassword(rawPassword);
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO users (id, username, nipp, name, email, divisi, departemen, password, role, branch_id, department_id, active, must_change_password, password_updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    stmt.run(
      id,
      cleanNipp,
      cleanNipp,
      data.name.trim(),
      email,
      data.divisi.trim(),
      data.departemen.trim(),
      hashedPassword,
      role,
      data.branch_id || null,
      data.department_id || null,
      data.mustChangePassword ? 1 : 0,
      createdAt,
      createdAt
    );

    const newUser: User = {
      id,
      username: cleanNipp,
      nipp: cleanNipp,
      name: data.name.trim(),
      email,
      divisi: data.divisi.trim(),
      departemen: data.departemen.trim(),
      role,
      branch_id: data.branch_id || null,
      department_id: data.department_id || null,
      active: true,
      must_change_password: Boolean(data.mustChangePassword),
      created_at: createdAt,
    };

    // Mirror the roster to the spreadsheet in the background: it is a convenience
    // file, not the source of truth, so it must not delay the HTTP response.
    scheduleUsersSpreadsheetSync();

    return newUser;
  },
  updateUser: (id: string, data: Partial<User>): User | null => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : String(existing.name || '');
    const cleanNipp = data.nipp !== undefined ? String(data.nipp).trim() : String(existing.nipp || existing.username || '');
    const divisi = data.divisi !== undefined ? data.divisi : String(existing.divisi || '');
    const departemen = data.departemen !== undefined ? data.departemen : String(existing.departemen || '');
    const role = (data.role !== undefined ? data.role : existing.role) as UserRole;
    const branch_id = data.branch_id !== undefined ? data.branch_id : (existing.branch_id as string | null);
    const department_id = data.department_id !== undefined ? data.department_id : (existing.department_id as string | null);
    const email = data.email !== undefined ? data.email : (String(existing.email || '') || `${cleanNipp}@pelindo.co.id`);
    const active = data.active !== undefined ? (data.active ? 1 : 0) : Number(existing.active ?? 1);
    const existingPwd = String(existing.password || '');
    const password =
      data.password && data.password.trim().length > 0
        ? hashPassword(data.password.trim())
        : isPasswordHashed(existingPwd)
          ? existingPwd
          : hashPassword(existingPwd || randomBytes(16).toString('hex'));

    db.prepare(`
      UPDATE users 
      SET name = ?, username = ?, nipp = ?, divisi = ?, departemen = ?, role = ?, branch_id = ?, department_id = ?, email = ?, active = ?, password = ?
      WHERE id = ?
    `).run(name, cleanNipp, cleanNipp, divisi, departemen, role, branch_id, department_id, email, active, password, id);

    // Invalidate all existing sessions whenever identity, role, scope, status, or credential changes.
    const passwordChanged = Boolean(data.password && data.password.trim().length > 0);
    const securityChanged =
      passwordChanged ||
      role !== String(existing.role || '') ||
      String(branch_id ?? '') !== String(existing.branch_id ?? '') ||
      String(department_id ?? '') !== String(existing.department_id ?? '') ||
      active !== Number(existing.active ?? 1);
    if (securityChanged) {
      authSessionsRepository.bumpUserTokenVersion(id);
      authSessionsRepository.revokeAllUserSessions(id, 'security_change');
    }

    scheduleUsersSpreadsheetSync();

    return usersRepository.getUserById(id);
  },
  deleteUser: (id: string): boolean => {
    const db = getDb();
    authSessionsRepository.revokeAllUserSessions(id, 'account_deleted');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    scheduleUsersSpreadsheetSync();
    return true;
  },
  authenticateUser: (nipp: string, password: string): User | null => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp || !password) return null;

    const db = getDb();
    const rawRow = db.prepare('SELECT * FROM users WHERE nipp = ? OR username = ?').get(cleanNipp, cleanNipp);

    if (!rawRow) {
      // Constant-ish work for unknown identifiers so response time does not reveal
      // whether a NIPP exists. The result is intentionally always false.
      verifyPassword(password, getDummyPasswordHash());
      return null;
    }

    const storedPassword = String(rawRow.password || '');
    if (!verifyPassword(password, storedPassword)) {
      return null;
    }

    // Upgrade to scrypt hash if row was somehow not yet hashed
    if (!isPasswordHashed(storedPassword)) {
      try {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), String(rawRow.id));
      } catch (e) {
        console.warn('[DB] Gagal memutakhirkan hash kata sandi:', e);
      }
    }

    return toSafeUser(rawRow);
  },

  /**
   * Non-blocking authentication used by the login endpoint.
   *
   * scrypt is deliberately slow (~100 ms). Running it synchronously blocks the
   * Node event loop, so one login at a time could stall every other request on
   * the process. The async variant keeps the same semantics.
   */
  authenticateUserAsync: async (nipp: string, password: string): Promise<User | null> => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp || !password) return null;

    const db = getDb();
    const rawRow = db
      .prepare('SELECT * FROM users WHERE nipp = ? OR username = ?')
      .get(cleanNipp, cleanNipp) as Record<string, unknown> | undefined;

    if (!rawRow) {
      // Constant-ish work for unknown identifiers so response time does not reveal
      // whether a NIPP exists. The result is intentionally always false.
      await verifyPasswordAsync(password, getDummyPasswordHash());
      return null;
    }

    const storedPassword = String(rawRow.password || '');
    if (!(await verifyPasswordAsync(password, storedPassword))) {
      return null;
    }

    // Upgrade to a scrypt hash if the row was somehow not yet hashed
    if (!isPasswordHashed(storedPassword)) {
      try {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
          await hashPasswordAsync(password),
          String(rawRow.id)
        );
      } catch (e) {
        console.warn('[DB] Gagal memutakhirkan hash kata sandi:', e);
      }
    }

    return toSafeUser(rawRow);
  },
};
