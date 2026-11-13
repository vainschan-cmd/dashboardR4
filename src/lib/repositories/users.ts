import type { User, UserRole } from '../types';
import {
  hashPasswordAsync,
  verifyPasswordAsync,
} from '../passwordHash';
import { checkPasswordStrength } from '../passwordPolicy';
import { getPool } from '../db/connection';
import { toSafeUser } from '../db/helpers';
import { scheduleUsersSpreadsheetSync } from '../db/maintenance';
import { authSessionsRepository } from './authSessions';

/**
 * User accounts (CRUD + PostgreSQL authentication).
 * Validasi otentikasi username/NIPP dan password_hash dilakukan langsung
 * ke tabel 'users' di PostgreSQL database 'ed_dashboard'.
 */
export const usersRepository = {
  getUsers: async (): Promise<User[]> => {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, username, nipp, name, email, divisi, departemen, role, branch_id, department_id, active, must_change_password, created_at
       FROM users
       ORDER BY nipp ASC, name ASC`
    );
    return res.rows.map(toSafeUser);
  },

  getUserByNipp: async (nipp: string): Promise<User | null> => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp) return null;
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, username, nipp, name, email, divisi, departemen, role, branch_id, department_id, active, must_change_password, created_at
       FROM users
       WHERE nipp = $1 OR username = $1
       LIMIT 1`,
      [cleanNipp]
    );
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },

  getUserByUsername: async (username: string): Promise<User | null> => {
    const clean = String(username || '').trim();
    if (!clean) return null;
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, username, nipp, name, email, divisi, departemen, role, branch_id, department_id, active, must_change_password, created_at
       FROM users
       WHERE username = $1 OR nipp = $1
       LIMIT 1`,
      [clean]
    );
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },

  getUserById: async (id: string): Promise<User | null> => {
    if (!id) return null;
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, username, nipp, name, email, divisi, departemen, role, branch_id, department_id, active, must_change_password, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!res.rows[0]) return null;
    return toSafeUser(res.rows[0]);
  },

  createUser: async (data: {
    nipp: string;
    name: string;
    divisi: string;
    departemen: string;
    password: string;
    role?: UserRole;
    email?: string;
    branch_id?: string | null;
    department_id?: string | null;
    mustChangePassword?: boolean;
  }): Promise<User> => {
    const cleanNipp = String(data.nipp).trim();
    const rawPassword = String(data.password || '').trim();
    const passwordPolicy = checkPasswordStrength(rawPassword);
    if (!passwordPolicy.valid) {
      throw new Error(passwordPolicy.error || 'Kata sandi tidak memenuhi kebijakan keamanan.');
    }
    const id = `usr_${cleanNipp}_${Date.now()}`;
    const role: UserRole = data.role || 'pic_cabang';
    const email = data.email || `${cleanNipp}@pelindo.co.id`;
    const hashedPassword = await hashPasswordAsync(rawPassword);
    const createdAt = new Date().toISOString();

    const pool = getPool();
    await pool.query(
      `INSERT INTO users (id, username, nipp, name, email, divisi, departemen, password_hash, role, branch_id, department_id, active, must_change_password, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13::timestamptz)`,
      [
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
        Boolean(data.mustChangePassword),
        createdAt,
      ]
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

    scheduleUsersSpreadsheetSync();
    return newUser;
  },

  updateUser: async (id: string, data: Partial<User>): Promise<User | null> => {
    const pool = getPool();
    const existingRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const existing = existingRes.rows[0];
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : String(existing.name || '');
    const cleanNipp = data.nipp !== undefined ? String(data.nipp).trim() : String(existing.nipp || existing.username || '');
    const divisi = data.divisi !== undefined ? data.divisi : String(existing.divisi || '');
    const departemen = data.departemen !== undefined ? data.departemen : String(existing.departemen || '');
    const role = (data.role !== undefined ? data.role : existing.role) as UserRole;
    const branch_id = data.branch_id !== undefined ? data.branch_id : (existing.branch_id as string | null);
    const department_id = data.department_id !== undefined ? data.department_id : (existing.department_id as string | null);
    const email = data.email !== undefined ? data.email : (String(existing.email || '') || `${cleanNipp}@pelindo.co.id`);
    const active = data.active !== undefined ? Boolean(data.active) : Boolean(existing.active);

    let passwordHash = existing.password_hash || '';
    if (data.password && data.password.trim().length > 0) {
      passwordHash = await hashPasswordAsync(data.password.trim());
    }

    await pool.query(
      `UPDATE users
       SET name = $1, username = $2, nipp = $3, divisi = $4, departemen = $5, role = $6,
           branch_id = $7, department_id = $8, email = $9, active = $10, password_hash = $11
       WHERE id = $12`,
      [name, cleanNipp, cleanNipp, divisi, departemen, role, branch_id, department_id, email, active, passwordHash, id]
    );

    const passwordChanged = Boolean(data.password && data.password.trim().length > 0);
    const securityChanged =
      passwordChanged ||
      role !== String(existing.role || '') ||
      String(branch_id ?? '') !== String(existing.branch_id ?? '') ||
      String(department_id ?? '') !== String(existing.department_id ?? '') ||
      active !== Boolean(existing.active);

    if (securityChanged) {
      await authSessionsRepository.bumpUserTokenVersion(id);
      await authSessionsRepository.revokeAllUserSessions(id, 'security_change');
    }

    scheduleUsersSpreadsheetSync();
    return usersRepository.getUserById(id);
  },

  deleteUser: async (id: string): Promise<boolean> => {
    const pool = getPool();
    await authSessionsRepository.revokeAllUserSessions(id, 'account_deleted');
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    scheduleUsersSpreadsheetSync();
    return true;
  },

  /**
   * Otentikasi username/NIPP dan password langsung terhadap tabel users di PostgreSQL.
   * Tidak ada fallback SQLite. Jika PostgreSQL mati, fungsi ini langsung melempar exception koneksi.
   */
  authenticateUser: async (nipp: string, password: string): Promise<User | null> => {
    return usersRepository.authenticateUserAsync(nipp, password);
  },

  authenticateUserAsync: async (nipp: string, password: string): Promise<User | null> => {
    const cleanNipp = String(nipp || '').trim();
    if (!cleanNipp || !password) return null;

    const pool = getPool();
    // Query langsung ke PostgreSQL. Jika container PostgreSQL berhenti, pool.query melempar ECONNREFUSED
    const res = await pool.query(
      `SELECT id, username, nipp, name, email, divisi, departemen, role, branch_id, department_id, password_hash, active, must_change_password, created_at
       FROM users
       WHERE nipp = $1 OR username = $1
       LIMIT 1`,
      [cleanNipp]
    );

    const pgRow = res.rows[0];
    if (!pgRow) {
      return null;
    }

    const storedPassword = String(pgRow.password_hash || '');
    const isMatch = await verifyPasswordAsync(password, storedPassword);

    if (!isMatch) {
      return null;
    }

    return toSafeUser({
      ...pgRow,
      username: pgRow.username || pgRow.nipp,
      nipp: pgRow.nipp || pgRow.username,
      active: Boolean(pgRow.active),
    });
  },
};
