import { z } from 'zod';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_DISTINCT_CHARACTERS,
} from './passwordPolicy';

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

/**
 * Password policy shared by account creation, self-service change, and admin reset.
 * Length is the dominant factor for strength; complexity rules are intentionally
 * limited to what users can realistically follow.
 */
export const strongPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`)
  .max(MAX_PASSWORD_LENGTH, `Kata sandi maksimal ${MAX_PASSWORD_LENGTH} karakter.`)
  .refine((value) => !/^\s|\s$/.test(value), 'Kata sandi tidak boleh diawali/diakhiri spasi.')
  .refine(
    (value) => new Set(value).size >= MIN_DISTINCT_CHARACTERS,
    'Kata sandi terlalu mudah ditebak. Gunakan kombinasi karakter yang lebih beragam.'
  );

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(256),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.').max(256),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi kata sandi tidak cocok.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
  });

export const adminResetPasswordSchema = z.object({
  userId: z.string().trim().min(1, 'ID pengguna wajib diisi.').max(128),
  newPassword: strongPasswordSchema,
  /** When true the user must pick a new password after the reset. */
  requireChangeOnNextLogin: z.boolean().optional().default(true),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(128),
  nipp: z.string().trim().min(1, 'NIPP wajib diisi.').max(64),
  divisi: z.string().trim().min(1, 'Divisi wajib diisi.').max(128),
  departemen: z.string().trim().min(1, 'Departemen wajib diisi.').max(128),
  password: strongPasswordSchema,
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
  // No `password` field on purpose: password resets go through
  // POST /api/users/password so they always bump token_version, revoke
  // sessions, and set the must-change flag consistently.
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

/**
 * `DATA-05` — restoring a row to its last verified snapshot.
 *
 * The table name comes from the client, so it is an explicit enum rather than a
 * free string: interpolating an arbitrary table name into SQL is not something to
 * leave to validation-by-hope.
 */
export const restoreSnapshotSchema = z.object({
  table: z.enum([
    'module_finansial',
    'module_opkom',
    'module_kinerja',
    'module_utilisasi',
    'module_peralatan',
    'module_fasilitas',
  ]),
  id: z.string().trim().min(1, 'ID baris wajib diisi.').max(128),
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

/**
 * Body for `POST /api/users/sync-drive`.
 *
 * `action` used to be read as a loose string and compared against half a dozen
 * Indonesian/English synonyms inside the handler. Declaring the accepted values
 * here means an unrecognised action is rejected (or ignored) in one predictable
 * place instead of falling through to "push" by accident.
 */
export const userSyncDriveSchema = z
  .object({
    action: z
      .enum(['push', 'export', 'simpan', 'pull', 'import', 'ambil'])
      .optional(),
    direction: z
      .enum(['push', 'export', 'simpan', 'pull', 'import', 'ambil'])
      .optional(),
  })
  .transform((value) => ({
    action: (value.action || value.direction || 'push').toLowerCase(),
  }));

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
  // Pagination is mandatory for large tables: unbounded responses were ~650 KB.
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
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
