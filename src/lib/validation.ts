import { z } from 'zod';

export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

export const loginSchema = z.object({
  nipp: z.string().trim().min(1, 'NIPP wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export const userRoleEnum = z.enum([
  'super_admin',
  'admin_regional',
  'pic_dept_regional',
  'pic_cabang',
  'viewer',
]);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  nipp: z.string().trim().min(1, 'NIPP wajib diisi.'),
  divisi: z.string().trim().min(1, 'Divisi wajib diisi.'),
  departemen: z.string().trim().min(1, 'Departemen wajib diisi.'),
  password: z.string().optional(),
  role: userRoleEnum.optional(),
  branch_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  email: z.string().trim().optional(),
});

export const updateUserSchema = z.object({
  id: z.string().trim().min(1, 'ID pengguna wajib disertakan.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  nipp: z.string().trim().optional(),
  divisi: z.string().trim().min(1, 'Divisi wajib diisi.'),
  departemen: z.string().trim().min(1, 'Departemen wajib diisi.'),
  password: z.string().optional(),
  role: userRoleEnum.optional(),
  branch_id: z.string().nullable().optional(),
  department_id: z.string().nullable().optional(),
  email: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export const manualInputSchema = z.object({
  module: z.enum(['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas']),
  data: z.record(z.string(), z.unknown()),
});

export const verificationSchema = z.object({
  recordIds: z.array(z.string().trim().min(1)).min(1, 'Daftar ID rekaman tidak boleh kosong.'),
  status: z.enum(['verified', 'revision_needed']),
  revisionNotes: z.string().optional(),
});

export const importCommitSchema = z.object({
  batchId: z.string().optional(),
  filename: z.string().optional(),
  sourceType: z.enum(['upload_xlsx', 'upload_csv', 'google_sheets', 'manual_input']).optional(),
  records: z.array(z.record(z.string(), z.any())).min(1, 'Tidak ada data valid untuk disimpan.'),
});

export const importValidateJsonSchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).min(1, 'Data baris spreadsheet kosong.'),
  filename: z.string().optional(),
  source_type: z.enum(['upload_xlsx', 'upload_csv']).optional(),
  department_id: z.string().optional(),
  uploader: z.string().optional(),
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
  dbConfig: z.record(z.string(), z.any()).optional(),
  credentials: z.record(z.string(), z.any()).optional(),
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

