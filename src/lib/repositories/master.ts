import type { Branch, Department, EquipmentItem, KPIIndicator, TemplateConfig } from '../types';
import { OFFICIAL_BRANCHES } from '../constants';
import { getPool } from '../db/connection';

const STATIC_BRANCHES: Branch[] = OFFICIAL_BRANCHES.map((b) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  region: 'Regional 4',
  address: `Pelabuhan ${b.name}`,
  phone: '0411-123456',
  email: `${b.code.toLowerCase()}@pelindo.co.id`,
  active: true,
  facilities: {
    dermaga_length_m: 500,
    kolam_depth_mlws: 12,
    lapangan_sqm: 25000,
    crane_units: 4,
    forklift_units: 8,
  },
  order_seq: b.order,
}));

const STATIC_DEPARTMENTS: Department[] = [
  { id: 'dept_keu', code: 'KEU', name: 'Keuangan', pic_name: 'PIC Keuangan', pic_email: 'keu@pelindo.co.id', active: true, description: 'Divisi Finansial Regional 4' },
  { id: 'dept_ops', code: 'OPS', name: 'Operasi & Pelayanan Kapal', pic_name: 'PIC Operasi', pic_email: 'ops@pelindo.co.id', active: true, description: 'Divisi Operasional & Kargo' },
  { id: 'dept_pel', code: 'PEL', name: 'Komersial & Pelayanan Pelanggan', pic_name: 'PIC Komersial', pic_email: 'pel@pelindo.co.id', active: true, description: 'Divisi Komersial' },
  { id: 'dept_tek', code: 'TEK', name: 'Teknik', pic_name: 'PIC Teknik', pic_email: 'tek@pelindo.co.id', active: true, description: 'Divisi Fasilitas & Peralatan' },
  { id: 'dept_hsse', code: 'HSSE', name: 'HSSE', pic_name: 'PIC HSSE', pic_email: 'hsse@pelindo.co.id', active: true, description: 'Health, Safety, Security & Environment' },
  { id: 'dept_sdm', code: 'SDM', name: 'SDM & Umum', pic_name: 'PIC SDM', pic_email: 'sdm@pelindo.co.id', active: true, description: 'Sumber Daya Manusia & Umum' },
];

