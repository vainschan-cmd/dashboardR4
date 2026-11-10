import { z } from 'zod';

export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_JSON_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 2000; // Maksimum 2.000 baris per batch impor
export const ALLOWED_SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

export const GOOGLE_SPREADSHEET_ID_REGEX = /^[a-zA-Z0-9-_]{10,120}$/;
export const GOOGLE_SHEET_NAME_REGEX = /^[^[\]*?:/\\]{1,100}$/;
export const GOOGLE_SHEET_RANGE_REGEX = /^[A-Z]{1,3}[1-9][0-9]{0,6}(:[A-Z]{1,3}[1-9][0-9]{0,6})?$/i;

export const loginSchema = z.object({
  nipp: z.string().trim().min(1, 'Silakan masukkan NIPP Anda.').max(64),
  password: z.string().min(1, 'Silakan masukkan kata sandi Anda.').max(256),
});

export const userRoleEnum = z.enum([
  'super_admin',
  'admin_regional',
  'pic_dept_regional',
  'pic_cabang',
  'viewer',
]);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(128),
  nipp: z.string().trim().min(1, 'NIPP wajib diisi.').max(64),
  divisi: z.string().trim().min(1, 'Divisi wajib diisi.').max(128),
  departemen: z.string().trim().min(1, 'Departemen wajib diisi.').max(128),
  password: z.string().trim().min(8, 'Kata sandi wajib diisi minimal 8 karakter.').max(256),
  role: userRoleEnum.optional(),
  branch_id: z.string().trim().max(64).nullable().optional(),
  department_id: z.string().trim().max(64).nullable().optional(),
  email: z.string().trim().max(128).optional(),
});

export const updateUserSchema = z.object({
  id: z.string().trim().min(1, 'ID pengguna wajib disertakan.').max(128),
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(128),
  nipp: z.string().trim().max(64).optional(),
  divisi: z.string().trim().min(1, 'Divisi wajib diisi.').max(128),
  departemen: z.string().trim().min(1, 'Departemen wajib diisi.').max(128),
  password: z.string().trim().min(8, 'Kata sandi baru minimal 8 karakter.').max(256).optional().or(z.literal('')),
  role: userRoleEnum.optional(),
  branch_id: z.string().trim().max(64).nullable().optional(),
  department_id: z.string().trim().max(64).nullable().optional(),
  email: z.string().trim().max(128).optional(),
  active: z.boolean().optional(),
});

export const manualInputSchema = z.object({
  module: z.enum(['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas']),
  data: z.record(z.string(), z.unknown()),
});

export const verificationSchema = z.object({
  recordIds: z.array(z.string().trim().min(1).max(128)).min(1, 'Daftar ID rekaman tidak boleh kosong.').max(MAX_IMPORT_ROWS),
  status: z.enum(['verified', 'revision_needed']),
  revisionNotes: z.string().max(1000).optional(),
});

export const importCommitRecordSchema = z.object({
  id: z.string().trim().min(1).max(128).optional(),
  branch_id: z.string().trim().min(1, 'branch_id wajib diisi pada setiap baris impor.').max(64),
  department_id: z.string().trim().min(1, 'department_id wajib diisi pada setiap baris impor.').max(64),
  indicator_id: z.string().trim().min(1, 'indicator_id wajib diisi pada setiap baris impor.').max(64),
  month: z.coerce.number().int().min(1, 'Bulan harus antara 1–12.').max(12, 'Bulan harus antara 1–12.'),
  year: z.coerce.number().int().min(2000, 'Tahun harus antara 2000–2100.').max(2100, 'Tahun harus antara 2000–2100.'),
  target: z.coerce.number().finite('Nilai target harus berupa angka valid.'),
  realization: z.coerce.number().finite('Nilai realisasi harus berupa angka valid.'),
  unit: z.string().trim().max(64).optional().default(''),
  achievement_pct: z.coerce.number().finite().optional().default(0),
  status_color: z.enum(['green', 'yellow', 'red']).optional().default('green'),
  notes: z.string().max(1000).optional().default(''),
  source_type: z.enum(['upload_xlsx', 'upload_csv', 'google_sheets', 'manual_input']).optional(),
  batch_id: z.string().max(128).nullable().optional(),
  is_simulated: z.boolean().optional().default(false),
});

export type ValidatedImportCommitRecord = z.infer<typeof importCommitRecordSchema>;

