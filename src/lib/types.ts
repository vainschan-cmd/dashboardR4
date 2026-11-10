export type UserRole =
  | 'super_admin'
  | 'admin_regional'
  | 'pic_dept_regional'
  | 'pic_cabang'
  | 'viewer';

export type VerificationStatus =
  | 'draft'
  | 'pending_verification'
  | 'revision_needed'
  | 'verified';

export type KPIDirection = 'higher_is_better' | 'lower_is_better';

export type StatusColor = 'green' | 'yellow' | 'red' | 'neutral';

export interface Branch {
  id: string;
  code: string;
  name: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  active: boolean;
  facilities: {
    dermaga_length_m?: number;
    kolam_depth_mlws?: number;
    lapangan_sqm?: number;
    gudang_sqm?: number;
    crane_units?: number;
    forklift_units?: number;
    tugboat_units?: number;
    pilotboat_units?: number;
  };
  overview?: string;
  order_seq?: number;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  pic_name: string;
  pic_email: string;
  active: boolean;
  description?: string;
}

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  acronym: string;
  category: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string; // NIPP Pegawai
  nipp: string;
  name: string;
  email?: string;
  divisi: string;
  departemen: string;
  password?: string;
  role: UserRole;
  branch_id?: string | null;
  department_id?: string | null;
  active: boolean;
  created_at?: string;
}

export interface KPIIndicator {
  id: string;
  code: string;
  name: string;
  department_id: string;
  category: string;
  unit: string;
  direction: KPIDirection;
  formula_desc?: string;
  default_target: number;
  is_core_kpi: boolean;
  active: boolean;
}

export interface TemplateColumnDef {
  column_name: string;
  field_key: string;
  data_type: 'string' | 'number' | 'date';
  required: boolean;
  unit?: string;
  description?: string;
  sample_value?: string | number;
}

export interface TemplateConfig {
  id: string;
  department_id: string;
  version: string;
  name: string;
  description: string;
  columns: TemplateColumnDef[];
  updated_at: string;
}

export interface MonthlyRecord {
  id: string;
  branch_id: string;
  department_id: string;
  indicator_id: string;
  month: number; // 1 - 12
  year: number;
  target: number;
  realization: number;
  unit: string;
  achievement_pct: number;
  status_color: StatusColor;
  notes?: string;
  source_type: 'upload_xlsx' | 'upload_csv' | 'google_sheets' | 'manual';
  batch_id?: string | null;
  verification_status: VerificationStatus;
  revision_notes?: string | null;
  uploaded_by: string;
  uploaded_at: string;
  verified_by?: string | null;
  verified_at?: string | null;
  is_simulated: boolean;
  // joined fields
  branch_name?: string;
  branch_code?: string;
  department_name?: string;
  indicator_name?: string;
  indicator_code?: string;
  direction?: KPIDirection;
}

export interface ImportBatch {
  id: string;
  filename_or_url: string;
  source_type: 'upload_xlsx' | 'upload_csv' | 'google_sheets';
  department_id?: string | null;
  branch_id?: string | null;
  period_month: number;
  period_year: number;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  status: 'pending' | 'completed' | 'failed' | 'partial';
  uploaded_by: string;
  uploaded_at: string;
  error_log?: Array<{ row: number; col?: string; message: string }> | null;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: 'LOGIN' | 'UPLOAD' | 'VALIDATE' | 'IMPORT' | 'APPROVE' | 'REVISE' | 'CONFIG_UPDATE' | 'EXPORT' | 'UPDATE_MANUAL_DATA' | 'CREATE_MANUAL_DATA';
  entity: string;
  entity_id?: string | null;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface GoogleSheetsConfig {
  id: string;
  spreadsheet_id: string;
  sheet_name: string;
  range: string;
  service_account_email: string;
  api_key_configured: boolean;
  status: 'not_configured' | 'configured' | 'ready_for_credentials';
  last_sync_at?: string | null;
  auto_sync_enabled: boolean;
}

export interface CompletenessItem {
  branch_id: string;
  branch_name: string;
  department_id: string;
  department_name: string;
  month: number;
  year: number;
  status: 'belum_upload' | VerificationStatus;
  last_updated?: string | null;
  pic_name: string;
  pic_email: string;
  is_delayed: boolean;
  records_count: number;
}

export interface SystemParameters {
  session_timeout_minutes: number;
  auto_logout_idle: boolean;
  warning_before_minutes: number;
  default_theme: 'light' | 'dark';
  updated_at?: string;
  updated_by?: string;
}

export interface DatabaseConfig {
  engine: 'sqlite' | 'postgres';
  sqlite_path: string;
  pg_host?: string;
  pg_port?: number;
  pg_database?: string;
  pg_user?: string;
  pg_password?: string;
  pg_ssl?: boolean;
  max_connections?: number;
  updated_at?: string;
  updated_by?: string;
}

export interface IntegrationCredentials {
  google_drive_email: string;
  google_drive_file_path: string;
  google_sheets_id: string;
  google_sheets_name: string;
  google_api_key?: string;
  api_gateway_url?: string;
  api_gateway_token?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface ValidationErrorItem {
  row: number;
  column?: string;
  field?: string;
  value?: unknown;
  message: string;
}

export interface ValidationSummary {
  isValid: boolean;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  errors: ValidationErrorItem[];
  parsedRecords: MonthlyRecord[];
}

export interface FinansialRecord {
  id?: string;
  year?: number;
  month?: number;
  branchCode?: string;
  branchName?: string;
  rekening?: string;
  cabangRp?: number;
  pmtRp?: number;
  ptpRp?: number;
  pslRp?: number;
  pjmRp?: number;
  eliminasiRp?: number;
  konsolidasiRp?: number;
  rka?: number;
  yoy?: number;
  verificationStatus?: VerificationStatus;
  hasPendingUpdate?: boolean;
  [key: string]: unknown;
}

export interface OpkomRecord {
  id?: string;
  year?: number;
  month?: number;
  branchCode?: string;
  branchName?: string;
  layanan?: string;
  satuan?: string;
  jumlahRp?: number;
  rka?: number;
  yoy?: number;
  verificationStatus?: VerificationStatus;
  hasPendingUpdate?: boolean;
  [key: string]: unknown;
}

export interface PeralatanRecord {
  id?: string;
  branchCode?: string;
  branchName?: string;
  kdAlat?: string;
  nmAlat?: string;
  singkatanAlat?: string;
  jnsAlat?: string;
  jumlah?: number;
  utilisasi?: number;
  availability?: number;
  statusKesiapan?: string;
  verificationStatus?: VerificationStatus;
  hasPendingUpdate?: boolean;
  [key: string]: unknown;
}

export interface KinerjaRecord {
  id?: string;
  branchCode?: string;
  branchName?: string;
  kdKine?: string;
  nmKine?: string;
  satuan?: string;
  nilai?: number;
  [key: string]: unknown;
}

export interface UtilisasiRecord {
  id?: string;
  branchCode?: string;
  branchName?: string;
  dermaga?: string;
  bor?: number;
  yor?: number;
  sor?: number;
  [key: string]: unknown;
}

export interface FasilitasRecord {
  id?: string;
  branchCode?: string;
  branchName?: string;
  nmPasfel?: string;
  jnsFaspel?: string;
  satuan?: string;
  panjang?: number;
  lebar?: number;
  mLws?: number;
  nilai?: number;
  ket?: string;
  [key: string]: unknown;
}