export const STATIC_EQUIPMENT: EquipmentItem[] = [
  { id: 'eq_al01', code: 'AL01', name: 'Quay Container Crane', acronym: 'QCC', category: 'OPERASI KAPAL', active: true, unit_count: 20, record_count: 262 },
  { id: 'eq_al02', code: 'AL02', name: 'Harbour Mobile Crane', acronym: 'HMC', category: 'OPERASI KAPAL', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al03', code: 'AL03', name: 'Fixed Crane', acronym: 'FC', category: 'OPERASI KAPAL', active: true, unit_count: 4, record_count: 58 },
  { id: 'eq_al04', code: 'AL04', name: 'Rubber Tyred Gantry Crane', acronym: 'RTG', category: 'OPERASI LAPANGAN', active: true, unit_count: 61, record_count: 625 },
  { id: 'eq_al05', code: 'AL05', name: 'Reach Stacker', acronym: 'RS', category: 'OPERASI LAPANGAN', active: true, unit_count: 16, record_count: 481 },
  { id: 'eq_al06', code: 'AL06', name: 'Side Loader', acronym: 'SL', category: 'OPERASI LAPANGAN', active: true, unit_count: 10, record_count: 91 },
  { id: 'eq_al07', code: 'AL07', name: 'Top Loader', acronym: 'TL', category: 'OPERASI LAPANGAN', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al08', code: 'AL08', name: 'Head Truck', acronym: 'HT', category: 'OPERASI LAPANGAN', active: true, unit_count: 44, record_count: 959 },
  { id: 'eq_al09', code: 'AL09', name: 'Terminal Tractor', acronym: 'TT', category: 'OPERASI LAPANGAN', active: true, unit_count: 63, record_count: 645 },
  { id: 'eq_al10', code: 'AL10', name: 'Chassis', acronym: 'CH', category: 'OPERASI LAPANGAN', active: true, unit_count: 134, record_count: 1555 },
  { id: 'eq_al11', code: 'AL11', name: 'Mobile Crane', acronym: 'MC', category: 'OPERASI LAPANGAN', active: true, unit_count: 7, record_count: 93 },
  { id: 'eq_al12', code: 'AL12', name: 'Hopper', acronym: 'HO', category: 'OPERASI LAPANGAN', active: true, unit_count: 3, record_count: 27 },
  { id: 'eq_al13', code: 'AL13', name: 'Excavator', acronym: 'EXC', category: 'OPERASI LAPANGAN', active: true, unit_count: 4, record_count: 36 },
  { id: 'eq_al14', code: 'AL14', name: 'Dump Truck', acronym: 'DT', category: 'OPERASI LAPANGAN', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al15', code: 'AL15', name: 'Tronton', acronym: 'TR', category: 'OPERASI LAPANGAN', active: true, unit_count: 20, record_count: 438 },
  { id: 'eq_al16', code: 'AL16', name: 'Forklift', acronym: 'FL', category: 'OPERASI LAPANGAN', active: true, unit_count: 44, record_count: 600 },
  { id: 'eq_al17', code: 'AL17', name: 'Wheel Loader', acronym: 'WL', category: 'OPERASI LAPANGAN', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al18', code: 'AL18', name: 'Kapal Tunda', acronym: 'KT', category: 'ALAT APUNG', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al19', code: 'AL19', name: 'Kapal Pandu', acronym: 'MP', category: 'ALAT APUNG', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al20', code: 'AL20', name: 'Grab', acronym: 'GRAB', category: 'OPERASI KAPAL', active: true, unit_count: 2, record_count: 18 },
  { id: 'eq_al21', code: 'AL21', name: 'Timbangan', acronym: 'TIMB', category: 'OPERASI LAPANGAN', active: true, unit_count: 0, record_count: 0 },
  { id: 'eq_al22', code: 'AL22', name: 'Trailer', acronym: 'TRL', category: 'OPERASI LAPANGAN', active: true, unit_count: 9, record_count: 110 },
  { id: 'eq_al23', code: 'AL23', name: 'Truk', acronym: 'TRK', category: 'OPERASI LAPANGAN', active: true, unit_count: 2, record_count: 20 },
  { id: 'eq_al24', code: 'AL24', name: 'Crawler Crane', acronym: 'CC', category: 'OPERASI LAPANGAN', active: true, unit_count: 1, record_count: 10 },
  { id: 'eq_al25', code: 'AL25', name: 'Lowbed', acronym: 'LB', category: 'OPERASI LAPANGAN', active: true, unit_count: 1, record_count: 9 },
  { id: 'eq_al26', code: 'AL26', name: 'Ramp Door', acronym: 'RD', category: 'OPERASI KAPAL', active: true, unit_count: 1, record_count: 9 },
];

const STATIC_INDICATORS: KPIIndicator[] = [
  { id: 'kpi_teus', code: 'OPS-TEUS', name: 'Arus Petikemas', department_id: 'dept_ops', category: 'Kargo', unit: 'TEUs', direction: 'higher_is_better', default_target: 1026000, is_core_kpi: true, active: true },
  { id: 'kpi_cargo', code: 'OPS-CARGO', name: 'Arus Barang', department_id: 'dept_ops', category: 'Kargo', unit: 'Ton', direction: 'higher_is_better', default_target: 8300000, is_core_kpi: true, active: true },
  { id: 'kpi_call', code: 'OPS-CALL', name: 'Kunjungan Kapal', department_id: 'dept_ops', category: 'Trafik', unit: 'Call', direction: 'higher_is_better', default_target: 1800, is_core_kpi: true, active: true },
  { id: 'kpi_rev', code: 'KEU-REV', name: 'Pendapatan Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 2010.0, is_core_kpi: true, active: true },
  { id: 'kpi_cost', code: 'KEU-COST', name: 'Beban Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'lower_is_better', default_target: 1425.0, is_core_kpi: true, active: true },
  { id: 'kpi_profit', code: 'KEU-OP', name: 'Laba Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 585.0, is_core_kpi: true, active: true },
  { id: 'kpi_net_profit', code: 'KEU-NET', name: 'Laba Bersih', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 450.0, is_core_kpi: true, active: true },
  { id: 'kpi_rfu', code: 'TEK-RFU', name: 'Kesiapan Alat (RFU)', department_id: 'dept_tek', category: 'Keandalan', unit: '%', direction: 'higher_is_better', default_target: 92.0, is_core_kpi: true, active: true },
  { id: 'kpi_bor', code: 'OPS-BOR', name: 'Berth Occupancy Ratio (BOR)', department_id: 'dept_ops', category: 'Fasilitas', unit: '%', direction: 'lower_is_better', default_target: 60.0, is_core_kpi: true, active: true },
];

const dynamicTemplates: TemplateConfig[] = [
  {
    id: 'tpl_keu_v1',
    department_id: 'dept_keu',
    version: '1.0',
    name: 'Template Laporan Keuangan Konsolidasi',
    description: 'Format baku unggah bulanan data keuangan cabang dan entitas',
    columns: [
      { column_name: 'Kode Cabang', field_key: 'branch_code', data_type: 'string', required: true, sample_value: 'R01' },
      { column_name: 'Rekening', field_key: 'rekening', data_type: 'string', required: true, sample_value: 'Pendapatan' },
      { column_name: 'Realisasi', field_key: 'realisasi', data_type: 'number', required: true, sample_value: 1250000000 },
    ],
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_ops_v1',
    department_id: 'dept_ops',
    version: '1.0',
    name: 'Template Laporan Operasi & Komersial',
    description: 'Format baku unggah data arus kargo dan kunjungan kapal',
    columns: [
      { column_name: 'Kode Cabang', field_key: 'branch_code', data_type: 'string', required: true, sample_value: 'R01' },
      { column_name: 'Kode Indikator', field_key: 'indicator_code', data_type: 'string', required: true, sample_value: 'OPS-TEUS' },
      { column_name: 'Target', field_key: 'target', data_type: 'number', required: true, sample_value: 1000 },
      { column_name: 'Realisasi', field_key: 'realization', data_type: 'number', required: true, sample_value: 950 },
    ],
    updated_at: new Date().toISOString(),
  },
];

export const masterRepository = {
  // Branches
  getBranches: (): Branch[] => {
    return STATIC_BRANCHES;
  },

  getBranchById: (id: string): Branch | null => {
    const clean = id.trim().toLowerCase();
    return (
      STATIC_BRANCHES.find(
        (b) => b.id.toLowerCase() === clean || b.code.toLowerCase() === clean
      ) || null
    );
  },

  // Departments
  getDepartments: (): Department[] => {
    return STATIC_DEPARTMENTS;
  },

  getDepartmentById: (id: string): Department | null => {
    const clean = id.trim().toLowerCase();
    return (
      STATIC_DEPARTMENTS.find(
        (d) => d.id.toLowerCase() === clean || d.code.toLowerCase() === clean
      ) || null
    );
  },

  // Equipment Catalog (from PostgreSQL equipment_catalog with fallback)
  getEquipmentCatalog: async (): Promise<EquipmentItem[]> => {
    try {
      const pool = getPool();
      const res = await pool.query(
        `SELECT
           ec.id,
           ec.code,
           ec.name,
           ec.acronym,
           ec.category,
           ec.active,
           COALESCE(stats.unit_count, 0)::int as unit_count,
           COALESCE(stats.record_count, 0)::int as record_count
         FROM equipment_catalog ec
         LEFT JOIN (
           SELECT
             CASE
               WHEN UPPER(jenis_alat) LIKE '%QUAY%' THEN 'AL01'
               WHEN UPPER(jenis_alat) LIKE '%HARBOUR%' THEN 'AL02'
               WHEN UPPER(jenis_alat) LIKE '%FIXED%' THEN 'AL03'
               WHEN UPPER(jenis_alat) LIKE '%RUBBER%' THEN 'AL04'
               WHEN UPPER(jenis_alat) LIKE '%REACH%' THEN 'AL05'
               WHEN UPPER(jenis_alat) LIKE '%SIDE%' THEN 'AL06'
               WHEN UPPER(jenis_alat) LIKE '%TOP%' THEN 'AL07'
               WHEN UPPER(jenis_alat) LIKE '%HEAD%' THEN 'AL08'
               WHEN UPPER(jenis_alat) LIKE '%TERMINAL%' THEN 'AL09'
               WHEN UPPER(jenis_alat) LIKE '%CHASSIS%' THEN 'AL10'
               WHEN UPPER(jenis_alat) LIKE '%MOBILE%' THEN 'AL11'
               WHEN UPPER(jenis_alat) LIKE '%HOPPER%' THEN 'AL12'
               WHEN UPPER(jenis_alat) LIKE '%EXCAVATOR%' THEN 'AL13'
               WHEN UPPER(jenis_alat) LIKE '%DUMP%' THEN 'AL14'
               WHEN UPPER(jenis_alat) LIKE '%TRONTON%' THEN 'AL15'
               WHEN UPPER(jenis_alat) LIKE '%FORKLIFT%' THEN 'AL16'
               WHEN UPPER(jenis_alat) LIKE '%WHEEL%' THEN 'AL17'
               WHEN UPPER(jenis_alat) LIKE '%TUNDA%' THEN 'AL18'
               WHEN UPPER(jenis_alat) LIKE '%PANDU%' THEN 'AL19'
               WHEN UPPER(jenis_alat) LIKE '%GRAB%' THEN 'AL20'
               WHEN UPPER(jenis_alat) LIKE '%TIMBANGAN%' THEN 'AL21'
               WHEN UPPER(jenis_alat) LIKE '%TRAILER%' THEN 'AL22'
               WHEN UPPER(jenis_alat) = 'TRUK' THEN 'AL23'
               WHEN UPPER(jenis_alat) LIKE '%CRAWLER%' THEN 'AL24'
               WHEN UPPER(jenis_alat) LIKE '%LOWB%' THEN 'AL25'
               WHEN UPPER(jenis_alat) LIKE '%RAMP%' THEN 'AL26'
               ELSE NULL
             END as mapped_code,
             COUNT(DISTINCT nama_alat) as unit_count,
             COUNT(*) as record_count
           FROM module_peralatan
           GROUP BY 1
         ) stats ON stats.mapped_code = ec.code
         WHERE ec.active = TRUE
         ORDER BY ec.code ASC`
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: String(r.id),
          code: String(r.code).trim(),
          name: String(r.name).trim(),
          acronym: String(r.acronym || '').trim(),
          category: String(r.category || 'OPERASIONAL').trim(),
          active: Boolean(r.active),
          unit_count: Number(r.unit_count || 0),
          record_count: Number(r.record_count || 0),
        }));
      }
    } catch {
      // Fallback to static catalog if DB connection is unavailable
    }
    return STATIC_EQUIPMENT;
  },

  // Indicators
  getIndicators: (departmentId?: string): KPIIndicator[] => {
    if (!departmentId) return STATIC_INDICATORS;
    return STATIC_INDICATORS.filter((i) => i.department_id === departmentId);
  },

  getIndicatorById: (id: string): KPIIndicator | null => {
    const clean = id.trim().toLowerCase();
    return (
      STATIC_INDICATORS.find(
        (i) => i.id.toLowerCase() === clean || i.code.toLowerCase() === clean
      ) || null
    );
  },

  // Templates
  getTemplates: (): TemplateConfig[] => {
    return dynamicTemplates;
  },

  getTemplateByDept: (deptId: string): TemplateConfig | null => {
    return dynamicTemplates.find((t) => t.department_id === deptId) || null;
  },

  saveTemplate: (template: TemplateConfig): void => {
    const idx = dynamicTemplates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      dynamicTemplates[idx] = { ...template, updated_at: new Date().toISOString() };
    } else {
      dynamicTemplates.push({ ...template, updated_at: new Date().toISOString() });
    }
  },
};