export const importCommitSchema = z.object({
  batchId: z.string().trim().max(128).optional(),
  filename: z.string().trim().max(255).optional(),
  sourceType: z.enum(['upload_xlsx', 'upload_csv', 'google_sheets', 'manual_input']).optional(),
  records: z
    .array(importCommitRecordSchema)
    .min(1, 'Tidak ada data valid untuk disimpan.')
    .max(MAX_IMPORT_ROWS, `Jumlah baris melebihi batas maksimum ${MAX_IMPORT_ROWS} baris per impor.`),
});

export const importValidateJsonSchema = z.object({
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'Data baris spreadsheet kosong.')
    .max(MAX_IMPORT_ROWS, `Jumlah baris melebihi batas maksimum ${MAX_IMPORT_ROWS} baris per impor.`),
  filename: z.string().trim().max(255).optional(),
  source_type: z.enum(['upload_xlsx', 'upload_csv']).optional(),
  department_id: z.string().trim().max(64).optional(),
  uploader: z.string().trim().max(128).optional(),
});

export const sheetsSyncSchema = z.object({
  action: z.enum(['test_connection', 'save_config', 'sync_now']).optional().default('sync_now'),
  spreadsheetUrl: z.string().trim().min(1).max(512).optional(),
  spreadsheetId: z
    .string()
    .trim()
    .regex(GOOGLE_SPREADSHEET_ID_REGEX, 'Format Spreadsheet ID Google Sheets tidak valid.')
    .optional(),
  sheetName: z
    .string()
    .trim()
    .regex(GOOGLE_SHEET_NAME_REGEX, 'Format nama sheet tidak valid.')
    .optional(),
  range: z
    .string()
    .trim()
    .regex(GOOGLE_SHEET_RANGE_REGEX, 'Format range A1 Google Sheets tidak valid (contoh: A2:L200).')
    .optional(),
  autoSync: z.boolean().optional(),
});

export const driveSyncSchema = z.object({
  mode: z.enum(['validate', 'commit']).optional().default('validate'),
  customPath: z.string().trim().max(255).optional(),
});

export const templateColumnSchema = z.object({
  column_name: z.string().trim().min(1).max(128),
  field_key: z.string().trim().min(1).max(64),
  data_type: z.enum(['string', 'number', 'date']),
  required: z.boolean(),
  unit: z.string().max(64).optional(),
  description: z.string().max(500).optional(),
  sample_value: z.union([z.string().max(256), z.number()]).optional(),
});

export const templateSaveSchema = z.object({
  id: z.string().trim().min(1, 'ID template wajib diisi.').max(128),
  department_id: z.string().trim().min(1, 'department_id wajib diisi.').max(64),
  version: z.string().trim().max(32).optional().default('v1.0'),
  name: z.string().trim().min(1, 'Nama template wajib diisi.').max(128),
  description: z.string().trim().max(500).optional().default(''),
  columns: z.array(templateColumnSchema).min(1, 'Daftar kolom template tidak boleh kosong.'),
});

export const recordsQuerySchema = z.object({
  branch_id: z.string().trim().max(256).optional(),
  department_id: z.string().trim().max(64).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  verified_only: z.enum(['true', 'false']).optional(),
  verification_status: z.string().trim().max(64).optional(),
});

export const modulesDataQuerySchema = z.object({
  period: z.string().trim().max(32).optional(),
  branch: z.string().trim().max(256).optional(),
  verifiedOnly: z.enum(['true', 'false']).optional(),
});

export const reportsExportQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'executive_summary']).optional().default('csv'),
  branch_id: z.string().trim().max(256).optional(),
  department_id: z.string().trim().max(64).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  verified_only: z.enum(['true', 'false']).optional(),
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export const systemParamsPayloadSchema = z.object({
  action: z.string().optional(),
  sqlite_path: z.string().optional(),
  session_timeout_minutes: z.number().int().min(1).max(1440).optional(),
  auto_logout_idle: z.boolean().optional(),
  warning_before_minutes: z.number().int().min(1).max(60).optional(),
  default_theme: z.enum(['light', 'dark']).optional(),
  params: z
    .object({
      session_timeout_minutes: z.number().int().min(1).max(1440).optional(),
      auto_logout_idle: z.boolean().optional(),
      warning_before_minutes: z.number().int().min(1).max(60).optional(),
      default_theme: z.enum(['light', 'dark']).optional(),
    })
    .optional(),
  dbConfig: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  payload: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstIssue = result.error.issues[0];
  const fieldPath = firstIssue?.path?.length ? `${firstIssue.path.join('.')}: ` : '';
  return {
    success: false,
    error: `${fieldPath}${firstIssue?.message || 'Format data permintaan tidak valid.'}`,
  };
}
