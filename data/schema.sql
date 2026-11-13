-- =======================================================================
-- EXECUTIVE DASHBOARD - MONITORING KINERJA PELABUHAN (PortDash Regional 4)
-- Skema Database PostgreSQL Resmi & Terdokumentasi
-- Versi: 2.0.0 (16 Tabel Lengkap: Core + Katalog Alat + 6 Modul Operasional)
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
    order_seq INTEGER DEFAULT 99,
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
    nipp VARCHAR(64),
    password_hash VARCHAR(255),
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL,
    divisi VARCHAR(255),
    departemen VARCHAR(255),
    role VARCHAR(32) NOT NULL CHECK (role IN ('super_admin', 'admin_regional', 'pic_dept_regional', 'pic_cabang', 'viewer')),
    branch_id VARCHAR(64),
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_nipp ON users (nipp);

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
    default_target NUMERIC(18, 2) DEFAULT 0,
    is_core_kpi BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_indicators_dept ON kpi_indicators (department_id);

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
    uploaded_by VARCHAR(128) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_log JSONB
);

CREATE INDEX IF NOT EXISTS idx_import_batches_period ON import_batches (period_year, period_month);

-- 7. Data Kinerja Bulanan (Monthly Records)
CREATE TABLE IF NOT EXISTS monthly_records (
    id VARCHAR(128) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    department_id VARCHAR(64) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    indicator_id VARCHAR(64) NOT NULL REFERENCES kpi_indicators(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    target NUMERIC(18, 2) NOT NULL,
    realization NUMERIC(18, 2) NOT NULL,
    unit VARCHAR(64) NOT NULL,
    achievement_pct NUMERIC(12, 2) NOT NULL,
    status_color VARCHAR(16) NOT NULL CHECK (status_color IN ('green', 'yellow', 'red', 'neutral')),
    notes TEXT,
    source_type VARCHAR(32) NOT NULL,
    batch_id VARCHAR(64),
    verification_status VARCHAR(32) DEFAULT 'pending_verification' CHECK (verification_status IN ('draft', 'pending_verification', 'revision_needed', 'verified')),
    revision_notes TEXT,
    uploaded_by VARCHAR(128) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    is_simulated BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_records_period ON monthly_records (year, month);
CREATE INDEX IF NOT EXISTS idx_records_branch ON monthly_records (branch_id);
CREATE INDEX IF NOT EXISTS idx_records_dept ON monthly_records (department_id);
CREATE INDEX IF NOT EXISTS idx_records_status ON monthly_records (verification_status);
CREATE INDEX IF NOT EXISTS idx_records_branch_period ON monthly_records (branch_id, year, month);
CREATE INDEX IF NOT EXISTS idx_records_indicator ON monthly_records (indicator_id);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);

-- 9. Integrasi Eksternal & Konfigurasi Sistem
CREATE TABLE IF NOT EXISTS integration_settings (
    id VARCHAR(64) PRIMARY KEY,
    service_name VARCHAR(64) UNIQUE NOT NULL,
    config_json JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =======================================================================
-- TABEL KATALOG & 6 MODUL OPERASIONAL / FINANSIAL REGIONAL 4
-- =======================================================================

-- 10. Katalog Standar Peralatan Pelabuhan
CREATE TABLE IF NOT EXISTS equipment_catalog (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    acronym VARCHAR(32) NOT NULL,
    category VARCHAR(128) NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

-- 11. Modul Finansial (Laba Rugi Normalisasi 9 Field: Pendapatan, Beban, Laba Usaha, Laba Bersih per Entitas & Eliminasi)
CREATE TABLE IF NOT EXISTS module_finansial (
    id VARCHAR(160) PRIMARY KEY,
    monthly_record_id VARCHAR(160),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    rekening VARCHAR(128) NOT NULL,
    entitas VARCHAR(64) NOT NULL,
    realisasi DOUBLE PRECISION DEFAULT 0,
    rka DOUBLE PRECISION,
    yoy DOUBLE PRECISION,
    source_type VARCHAR(32) DEFAULT 'labarugi_xlsx',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_fin_branch_period ON module_finansial (branch_code, year, month);
CREATE INDEX IF NOT EXISTS idx_mod_fin_entitas ON module_finansial (year, month, branch_code, entitas, rekening);
CREATE INDEX IF NOT EXISTS idx_mod_fin_status ON module_finansial (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_fin_rec_id ON module_finansial (monthly_record_id);

-- 12. Modul Operasional Komersial (OPKOM)
CREATE TABLE IF NOT EXISTS module_opkom (
    id VARCHAR(128) PRIMARY KEY,
    monthly_record_id VARCHAR(128),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    layanan VARCHAR(128) NOT NULL,
    satuan VARCHAR(64) NOT NULL,
    jumlah_rp DOUBLE PRECISION DEFAULT 0,
    yoy DOUBLE PRECISION DEFAULT 0,
    rka DOUBLE PRECISION DEFAULT 0,
    source_type VARCHAR(32) DEFAULT 'google_sheets',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_opkom_branch_period ON module_opkom (branch_code, year, month);
CREATE INDEX IF NOT EXISTS idx_mod_opkom_status ON module_opkom (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_opkom_rec_id ON module_opkom (monthly_record_id);

-- 13. Modul Kinerja Operasional
CREATE TABLE IF NOT EXISTS module_kinerja (
    id VARCHAR(128) PRIMARY KEY,
    monthly_record_id VARCHAR(128),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    kd_kine VARCHAR(64) NOT NULL,
    nm_kine VARCHAR(255) NOT NULL,
    satuan VARCHAR(64) NOT NULL,
    nilai DOUBLE PRECISION DEFAULT 0,
    source_type VARCHAR(32) DEFAULT 'google_sheets',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_kinerja_branch_period ON module_kinerja (branch_code, year, month);
CREATE INDEX IF NOT EXISTS idx_mod_kinerja_status ON module_kinerja (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_kinerja_rec_id ON module_kinerja (monthly_record_id);

-- 14. Modul Utilisasi Dermaga / Gudang / Lapangan (BOR / YOR / SOR)
CREATE TABLE IF NOT EXISTS module_utilisasi (
    id VARCHAR(128) PRIMARY KEY,
    monthly_record_id VARCHAR(128),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    kd_jenderm VARCHAR(32),
    dermaga VARCHAR(255) NOT NULL,
    bor DOUBLE PRECISION DEFAULT 0,
    yor DOUBLE PRECISION DEFAULT 0,
    sor DOUBLE PRECISION DEFAULT 0,
    source_type VARCHAR(32) DEFAULT 'google_sheets',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_util_branch_period ON module_utilisasi (branch_code, year, month);
CREATE INDEX IF NOT EXISTS idx_mod_util_status ON module_utilisasi (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_util_rec_id ON module_utilisasi (monthly_record_id);

-- 15. Modul Kesiapan & Monitoring Peralatan Regional 4
CREATE TABLE IF NOT EXISTS module_peralatan (
    id VARCHAR(128) PRIMARY KEY,
    monthly_record_id VARCHAR(128),
    branch_code VARCHAR(32) NOT NULL,
    tanggal DATE NOT NULL,
    grup_entitas VARCHAR(32) NOT NULL,
    nama_cabang VARCHAR(255) NOT NULL,
    nama_alat VARCHAR(255) NOT NULL,
    jenis_alat VARCHAR(128) NOT NULL,
    kategori_alat VARCHAR(64) NOT NULL,
    kondisi VARCHAR(64) NOT NULL,
    kerusakan TEXT,
    tindak_lanjut TEXT,
    source_type VARCHAR(32) DEFAULT 'excel_import',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_alat_tanggal ON module_peralatan (tanggal);
CREATE INDEX IF NOT EXISTS idx_mod_alat_entitas ON module_peralatan (grup_entitas);
CREATE INDEX IF NOT EXISTS idx_mod_alat_cabang ON module_peralatan (nama_cabang);
CREATE INDEX IF NOT EXISTS idx_mod_alat_kondisi ON module_peralatan (kondisi);
CREATE INDEX IF NOT EXISTS idx_mod_alat_branch_code ON module_peralatan (branch_code);
CREATE INDEX IF NOT EXISTS idx_mod_alat_status ON module_peralatan (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_alat_rec_id ON module_peralatan (monthly_record_id);

-- 16. Modul Fasilitas Pelabuhan
CREATE TABLE IF NOT EXISTS module_fasilitas (
    id VARCHAR(128) PRIMARY KEY,
    monthly_record_id VARCHAR(128),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    branch_code VARCHAR(32) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    nama_fasilitas VARCHAR(255) NOT NULL,
    jenis_fasilitas VARCHAR(128) NOT NULL,
    satuan VARCHAR(64),
    panjang_m DOUBLE PRECISION DEFAULT 0,
    lebar_m DOUBLE PRECISION DEFAULT 0,
    mlws DOUBLE PRECISION DEFAULT 0,
    luas_sqm DOUBLE PRECISION DEFAULT 0,
    kapasitas TEXT,
    keterangan TEXT,
    source_type VARCHAR(32) DEFAULT 'google_sheets',
    verification_status VARCHAR(32) DEFAULT 'verified',
    uploaded_by VARCHAR(128),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    revision_notes TEXT,
    verified_snapshot_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_mod_fas_branch_period ON module_fasilitas (branch_code, year, month);
CREATE INDEX IF NOT EXISTS idx_mod_fas_status ON module_fasilitas (verification_status);
CREATE INDEX IF NOT EXISTS idx_mod_fas_rec_id ON module_fasilitas (monthly_record_id);

-- 17. Sesi Autentikasi Server-Side
CREATE TABLE IF NOT EXISTS auth_sessions (
    jti VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    token_type VARCHAR(32) NOT NULL,
    token_version INTEGER DEFAULT 0,
    issued_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT,
    revoked_reason VARCHAR(64),
    ip_address VARCHAR(64),
    user_agent TEXT,
    last_seen_at BIGINT
);

-- 18. Rate Limiting Brute Force Protection
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    rate_key VARCHAR(128) PRIMARY KEY,
    attempt_count INTEGER DEFAULT 0,
    first_failed_at BIGINT NOT NULL,
    locked_until BIGINT DEFAULT 0,
    updated_at BIGINT NOT NULL
);

-- 19. View Konsolidasi Finansial Entitas
CREATE OR REPLACE VIEW v_module_finansial_entitas AS SELECT * FROM module_finansial;

-- 20. Manajemen Isu Strategis & Program Prioritas Regional 4
CREATE TABLE IF NOT EXISTS isu_strategis (
    id VARCHAR(64) PRIMARY KEY,
    kode VARCHAR(64) UNIQUE NOT NULL,
    cabang_code VARCHAR(32) NOT NULL DEFAULT 'R99',
    cabang_name VARCHAR(128) NOT NULL,
    kategori VARCHAR(64) NOT NULL,
    prioritas VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Open',
    judul VARCHAR(255) NOT NULL,
    akar_masalah TEXT NOT NULL,
    tindak_lanjut TEXT NOT NULL,
    pic VARCHAR(128) NOT NULL,
    target_selesai VARCHAR(64) NOT NULL,
    progres INTEGER NOT NULL DEFAULT 0 CHECK (progres >= 0 AND progres <= 100),
    dampak TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64),
    updated_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_isu_strategis_cabang ON isu_strategis(cabang_code);
CREATE INDEX IF NOT EXISTS idx_isu_strategis_prioritas ON isu_strategis(prioritas);
CREATE INDEX IF NOT EXISTS idx_isu_strategis_status ON isu_strategis(status);
CREATE INDEX IF NOT EXISTS idx_isu_strategis_kategori ON isu_strategis(kategori);

