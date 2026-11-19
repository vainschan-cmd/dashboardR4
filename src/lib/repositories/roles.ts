import { getPool } from '../db/connection';
import type { Permission } from '../types';
import { registerCustomRoleKey, unregisterCustomRoleKey } from '../validation';
import {
  RoleMetadata,
  CANONICAL_ROLES_METADATA,
} from '../roleDefinitions';

export type { RoleMetadata, PermissionGroup } from '../roleDefinitions';
export { CANONICAL_ROLES_METADATA, PERMISSION_GROUPS } from '../roleDefinitions';

export const rolesRepository = {
  /**
   * Mengambil semua daftar custom roles dari tabel integration_settings.
   */
  getCustomRoles: async (): Promise<RoleMetadata[]> => {
    try {
      const pool = getPool();
      const res = await pool.query(
        "SELECT config_json FROM integration_settings WHERE service_name = 'custom_roles'"
      );
      if (!res.rows[0]) return [];
      const raw = res.rows[0].config_json;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: Partial<RoleMetadata>) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        description: String(item.description || ''),
        category: 'custom' as const,
        scope: (item.scope || 'regional') as 'global' | 'regional' | 'cabang',
        permissions: Array.isArray(item.permissions) ? (item.permissions as Permission[]) : [],
        is_deletable: true,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Mengambil semua roles (sistem bawaan + kustom) beserta jumlah pengguna aktif.
   */
  getAllRolesWithCounts: async (): Promise<RoleMetadata[]> => {
    const customRoles = await rolesRepository.getCustomRoles();
    const allRoles: RoleMetadata[] = [...CANONICAL_ROLES_METADATA, ...customRoles];

    try {
      const pool = getPool();
      const countRes = await pool.query(
        'SELECT role, COUNT(*)::int as count FROM users WHERE active = true GROUP BY role'
      );
      const countsMap = new Map<string, number>();
      for (const row of countRes.rows) {
        countsMap.set(String(row.role).toLowerCase(), Number(row.count) || 0);
      }

      return allRoles.map((role) => ({
        ...role,
        user_count: countsMap.get(role.id.toLowerCase()) || 0,
      }));
    } catch {
      return allRoles.map((role) => ({ ...role, user_count: 0 }));
    }
  },

  /**
   * Menyimpan atau menambahkan role kustom baru.
   */
  saveCustomRole: async (roleData: {
    id: string;
    name: string;
    description: string;
    scope: 'global' | 'regional' | 'cabang';
    permissions: Permission[];
  }): Promise<RoleMetadata> => {
    const cleanId = roleData.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');

    // Pastikan ID tidak menimpa canonical system role
    const isSystemRole = CANONICAL_ROLES_METADATA.some((r) => r.id === cleanId);
    if (isSystemRole) {
      throw new Error(`ID Peran '${cleanId}' merupakan peran sistem inti dan tidak dapat dibuat ulang.`);
    }

    const currentCustomRoles = await rolesRepository.getCustomRoles();
    const existingIndex = currentCustomRoles.findIndex((r) => r.id === cleanId);

    const now = new Date().toISOString();
    const newRole: RoleMetadata = {
      id: cleanId,
      name: roleData.name.trim(),
      description: roleData.description.trim(),
      category: 'custom',
      scope: roleData.scope || 'regional',
      permissions: Array.from(new Set(roleData.permissions)),
      is_deletable: true,
      created_at: existingIndex >= 0 ? currentCustomRoles[existingIndex].created_at : now,
      updated_at: now,
    };

    if (existingIndex >= 0) {
      currentCustomRoles[existingIndex] = newRole;
    } else {
      currentCustomRoles.push(newRole);
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_custom_roles', 'custom_roles', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(currentCustomRoles), now]
    );

    registerCustomRoleKey(cleanId);
    return newRole;
  },

  /**
   * Menghapus role kustom.
   * Tidak dapat menghapus role sistem, atau role yang masih memiliki pengguna terdaftar.
   */
  deleteCustomRole: async (roleId: string): Promise<boolean> => {
    const cleanId = roleId.trim().toLowerCase();

    // Tidak boleh menghapus sistem role
    if (CANONICAL_ROLES_METADATA.some((r) => r.id === cleanId)) {
      throw new Error('Peran sistem inti dilindungi dan tidak dapat dihapus.');
    }

    const pool = getPool();
    // Periksa apakah ada pengguna aktif dengan role ini
    const userCheck = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE role = $1', [cleanId]);
    const userCount = Number(userCheck.rows[0]?.count) || 0;
    if (userCount > 0) {
      throw new Error(`Peran tidak dapat dihapus karena masih digunakan oleh ${userCount} pengguna.`);
    }

    const currentCustomRoles = await rolesRepository.getCustomRoles();
    const filtered = currentCustomRoles.filter((r) => r.id !== cleanId);

    if (filtered.length === currentCustomRoles.length) {
      return false; // tidak ditemukan
    }

    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO integration_settings (id, service_name, config_json, updated_at)
       VALUES ('cfg_custom_roles', 'custom_roles', $1::jsonb, $2::timestamptz)
       ON CONFLICT (service_name) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(filtered), now]
    );

    unregisterCustomRoleKey(cleanId);
    return true;
  },
};
