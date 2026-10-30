import { getDb } from './db';
import { Branch, Department, User, KPIIndicator, TemplateConfig, KPIDirection, StatusColor } from './types';

export function runSeed(force = false) {
  const db = getDb();

  console.log('Seeding official Pelindo Regional 4 (R4 PortSight) Master & Simulation Data...');

  // Clear existing if force
  db.exec(`
    DELETE FROM monthly_records;
    DELETE FROM kpi_indicators;
    DELETE FROM templates;
    DELETE FROM users;
    DELETE FROM departments;
    DELETE FROM branches;
    DELETE FROM import_batches;
    DELETE FROM audit_logs;
    DELETE FROM integration_settings;
  `);

  // 1. Branches (8 Terminals of Pelindo Regional 4)
  const branches: Branch[] = [
    {
      id: 'term_new_makassar',
      code: 'TRM-NMK',
      name: 'New Makassar',
      region: 'Regional 4 (Sulawesi Selatan)',
      address: 'Makassar New Port (MNP), Kaluku Bodoa, Tallo, Makassar',
      phone: '(0411) 362400',
      email: 'mnp@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 1600,
        kolam_depth_mlws: -16.0,
        lapangan_sqm: 480000,
        gudang_sqm: 45000,
        crane_units: 10,
        forklift_units: 25,
        tugboat_units: 6,
        pilotboat_units: 3,
      },
      overview: 'Hub utama petikemas Kawasan Timur Indonesia (KTI) modern berkapasitas 2,5 juta TEUs per tahun.',
    },
    {
      id: 'term_makassar',
      code: 'TRM-MKS',
      name: 'Makassar',
      region: 'Regional 4 (Sulawesi Selatan)',
      address: 'Jl. Soekarno No. 1, Makassar, Sulawesi Selatan',
      phone: '(0411) 316521',
      email: 'makassar@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 2100,
        kolam_depth_mlws: -12.0,
        lapangan_sqm: 320000,
        gudang_sqm: 35000,
        crane_units: 8,
        forklift_units: 20,
        tugboat_units: 4,
        pilotboat_units: 3,
      },
      overview: 'Terminal petikemas & konvensional eksisting pelabuhan Soekarno Hatta Makassar.',
    },
    {
      id: 'term_bitung',
      code: 'TRM-BTG',
      name: 'Bitung',
      region: 'Regional 4 (Sulawesi Utara)',
      address: 'Jl. Sam Ratulangi No. 1, Bitung, Sulawesi Utara',
      phone: '(0438) 21115',
      email: 'bitung@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 1350,
        kolam_depth_mlws: -14.0,
        lapangan_sqm: 260000,
        gudang_sqm: 25000,
        crane_units: 6,
        forklift_units: 16,
        tugboat_units: 4,
        pilotboat_units: 2,
      },
      overview: 'Pelabuhan Hub Internasional Indonesia Timur menghadap Samudra Pasifik.',
    },
    {
      id: 'term_ambon',
      code: 'TRM-AMB',
      name: 'Ambon',
      region: 'Regional 4 (Maluku)',
      address: 'Jl. Yos Sudarso, Ambon, Maluku',
      phone: '(0911) 352441',
      email: 'ambon@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 850,
        kolam_depth_mlws: -11.5,
        lapangan_sqm: 140000,
        gudang_sqm: 18000,
        crane_units: 4,
        forklift_units: 12,
        tugboat_units: 3,
        pilotboat_units: 2,
      },
      overview: 'Pintu gerbang logistik laut Kepulauan Maluku dan sentra ekspor perikanan nasional.',
    },
    {
      id: 'term_sorong',
      code: 'TRM-SRG',
      name: 'Sorong',
      region: 'Regional 4 (Papua Barat Daya)',
      address: 'Jl. Jenderal Sudirman No. 1, Sorong, Papua Barat Daya',
      phone: '(0951) 321882',
      email: 'sorong@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 750,
        kolam_depth_mlws: -12.0,
        lapangan_sqm: 120000,
        gudang_sqm: 15000,
        crane_units: 3,
        forklift_units: 10,
        tugboat_units: 3,
        pilotboat_units: 2,
      },
      overview: 'Hub maritim utama Tanah Papua dengan konektivitas feeder tol laut.',
    },
    {
      id: 'term_balikpapan',
      code: 'TRM-BPN',
      name: 'Balikpapan',
      region: 'Regional 4 (Kalimantan Timur & IKN)',
      address: 'Jl. Yos Sudarso No. 30, Balikpapan, Kalimantan Timur',
      phone: '(0542) 732040',
      email: 'balikpapan@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 1850,
        kolam_depth_mlws: -13.0,
        lapangan_sqm: 380000,
        gudang_sqm: 40000,
        crane_units: 6,
        forklift_units: 22,
        tugboat_units: 8,
        pilotboat_units: 4,
      },
      overview: 'Terminal Multipurpose strategis penyangga logistik konstruksi Ibu Kota Nusantara (IKN).',
    },
    {
      id: 'term_pantoloan',
      code: 'TRM-PTL',
      name: 'Pantoloan',
      region: 'Regional 4 (Sulawesi Tengah)',
      address: 'Jl. Pelabuhan Pantoloan, Palu, Sulawesi Tengah',
      phone: '(0451) 491200',
      email: 'pantoloan@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 650,
        kolam_depth_mlws: -12.0,
        lapangan_sqm: 110000,
        gudang_sqm: 12000,
        crane_units: 3,
        forklift_units: 8,
        tugboat_units: 2,
        pilotboat_units: 2,
      },
      overview: 'Terminal Multipurpose di Teluk Palu untuk distribusi logistik dan komoditas tambang.',
    },
    {
      id: 'term_ternate',
      code: 'TRM-TTE',
      name: 'Ternate',
      region: 'Regional 4 (Maluku Utara)',
      address: 'Jl. Ahmad Yani No. 1, Ternate, Maluku Utara',
      phone: '(0921) 3121544',
      email: 'ternate@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 550,
        kolam_depth_mlws: -11.0,
        lapangan_sqm: 85000,
        gudang_sqm: 10000,
        crane_units: 2,
        forklift_units: 8,
        tugboat_units: 2,
        pilotboat_units: 1,
      },
      overview: 'Terminal Multipurpose melayani Kepulauan Halmahera dan rempah-rempah Maluku Utara.',
    },
  ];

  const stmtBranch = db.prepare(`
    INSERT INTO branches (id, code, name, region, address, phone, email, active, facilities, overview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of branches) {
    stmtBranch.run(b.id, b.code, b.name, b.region, b.address, b.phone, b.email, b.active ? 1 : 0, JSON.stringify(b.facilities), b.overview || '');
  }

  // 2. Departments
  const departments: Department[] = [
    { id: 'dept_ops', code: 'OPS', name: 'Operasional', pic_name: 'Capt. Rudi Hartono', pic_email: 'rudi.ops@pelindo.co.id', active: true, description: 'Arus kapal, petikemas, barang, produktivitas BSH/BCH, dan BOR/YOR.' },
    { id: 'dept_sdm', code: 'SDM', name: 'SDM', pic_name: 'Dewi Kartika, M.M.', pic_email: 'dewi.sdm@pelindo.co.id', active: true, description: 'Organik, outsourcing, rasio OS:organik, demografi usia, dan pensiun.' },
    { id: 'dept_tek', code: 'TEK', name: 'Teknik', pic_name: 'Ir. Agus Santoso', pic_email: 'agus.teknik@pelindo.co.id', active: true, description: 'Kesiapan alat (RFU), status CC/RTG, MTTR, MTBF, breakdown, dan uptime TI.' },
    { id: 'dept_hsse', code: 'HSSE', name: 'HSSE', pic_name: 'Capt. Rian Pratama', pic_email: 'rian.hsse@pelindo.co.id', active: true, description: 'Hari tanpa LTI, piramida keselamatan, patroli YTD, dan peta temuan.' },
    { id: 'dept_keu', code: 'KEU', name: 'Keuangan', pic_name: 'Siti Rahma, SE, Ak.', pic_email: 'siti.keu@pelindo.co.id', active: true, description: 'Pendapatan usaha, beban usaha, EBITDA, laba usaha, dan realisasi RKAP.' },
    { id: 'dept_pel', code: 'PEL', name: 'Pelanggan', pic_name: 'Dian Permatasari', pic_email: 'dian.pel@pelindo.co.id', active: true, description: 'Kepatuhan SLA, CSAT 1-5, keluhan masuk, umur tiket, dan kategori keluhan.' },
  ];

  const stmtDept = db.prepare(`
    INSERT INTO departments (id, code, name, pic_name, pic_email, active, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of departments) {
    stmtDept.run(d.id, d.code, d.name, d.pic_name, d.pic_email, d.active ? 1 : 0, d.description || '');
  }

  // 3. Users (RBAC)
  const users: User[] = [
    { id: 'usr_super', username: 'superadmin', name: 'Budi Santoso', email: 'superadmin@pelindo.co.id', role: 'super_admin', active: true },
    { id: 'usr_adminreg', username: 'adminreg', name: 'Hendra Wijaya', email: 'admin.r4@pelindo.co.id', role: 'admin_regional', active: true },
    { id: 'usr_pic_ops', username: 'pic_ops', name: 'Capt. Rudi Hartono', email: 'rudi.ops@pelindo.co.id', role: 'pic_dept_regional', department_id: 'dept_ops', active: true },
    { id: 'usr_pic_nmk', username: 'pic_nmk', name: 'Ahmad Dahlan', email: 'ahmad.nmk@pelindo.co.id', role: 'pic_cabang', branch_id: 'term_new_makassar', active: true },
    { id: 'usr_viewer', username: 'bod_regional', name: 'Board of Directors Regional 4', email: 'bod.r4@pelindo.co.id', role: 'viewer', active: true },
  ];

  const stmtUser = db.prepare(`
    INSERT INTO users (id, username, name, email, role, branch_id, department_id, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const u of users) {
    stmtUser.run(u.id, u.username, u.name, u.email, u.role, u.branch_id || null, u.department_id || null, u.active ? 1 : 0);
  }

  // 4. KPI Indicators
  const indicators: KPIIndicator[] = [
    { id: 'kpi_teus', code: 'OPS-TEUS', name: 'Arus Petikemas', department_id: 'dept_ops', category: 'Kargo', unit: 'TEUs', direction: 'higher_is_better', default_target: 1026000, is_core_kpi: true, active: true },
    { id: 'kpi_cargo', code: 'OPS-CARGO', name: 'Arus Barang', department_id: 'dept_ops', category: 'Kargo', unit: 'Ton', direction: 'higher_is_better', default_target: 8300000, is_core_kpi: true, active: true },
    { id: 'kpi_call', code: 'OPS-CALL', name: 'Kunjungan Kapal', department_id: 'dept_ops', category: 'Trafik', unit: 'Call', direction: 'higher_is_better', default_target: 1800, is_core_kpi: true, active: true },
    { id: 'kpi_rev', code: 'KEU-REV', name: 'Pendapatan Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 2010.0, is_core_kpi: true, active: true },
    { id: 'kpi_profit', code: 'KEU-OP', name: 'Laba Usaha', department_id: 'dept_keu', category: 'Keuangan', unit: 'Miliar Rp', direction: 'higher_is_better', default_target: 585.0, is_core_kpi: true, active: true },
    { id: 'kpi_rfu', code: 'TEK-RFU', name: 'Kesiapan Alat', department_id: 'dept_tek', category: 'Keandalan', unit: '%', direction: 'higher_is_better', default_target: 92.0, is_core_kpi: true, active: true },
    { id: 'kpi_csat', code: 'PEL-CSAT', name: 'Indeks Kepuasan (CSAT)', department_id: 'dept_pel', category: 'Layanan', unit: 'Skor 1-5', direction: 'higher_is_better', default_target: 4.0, is_core_kpi: true, active: true },
    { id: 'kpi_sla', code: 'PEL-SLA', name: 'SLA Keluhan', department_id: 'dept_pel', category: 'Layanan', unit: '%', direction: 'higher_is_better', default_target: 90.0, is_core_kpi: true, active: true },
    { id: 'kpi_fatality', code: 'HSSE-FAT', name: 'Fatality', department_id: 'dept_hsse', category: 'K3', unit: 'Kasus', direction: 'lower_is_better', default_target: 0, is_core_kpi: true, active: true },
    { id: 'kpi_lti', code: 'HSSE-LTI', name: 'Lost Time Injury', department_id: 'dept_hsse', category: 'K3', unit: 'Kasus', direction: 'lower_is_better', default_target: 0, is_core_kpi: true, active: true },
  ];

  const stmtInd = db.prepare(`
    INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, formula_desc, default_target, is_core_kpi, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const k of indicators) {
    stmtInd.run(k.id, k.code, k.name, k.department_id, k.category, k.unit, k.direction, '', k.default_target, k.is_core_kpi ? 1 : 0, 1);
  }

  // 5. Default Templates
  const defaultColumns = [
    { column_name: 'Kode Terminal', field_key: 'branch_code', data_type: 'string', required: true, sample_value: 'TRM-NMK' },
    { column_name: 'Nama Terminal', field_key: 'branch_name', data_type: 'string', required: false, sample_value: 'New Makassar' },
    { column_name: 'Departemen', field_key: 'department_code', data_type: 'string', required: true, sample_value: 'OPS' },
    { column_name: 'Bulan', field_key: 'month', data_type: 'number', required: true, sample_value: 9 },
    { column_name: 'Tahun', field_key: 'year', data_type: 'number', required: true, sample_value: 2026 },
    { column_name: 'Kode Indikator', field_key: 'indicator_code', data_type: 'string', required: true, sample_value: 'OPS-TEUS' },
    { column_name: 'Target', field_key: 'target', data_type: 'number', required: true, sample_value: 400000 },
    { column_name: 'Realisasi', field_key: 'realization', data_type: 'number', required: true, sample_value: 412500 },
    { column_name: 'Satuan', field_key: 'unit', data_type: 'string', required: true, sample_value: 'TEUs' },
    { column_name: 'Keterangan', field_key: 'notes', data_type: 'string', required: false, sample_value: 'Pelaporan resmi R4 PortSight' },
  ];

  const stmtTpl = db.prepare(`
    INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of departments) {
    stmtTpl.run(
      `tpl_${d.code.toLowerCase()}`,
      d.id,
      'v2.0-PortSight',
      `Template Resmi Pelaporan ${d.name} Pelindo Regional 4`,
      `Format data spreadsheet bulanan resmi untuk 8 terminal Pelindo Regional 4`,
      JSON.stringify(defaultColumns),
      new Date().toISOString()
    );
  }

  // 6. Seed Monthly Records matching the presentation
  const stmtRec = db.prepare(`
    INSERT INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // Terminal baseline data
  const terminalData = [
    { branchId: 'term_new_makassar', teus: 412500, teusTarget: 400000, rkapPct: 103.1, yoy: 8.5, status: 'Baik' },
    { branchId: 'term_makassar', teus: 268400, teusTarget: 275000, rkapPct: 97.6, yoy: -1.3, status: 'Waspada' },
    { branchId: 'term_bitung', teus: 196300, teusTarget: 190000, rkapPct: 103.3, yoy: 8.0, status: 'Baik' },
    { branchId: 'term_ambon', teus: 88700, teusTarget: 92000, rkapPct: 96.4, yoy: 4.2, status: 'Waspada' },
    { branchId: 'term_sorong', teus: 74200, teusTarget: 70000, rkapPct: 106.0, yoy: 11.1, status: 'Baik' },
    { branchId: 'term_balikpapan', teus: 0, ton: 4820000, tonTarget: 4700000, rkapPct: 102.6, yoy: 5.9, status: 'Baik' },
    { branchId: 'term_pantoloan', teus: 0, ton: 2160000, tonTarget: 2300000, rkapPct: 93.9, yoy: -2.3, status: 'Waspada' },
    { branchId: 'term_ternate', teus: 0, ton: 1340000, tonTarget: 1300000, rkapPct: 103.1, yoy: 9.8, status: 'Baik' },
  ];

  for (let m = 1; m <= 9; m++) {
    for (const t of terminalData) {
      const isGood = t.rkapPct >= 100;
      const statusColor: StatusColor = isGood ? 'green' : 'yellow';

      // Insert TEUs
      stmtRec.run(
        `rec_2026_${m}_${t.branchId}_teus`,
        t.branchId,
        'dept_ops',
        'kpi_teus',
        m,
        2026,
        t.teusTarget ? Math.round(t.teusTarget / 9) : 0,
        t.teus ? Math.round(t.teus / 9) : 0,
        'TEUs',
        t.rkapPct,
        statusColor,
        'Data ilustrasi R4 PortSight',
        'upload_xlsx',
        'batch_init_2026',
        'verified',
        null,
        'admin.r4',
        '2026-09-30T08:00:00Z',
        'bod_regional',
        '2026-10-01T10:00:00Z'
      );

      // Insert Revenue
      const branchRev = t.rkapPct * 2.5;
      stmtRec.run(
        `rec_2026_${m}_${t.branchId}_rev`,
        t.branchId,
        'dept_keu',
        'kpi_rev',
        m,
        2026,
        Number((branchRev * 0.98).toFixed(1)),
        Number(branchRev.toFixed(1)),
        'Miliar Rp',
        t.rkapPct,
        statusColor,
        'Data ilustrasi R4 PortSight',
        'upload_xlsx',
        'batch_init_2026',
        'verified',
        null,
        'admin.r4',
        '2026-09-30T08:00:00Z',
        'bod_regional',
        '2026-10-01T10:00:00Z'
      );
    }
  }

  // 7. Seed Initial Audit Logs
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'aud_init_r4',
    'usr_adminreg',
    'Hendra Wijaya',
    'admin_regional',
    'CONFIG_UPDATE',
    'R4_PORTSIGHT',
    'regional_4',
    'Inisialisasi sistem R4 PortSight Pelindo Regional 4 (Makassar, 22/10/2026)',
    new Date().toISOString(),
    '127.0.0.1'
  );

  console.log('Seeding completed successfully for Pelindo Regional 4!');
}

if (require.main === module) {
  runSeed(true);
}
