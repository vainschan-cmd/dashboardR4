import type { Branch, Department, EquipmentItem, KPIIndicator, TemplateConfig } from '../types';
import { OFFICIAL_BRANCHES } from '../constants';

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

const STATIC_EQUIPMENT: EquipmentItem[] = [
  { id: 'eq_qcc', code: 'QCC', name: 'Quay Container Crane', acronym: 'QCC', category: 'Alat Dermaga', active: true },
  { id: 'eq_rtg', code: 'RTG', name: 'Rubber Tyred Gantry', acronym: 'RTG', category: 'Alat CY', active: true },
  { id: 'eq_rs', code: 'RS', name: 'Reach Stacker', acronym: 'RS', category: 'Alat CY', active: true },
  { id: 'eq_tt', code: 'TT', name: 'Terminal Tractor', acronym: 'TT', category: 'Alat Angkut', active: true },
  { id: 'eq_fl', code: 'FL', name: 'Forklift', acronym: 'FL', category: 'Alat Bantu', active: true },
  { id: 'eq_mc', code: 'MC', name: 'Mobile Crane', acronym: 'MC', category: 'Alat Dermaga', active: true },
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

let dynamicTemplates: TemplateConfig[] = [
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

  // Equipment Catalog
  getEquipmentCatalog: (): EquipmentItem[] => {
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
