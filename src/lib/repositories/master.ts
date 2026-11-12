import type { Branch, Department, EquipmentItem, KPIIndicator, TemplateConfig } from '../types';
import { getDb } from '../db/connection';

/**
 * Reference data: branches, departments, equipment catalogue, KPI indicators,
 * and import templates (`CODE-03`).
 *
 * Everything here is read-mostly configuration. Keeping it separate from
 * transactional data means a change to how records are written cannot
 * accidentally alter how branch metadata is loaded.
 */
export const masterRepository = {
  // Branches
  getBranches: (): Branch[] => {
    const rows = getDb().prepare('SELECT * FROM branches ORDER BY order_seq ASC, code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as Branch),
      active: Boolean(r.active),
      facilities: typeof r.facilities === 'string' && r.facilities ? JSON.parse(r.facilities) : {}
    }));
  },
  getBranchById: (id: string): Branch | null => {
    const r = getDb().prepare('SELECT * FROM branches WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...(r as unknown as Branch),
      active: Boolean(r.active),
      facilities: typeof r.facilities === 'string' && r.facilities ? JSON.parse(r.facilities) : {}
    };
  },

  // Departments
  getDepartments: (): Department[] => {
    const rows = getDb().prepare('SELECT * FROM departments ORDER BY code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as Department),
      active: Boolean(r.active)
    }));
  },

  // Equipment Catalog
  getEquipmentCatalog: (): EquipmentItem[] => {
    const rows = getDb().prepare('SELECT * FROM equipment_catalog ORDER BY code ASC').all();
    return rows.map(r => ({
      ...(r as unknown as EquipmentItem),
      active: Boolean(r.active)
    }));
  },

  // Indicators
  getIndicators: (departmentId?: string): KPIIndicator[] => {
    const db = getDb();
    let rows: Record<string, unknown>[];
    if (departmentId) {
      rows = db.prepare('SELECT * FROM kpi_indicators WHERE department_id = ? ORDER BY code ASC').all(departmentId);
    } else {
      rows = db.prepare('SELECT * FROM kpi_indicators ORDER BY department_id ASC, code ASC').all();
    }
    return rows.map(r => ({
      ...(r as unknown as KPIIndicator),
      is_core_kpi: Boolean(r.is_core_kpi),
      active: Boolean(r.active)
    }));
  },

  // Templates
  getTemplates: (): TemplateConfig[] => {
    const rows = getDb().prepare('SELECT * FROM templates ORDER BY department_id ASC').all();
    return rows.map(r => ({
      ...(r as unknown as TemplateConfig),
      columns: JSON.parse(String(r.columns || '[]'))
    }));
  },
  getTemplateByDept: (deptId: string): TemplateConfig | null => {
    const r = getDb().prepare('SELECT * FROM templates WHERE department_id = ?').get(deptId);
    if (!r) return null;
    return {
      ...(r as unknown as TemplateConfig),
      columns: JSON.parse(String(r.columns || '[]'))
    };
  },
  saveTemplate: (template: TemplateConfig) => {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(template.id);
    if (existing) {
      db.prepare(`
        UPDATE templates 
        SET department_id = ?, version = ?, name = ?, description = ?, columns = ?, updated_at = ?
        WHERE id = ?
      `).run(
        template.department_id,
        template.version,
        template.name,
        template.description,
        JSON.stringify(template.columns),
        new Date().toISOString(),
        template.id
      );
    } else {
      db.prepare(`
        INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        template.id,
        template.department_id,
        template.version,
        template.name,
        template.description,
        JSON.stringify(template.columns),
        new Date().toISOString()
      );
    }
  },
};
