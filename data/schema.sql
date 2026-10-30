-- =======================================================================
-- EXECUTIVE DASHBOARD - MONITORING KINERJA PELABUHAN
-- Skema Database PostgreSQL Resmi & Terdokumentasi
-- Versi: 1.0.0
-- =======================================================================

-- 1. Master Cabang Pelabuhan
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(128) NOT NULL,
    address TEXT,
    phone VARCHAR(64),
    email VARCHAR(128),
    active BOOLEAN DEFAULT TRUE,
    facilities JSONB DEFAULT '{}',
    overview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Departemen
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    pic_name VARCHAR(128) NOT NULL,
    pic_email VARCHAR(128) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Master Pengguna & RBAC
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang', 'viewer')),
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Master Indikator & KPI
CREATE TABLE IF NOT EXISTS kpi_indicators (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    category VARCHAR(128) NOT NULL,
    unit VARCHAR(64) NOT NULL,
    direction VARCHAR(32) DEFAULT 'higher_is_better' CHECK (direction IN ('higher_is_better', 'lower_is_better')),
    formula_desc TEXT,
    default_target NUMERIC(15, 2) DEFAULT 0,
    is_core_kpi BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Template & Mapping Konfigurasi Fleksibel
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(64) PRIMARY KEY,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    version VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    columns JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Batch Histori Impor (File Excel/CSV & Google Sheets)
CREATE TABLE IF NOT EXISTS import_batches (
    id VARCHAR(64) PRIMARY KEY,
    filename_or_url TEXT NOT NULL,
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('upload_xlsx', 'upload_csv', 'google_sheets')),
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    total_rows INTEGER NOT NULL,
    valid_rows INTEGER NOT NULL,
    error_rows INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    uploaded_by VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_log JSONB
);

-- 7. Data Kinerja Bulanan (Monthly Records)
CREATE TABLE IF NOT EXISTS monthly_records (
    id VARCHAR(128) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    indicator_id VARCHAR(64) NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    target NUMERIC(15, 2) NOT NULL,
    realization NUMERIC(15, 2) NOT NULL,
    unit VARCHAR(64) NOT NULL,
    achievement_pct NUMERIC(8, 2) NOT NULL,
    status_color VARCHAR(16) NOT NULL CHECK (status_color IN ('green', 'yellow', 'red', 'neutral')),
    notes TEXT,
    source_type VARCHAR(32) NOT NULL,
    batch_id VARCHAR(64) REFERENCES import_batches(id) ON DELETE SET NULL,
    verification_status VARCHAR(32) DEFAULT 'pending_verification' CHECK (verification_status IN ('draft', 'pending_verification', 'revision_needed', 'verified')),
    revision_notes TEXT,
    uploaded_by VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_by VARCHAR(64),
    verified_at TIMESTAMP WITH TIME ZONE,
    is_simulated BOOLEAN DEFAULT TRUE
);

-- Indexes for Fast Analytics & Filtering
CREATE INDEX IF NOT EXISTS idx_records_period ON monthly_records (year, month);
CREATE INDEX IF NOT EXISTS idx_records_branch ON monthly_records (branch_id);
CREATE INDEX IF NOT EXISTS idx_records_dept ON monthly_records (department_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON monthly_records (verification_status);

-- 8. Audit Trail Lengkap
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(128) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128),
    details TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- 9. Integrasi Eksternal (Google Sheets API Settings)
CREATE TABLE IF NOT EXISTS integration_settings (
    id VARCHAR(64) PRIMARY KEY,
    service_name VARCHAR(64) UNIQUE NOT NULL,
    config_json JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
