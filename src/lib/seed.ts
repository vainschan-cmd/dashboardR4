import { getDb } from './db';
import { Branch, Department, User, KPIIndicator, TemplateConfig, KPIDirection, StatusColor } from './types';

export function runSeed(force = false) {
  const db = getDb();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  if (countRow.count > 0 && !force) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  console.log('Seeding initial data for Executive Dashboard Pelabuhan...');

  // Clear existing if force
  if (force) {
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
  }

  // 1. Branches
  const branches: Branch[] = [
    {
      id: 'br_tgprk',
      code: 'CBG-TGPRK',
      name: 'Cabang Tanjung Priok',
      region: 'Regional 2 (DKI & Jawa Barat)',
      address: 'Jl. Raya Pelabuhan No. 9, Tanjung Priok, Jakarta Utara',
      phone: '(021) 4301080',
      email: 'priok@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 4850,
        kolam_depth_mlws: -14.0,
        lapangan_sqm: 1450000,
        gudang_sqm: 120000,
        crane_units: 32,
        forklift_units: 65,
        tugboat_units: 14,
        pilotboat_units: 8,
      },
      overview: 'Pelabuhan tersibuk dan terbesar di Indonesia yang melayani lebih dari 50% arus kargo ekspor-impor nasional.',
    },
    {
      id: 'br_tgperak',
      code: 'CBG-TGBRK',
      name: 'Cabang Tanjung Perak',
      region: 'Regional 3 (Jawa Timur & Nusra)',
      address: 'Jl. Perak Timur No. 610, Surabaya, Jawa Timur',
      phone: '(031) 3291991',
      email: 'perak@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 3600,
        kolam_depth_mlws: -12.5,
        lapangan_sqm: 980000,
        gudang_sqm: 95000,
        crane_units: 24,
        forklift_units: 48,
        tugboat_units: 10,
        pilotboat_units: 6,
      },
      overview: 'Hub utama maritim di wilayah Indonesia Timur dengan konektivitas antarpulau terlengkap.',
    },
    {
      id: 'br_belawan',
      code: 'CBG-BLW',
      name: 'Cabang Belawan',
      region: 'Regional 1 (Sumatera Bagian Utara)',
      address: 'Jl. Krakatau No. 100, Belawan, Medan, Sumatera Utara',
      phone: '(061) 641401',
      email: 'belawan@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 2800,
        kolam_depth_mlws: -11.0,
        lapangan_sqm: 620000,
        gudang_sqm: 75000,
        crane_units: 18,
        forklift_units: 35,
        tugboat_units: 8,
        pilotboat_units: 5,
      },
      overview: 'Gerbang utama logistik dan komoditas perkebunan (sawit, karet) di Selat Malaka.',
    },
    {
      id: 'br_makassar',
      code: 'CBG-MKS',
      name: 'Cabang Makassar',
      region: 'Regional 4 (Sulawesi, Maluku, Papua)',
      address: 'Jl. Soekarno No. 1, Makassar, Sulawesi Selatan',
      phone: '(0411) 316521',
      email: 'makassar@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 2100,
        kolam_depth_mlws: -12.0,
        lapangan_sqm: 540000,
        gudang_sqm: 50000,
        crane_units: 14,
        forklift_units: 30,
        tugboat_units: 6,
        pilotboat_units: 4,
      },
      overview: 'Simpul logistik strategis Kawasan Timur Indonesia (KTI) yang terintegrasi dengan Makassar New Port (MNP).',
    },
    {
      id: 'br_balikpapan',
      code: 'CBG-BPN',
      name: 'Cabang Balikpapan',
      region: 'Regional 4 (Kalimantan & IKN)',
      address: 'Jl. Yos Sudarso No. 30, Balikpapan, Kalimantan Timur',
      phone: '(0542) 732040',
      email: 'balikpapan@pelindo.co.id',
      active: true,
      facilities: {
        dermaga_length_m: 1650,
        kolam_depth_mlws: -13.0,
        lapangan_sqm: 420000,
        gudang_sqm: 40000,
        crane_units: 10,
        forklift_units: 24,
        tugboat_units: 8,
        pilotboat_units: 4,
      },
      overview: 'Pelabuhan pintu gerbang utama material konstruksi logistik Ibu Kota Nusantara (IKN) dan migas Kalimantan.',
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
    { id: 'dept_pel', code: 'PEL', name: 'Pelanggan', pic_name: 'Dian Permatasari', pic_email: 'dian.pelanggan@pelabuhan.co.id', active: true, description: 'Pengelolaan relasi pelanggan, survei kepuasan, dan manajemen pengaduan/keluhan.' },
    { id: 'dept_hsse', code: 'HSSE', name: 'HSSE', pic_name: 'Capt. Rian Pratama', pic_email: 'rian.hsse@pelabuhan.co.id', active: true, description: 'Health, Safety, Security, and Environment (K3 & Lingkungan Hidup).' },
    { id: 'dept_keu', code: 'KEU', name: 'Keuangan', pic_name: 'Siti Rahma, SE, Ak.', pic_email: 'siti.keuangan@pelabuhan.co.id', active: true, description: 'Monitoring pendapatan, realisasi anggaran RKAP, biaya operasional, dan profitabilitas.' },
    { id: 'dept_kom', code: 'KOM', name: 'Komersial', pic_name: 'Eko Sulistyo', pic_email: 'eko.komersial@pelabuhan.co.id', active: true, description: 'Pengembangan pasar, utilisasi fasilitas, kontrak kerja sama bisnis, dan volume jasa.' },
    { id: 'dept_ops', code: 'OPS', name: 'Operasional', pic_name: 'Rudi Hartono, ST', pic_email: 'rudi.ops@pelabuhan.co.id', active: true, description: 'Pelayanan kapal, bongkar muat barang/petikemas, utilisasi dermaga (BOR), dan TRT/WT.' },
    { id: 'dept_tek', code: 'TEK', name: 'Teknik', pic_name: 'Ir. Agus Santoso', pic_email: 'agus.teknik@pelabuhan.co.id', active: true, description: 'Kesiapan fasilitas & alat (RFU), pemeliharaan preventif/korektif, dan progres investasi.' },
    { id: 'dept_sdm', code: 'SDM', name: 'SDM', pic_name: 'Dewi Kartika, M.M.', pic_email: 'dewi.sdm@pelabuhan.co.id', active: true, description: 'Manajemen tenaga kerja, produktivitas pegawai, diklat, sertifikasi, dan absensi.' },
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
    { id: 'usr_super', username: 'superadmin', name: 'Budi Santoso', email: 'superadmin@pelabuhan.co.id', role: 'super_admin', active: true },
    { id: 'usr_adminreg', username: 'adminreg', name: 'Hendra Wijaya', email: 'admin.regional@pelabuhan.co.id', role: 'admin_regional', active: true },
    { id: 'usr_pic_ops', username: 'pic_ops', name: 'Rudi Hartono', email: 'rudi.ops@pelabuhan.co.id', role: 'pic_dept_regional', department_id: 'dept_ops', active: true },
    { id: 'usr_pic_keu', username: 'pic_keu', name: 'Siti Rahma', email: 'siti.keuangan@pelabuhan.co.id', role: 'pic_dept_regional', department_id: 'dept_keu', active: true },
    { id: 'usr_pic_priok', username: 'pic_priok', name: 'Ahmad Dahlan', email: 'ahmad.priok@pelabuhan.co.id', role: 'pic_cabang', branch_id: 'br_tgprk', active: true },
    { id: 'usr_pic_perak', username: 'pic_perak', name: 'Bambang Sutrisno', email: 'bambang.perak@pelabuhan.co.id', role: 'pic_cabang', branch_id: 'br_tgperak', active: true },
    { id: 'usr_viewer', username: 'viewer_dir', name: 'Dr. Ir. Wahyu Wibowo (Direksi)', email: 'direksi@pelabuhan.co.id', role: 'viewer', active: true },
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
    // Operasional
    { id: 'kpi_ops_call', code: 'OPS-01', name: 'Arus Kunjungan Kapal', department_id: 'dept_ops', category: 'Trafik Kapal', unit: 'Call', direction: 'higher_is_better', formula_desc: 'Jumlah panggilan/kedatangan kapal di dermaga', default_target: 350, is_core_kpi: true, active: true },
    { id: 'kpi_ops_gt', code: 'OPS-02', name: 'Volume Gross Tonnage Kapal', department_id: 'dept_ops', category: 'Trafik Kapal', unit: 'GT (Juta)', direction: 'higher_is_better', formula_desc: 'Akumulasi tonase kotor kapal yang bersandar', default_target: 12.5, is_core_kpi: false, active: true },
    { id: 'kpi_ops_teus', code: 'OPS-03', name: 'Arus Petikemas', department_id: 'dept_ops', category: 'Kargo', unit: 'TEUs', direction: 'higher_is_better', formula_desc: 'Throughput boks petikemas ekspor/impor/domestik', default_target: 450000, is_core_kpi: true, active: true },
    { id: 'kpi_ops_cargo', code: 'OPS-04', name: 'Arus Non-Petikemas (Curah/General)', department_id: 'dept_ops', category: 'Kargo', unit: 'Ton (Ribu)', direction: 'higher_is_better', formula_desc: 'Muatan curah kering, curah cair, dan general cargo', default_target: 850, is_core_kpi: false, active: true },
    { id: 'kpi_ops_bor', code: 'OPS-05', name: 'Berth Occupancy Ratio (BOR)', department_id: 'dept_ops', category: 'Utilisasi', unit: '%', direction: 'higher_is_better', formula_desc: 'Rasio waktu pemakaian dermaga terhadap waktu tersedia (Ideal 60-70%)', default_target: 65.0, is_core_kpi: true, active: true },
    { id: 'kpi_ops_trt', code: 'OPS-06', name: 'Turn Around Time (TRT)', department_id: 'dept_ops', category: 'Waktu Pelayanan', unit: 'Jam', direction: 'lower_is_better', formula_desc: 'Waktu total kapal sejak tiba di perairan hingga berangkat', default_target: 28.0, is_core_kpi: true, active: true },
    { id: 'kpi_ops_wt', code: 'OPS-07', name: 'Waiting Time (WT)', department_id: 'dept_ops', category: 'Waktu Pelayanan', unit: 'Jam', direction: 'lower_is_better', formula_desc: 'Waktu tunggu kapal sebelum bersandar di dermaga', default_target: 1.5, is_core_kpi: false, active: true },
    { id: 'kpi_ops_bsh', code: 'OPS-08', name: 'Produktivitas Bongkar Muat (BSH)', department_id: 'dept_ops', category: 'Produktivitas', unit: 'Box/Kapal/Jam', direction: 'higher_is_better', formula_desc: 'Rata-rata boks per kapal per jam operasi', default_target: 45.0, is_core_kpi: false, active: true },

    // Keuangan
    { id: 'kpi_keu_rev', code: 'KEU-01', name: 'Pendapatan Usaha', department_id: 'dept_keu', category: 'Pendapatan', unit: 'Miliar Rp', direction: 'higher_is_better', formula_desc: 'Total omset pendapatan jasa kepelabuhanan', default_target: 380.0, is_core_kpi: true, active: true },
    { id: 'kpi_keu_cost', code: 'KEU-02', name: 'Beban Pokok & Operasional', department_id: 'dept_keu', category: 'Beban', unit: 'Miliar Rp', direction: 'lower_is_better', formula_desc: 'Biaya operasional langsung dan overhead', default_target: 240.0, is_core_kpi: false, active: true },
    { id: 'kpi_keu_profit', code: 'KEU-03', name: 'Laba Bersih Sebelum Pajak', department_id: 'dept_keu', category: 'Profitabilitas', unit: 'Miliar Rp', direction: 'higher_is_better', formula_desc: 'Pendapatan dikurangi total beban', default_target: 140.0, is_core_kpi: true, active: true },
    { id: 'kpi_keu_rkap', code: 'KEU-04', name: 'Realisasi Anggaran RKAP', department_id: 'dept_keu', category: 'Anggaran', unit: '%', direction: 'higher_is_better', formula_desc: 'Realisasi terhadap target RKAP tahunan', default_target: 95.0, is_core_kpi: true, active: true },

    // Pelanggan
    { id: 'kpi_pel_active', code: 'PEL-01', name: 'Jumlah Pelanggan Aktif', department_id: 'dept_pel', category: 'Pertumbuhan', unit: 'Entitas', direction: 'higher_is_better', formula_desc: 'Perusahaan pelayaran dan pemilik kargo bertransaksi aktif', default_target: 420, is_core_kpi: true, active: true },
    { id: 'kpi_pel_csat', code: 'PEL-02', name: 'Customer Satisfaction Index (CSAT)', department_id: 'dept_pel', category: 'Kepuasan', unit: 'Skor (0-100)', direction: 'higher_is_better', formula_desc: 'Indeks hasil survei kepuasan pelanggan berkala', default_target: 88.0, is_core_kpi: true, active: true },
    { id: 'kpi_pel_complaint', code: 'PEL-03', name: 'Keluhan Masuk', department_id: 'dept_pel', category: 'Pengaduan', unit: 'Kasus', direction: 'lower_is_better', formula_desc: 'Jumlah komplain atau tiket keluhan dari pelanggan', default_target: 15, is_core_kpi: false, active: true },
    { id: 'kpi_pel_sla', code: 'PEL-04', name: 'Penyelesaian Keluhan Sesuai SLA', department_id: 'dept_pel', category: 'Pengaduan', unit: '%', direction: 'higher_is_better', formula_desc: 'Persentase keluhan yang tuntas sebelum tenggat SLA (3 hari)', default_target: 95.0, is_core_kpi: true, active: true },

    // HSSE
    { id: 'kpi_hsse_fatality', code: 'HSSE-01', name: 'Fatality (Kecelakaan Fatal)', department_id: 'dept_hsse', category: 'Insiden', unit: 'Kasus', direction: 'lower_is_better', formula_desc: 'Kecelakaan kerja berakibat kematian (Target: Nol)', default_target: 0, is_core_kpi: true, active: true },
    { id: 'kpi_hsse_lti', code: 'HSSE-02', name: 'Lost Time Injury (LTI)', department_id: 'dept_hsse', category: 'Insiden', unit: 'Kasus', direction: 'lower_is_better', formula_desc: 'Kecelakaan yang menyebabkan hari kerja hilang', default_target: 0, is_core_kpi: true, active: true },
    { id: 'kpi_hsse_nearmiss', code: 'HSSE-03', name: 'Pelaporan Near Miss (Hampir Celaka)', department_id: 'dept_hsse', category: 'Kultur K3', unit: 'Laporan', direction: 'higher_is_better', formula_desc: 'Proaktif melapor potensi bahaya di area pelabuhan', default_target: 45, is_core_kpi: false, active: true },
    { id: 'kpi_hsse_inspection', code: 'HSSE-04', name: 'Realisasi Safety Inspection', department_id: 'dept_hsse', category: 'Kepatuhan', unit: '%', direction: 'higher_is_better', formula_desc: 'Inspeksi K3 lapangan terhadap jadwal wajib', default_target: 98.0, is_core_kpi: false, active: true },
    { id: 'kpi_hsse_env', code: 'HSSE-05', name: 'Kepatuhan Baku Mutu Lingkungan', department_id: 'dept_hsse', category: 'Lingkungan', unit: '%', direction: 'higher_is_better', formula_desc: 'Pemantauan kualitas air laut, udara, dan limbah B3', default_target: 96.0, is_core_kpi: true, active: true },

    // Komersial
    { id: 'kpi_kom_dermaga', code: 'KOM-01', name: 'Pendapatan Jasa Dermaga & Tambat', department_id: 'dept_kom', category: 'Layanan', unit: 'Miliar Rp', direction: 'higher_is_better', formula_desc: 'Tarif tambat dan dermaga kapal masuk', default_target: 85.0, is_core_kpi: false, active: true },
    { id: 'kpi_kom_tunda', code: 'KOM-02', name: 'Pendapatan Jasa Pemanduan & Penundaan', department_id: 'dept_kom', category: 'Layanan', unit: 'Miliar Rp', direction: 'higher_is_better', formula_desc: 'Pendapatan kapal tunda dan perwira pandu laut', default_target: 65.0, is_core_kpi: false, active: true },
    { id: 'kpi_kom_kontrak', code: 'KOM-03', name: 'Kontrak Kerjasama Baru / Perpanjangan', department_id: 'dept_kom', category: 'Bisnis', unit: 'Kontrak', direction: 'higher_is_better', formula_desc: 'PKS kemitraan dengan B2B shipping lines & forwarder', default_target: 8, is_core_kpi: true, active: true },

    // Teknik
    { id: 'kpi_tek_rfu', code: 'TEK-01', name: 'Kesiapan Alat / Ready For Use (RFU)', department_id: 'dept_tek', category: 'Kesiapan', unit: '%', direction: 'higher_is_better', formula_desc: 'Ketersediaan CC, RTG, Reach Stacker beroperasi prima', default_target: 88.0, is_core_kpi: true, active: true },
    { id: 'kpi_tek_preventive', code: 'TEK-02', name: 'Rasio Pemeliharaan Preventif', department_id: 'dept_tek', category: 'Maintenance', unit: '%', direction: 'higher_is_better', formula_desc: 'Porsi pemeliharaan terjadwal vs perbaikan mendadak', default_target: 80.0, is_core_kpi: false, active: true },
    { id: 'kpi_tek_downtime', code: 'TEK-03', name: 'Total Waktu Kerusakan / Downtime', department_id: 'dept_tek', category: 'Kendala', unit: 'Jam', direction: 'lower_is_better', formula_desc: 'Waktu henti alat bongkar muat akibat kerusakan mekanik/elektrik', default_target: 25.0, is_core_kpi: true, active: true },
    { id: 'kpi_tek_capex', code: 'TEK-04', name: 'Progres Proyek Investasi Fasilitas', department_id: 'dept_tek', category: 'Investasi', unit: '%', direction: 'higher_is_better', formula_desc: 'Progres fisik perpanjangan dermaga / pengerukan alur', default_target: 92.0, is_core_kpi: false, active: true },

    // SDM
    { id: 'kpi_sdm_total', code: 'SDM-01', name: 'Jumlah Pegawai Aktif', department_id: 'dept_sdm', category: 'Komposisi', unit: 'Orang', direction: 'higher_is_better', formula_desc: 'Total SDM organik dan penunjang operasional', default_target: 850, is_core_kpi: false, active: true },
    { id: 'kpi_sdm_prod', code: 'SDM-02', name: 'Produktivitas SDM (Omset/Pegawai)', department_id: 'dept_sdm', category: 'Produktivitas', unit: 'Juta Rp/Org', direction: 'higher_is_better', formula_desc: 'Pendapatan usaha dibagi jumlah total personil', default_target: 450.0, is_core_kpi: true, active: true },
    { id: 'kpi_sdm_training', code: 'SDM-03', name: 'Rata-rata Jam Pelatihan Pegawai', department_id: 'dept_sdm', category: 'Pengembangan', unit: 'Jam/Pegawai', direction: 'higher_is_better', formula_desc: 'Jam diklat kompetensi teknis & manajemen', default_target: 24.0, is_core_kpi: false, active: true },
    { id: 'kpi_sdm_attend', code: 'SDM-04', name: 'Tingkat Kehadiran / Presensi', department_id: 'dept_sdm', category: 'Kedisiplinan', unit: '%', direction: 'higher_is_better', formula_desc: 'Persentase hari hadir kerja resmi', default_target: 96.5, is_core_kpi: true, active: true },
  ];

  const stmtInd = db.prepare(`
    INSERT INTO kpi_indicators (id, code, name, department_id, category, unit, direction, formula_desc, default_target, is_core_kpi, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const k of indicators) {
    stmtInd.run(k.id, k.code, k.name, k.department_id, k.category, k.unit, k.direction, k.formula_desc || '', k.default_target, k.is_core_kpi ? 1 : 0, k.active ? 1 : 0);
  }

  // 5. Default Templates per Department
  const defaultColumns = [
    { column_name: 'Kode Cabang', field_key: 'branch_code', data_type: 'string', required: true, sample_value: 'CBG-TGPRK' },
    { column_name: 'Nama Cabang', field_key: 'branch_name', data_type: 'string', required: false, sample_value: 'Cabang Tanjung Priok' },
    { column_name: 'Departemen', field_key: 'department_code', data_type: 'string', required: true, sample_value: 'OPS' },
    { column_name: 'Bulan', field_key: 'month', data_type: 'number', required: true, sample_value: 3 },
    { column_name: 'Tahun', field_key: 'year', data_type: 'number', required: true, sample_value: 2025 },
    { column_name: 'Kode Indikator', field_key: 'indicator_code', data_type: 'string', required: true, sample_value: 'OPS-01' },
    { column_name: 'Nama Indikator', field_key: 'indicator_name', data_type: 'string', required: false, sample_value: 'Arus Kunjungan Kapal' },
    { column_name: 'Target', field_key: 'target', data_type: 'number', required: true, sample_value: 350 },
    { column_name: 'Realisasi', field_key: 'realization', data_type: 'number', required: true, sample_value: 368 },
    { column_name: 'Satuan', field_key: 'unit', data_type: 'string', required: true, sample_value: 'Call' },
    { column_name: 'Keterangan', field_key: 'notes', data_type: 'string', required: false, sample_value: 'Data simulasi terverifikasi' },
  ];

  const stmtTpl = db.prepare(`
    INSERT INTO templates (id, department_id, version, name, description, columns, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of departments) {
    const tpl: TemplateConfig = {
      id: `tpl_${d.code.toLowerCase()}`,
      department_id: d.id,
      version: 'v1.2-Standard',
      name: `Template Resmi Pelaporan Bulanan Departemen ${d.name}`,
      description: `Format spreadsheet standar input data indikator ${d.name} seluruh cabang pelabuhan.`,
      columns: defaultColumns as any,
      updated_at: new Date().toISOString(),
    };
    stmtTpl.run(tpl.id, tpl.department_id, tpl.version, tpl.name, tpl.description, JSON.stringify(tpl.columns), tpl.updated_at);
  }

  // 6. Generate Realistic Simulated Monthly Records
  // We will generate records for 2024 (12 months) and 2025 (12 months) and 2026 (Jan, Feb, Mar)
  const stmtRec = db.prepare(`
    INSERT INTO monthly_records (
      id, branch_id, department_id, indicator_id, month, year,
      target, realization, unit, achievement_pct, status_color, notes,
      source_type, batch_id, verification_status, revision_notes,
      uploaded_by, uploaded_at, verified_by, verified_at, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // Scale factor per port size
  const portScale: Record<string, number> = {
    br_tgprk: 1.0,
    br_tgperak: 0.78,
    br_belawan: 0.52,
    br_makassar: 0.42,
    br_balikpapan: 0.36,
  };

  const years = [2024, 2025];
  for (const yr of years) {
    for (let m = 1; m <= 12; m++) {
      for (const b of branches) {
        const scale = portScale[b.id] || 0.5;

        for (const ind of indicators) {
          const recId = `rec_${yr}_${m}_${b.code}_${ind.code}`.toLowerCase();

          // Seasonal factor & random variation
          const seasonalFactor = 1 + Math.sin((m / 12) * Math.PI * 2) * 0.08 + (yr === 2025 ? 0.05 : 0);
          const noise = 0.92 + Math.random() * 0.16;

          let targetVal = Number((ind.default_target * (ind.category.includes('Trafik') || ind.category.includes('Kargo') || ind.category.includes('Layanan') || ind.category.includes('Komposisi') ? scale : 1)).toFixed(2));
          if (ind.code === 'HSSE-01' || ind.code === 'HSSE-02') {
            targetVal = 0;
          }

          let realVal = Number((targetVal * seasonalFactor * noise).toFixed(2));

          // Fine-tune specific indicators
          if (ind.code === 'HSSE-01') {
            // Fatality: mostly 0, rare 1 in branch 3 years ago
            realVal = 0;
          } else if (ind.code === 'HSSE-02') {
            // LTI: mostly 0, occasionally 1
            realVal = Math.random() < 0.12 ? 1 : 0;
          } else if (ind.unit === '%') {
            realVal = Math.min(100, Math.max(40, Number((targetVal * (0.95 + Math.random() * 0.08)).toFixed(1))));
          }

          // Calculate Achievement & Traffic Light Status
          let achievementPct = 100;
          let statusColor: StatusColor = 'green';

          if (ind.direction === 'higher_is_better') {
            if (targetVal > 0) {
              achievementPct = Number(((realVal / targetVal) * 100).toFixed(1));
            } else {
              achievementPct = realVal > 0 ? 120 : 100;
            }

            if (achievementPct >= 100) statusColor = 'green';
            else if (achievementPct >= 85) statusColor = 'yellow';
            else statusColor = 'red';
          } else {
            // lower_is_better
            if (targetVal === 0) {
              achievementPct = realVal === 0 ? 100 : 0;
              statusColor = realVal === 0 ? 'green' : 'red';
            } else {
              const diffRatio = (targetVal - realVal) / targetVal;
              achievementPct = Number((100 + diffRatio * 100).toFixed(1));
              if (realVal <= targetVal) statusColor = 'green';
              else if (realVal <= targetVal * 1.2) statusColor = 'yellow';
              else statusColor = 'red';
            }
          }

          // Verification status: 2024 all verified. 2025 mostly verified, month 12 has some pending.
          let verStatus = 'verified';
          let revNotes: string | null = null;
          let verBy: string | null = 'adminreg';
          let verAt: string | null = `${yr}-${String(m).padStart(2, '0')}-28T09:00:00Z`;

          if (yr === 2025 && m === 12) {
            if (b.id === 'br_balikpapan') {
              verStatus = 'pending_verification';
              verBy = null;
              verAt = null;
            } else if (b.id === 'br_makassar' && ind.code === 'OPS-06') {
              verStatus = 'revision_needed';
              revNotes = 'Angka TRT melebihi rata-rata triwulan, mohon lampirkan rincian kendala pandu laut di dermaga curah.';
              verBy = 'adminreg';
            }
          }

          stmtRec.run(
            recId,
            b.id,
            ind.department_id,
            ind.id,
            m,
            yr,
            targetVal,
            realVal,
            ind.unit,
            achievementPct,
            statusColor,
            'DATA SIMULASI - Estimasi kinerja bulanan pelabuhan resmi',
            'upload_xlsx',
            `batch_init_${yr}_${m}`,
            verStatus,
            revNotes,
            'pic_system',
            `${yr}-${String(m).padStart(2, '0')}-05T10:00:00Z`,
            verBy,
            verAt
          );
        }
      }
    }
  }

  // Also seed Year 2026 Q1 data (Jan, Feb, Mar)
  for (let m = 1; m <= 3; m++) {
    for (const b of branches) {
      const scale = portScale[b.id] || 0.5;
      for (const ind of indicators) {
        const recId = `rec_2026_${m}_${b.code}_${ind.code}`.toLowerCase();
        let targetVal = Number((ind.default_target * (ind.category.includes('Trafik') || ind.category.includes('Kargo') || ind.category.includes('Layanan') || ind.category.includes('Komposisi') ? scale : 1)).toFixed(2));
        if (ind.code === 'HSSE-01' || ind.code === 'HSSE-02') targetVal = 0;

        let realVal = Number((targetVal * (0.94 + Math.random() * 0.14)).toFixed(2));
        if (ind.code === 'HSSE-01') realVal = 0;
        else if (ind.code === 'HSSE-02') realVal = Math.random() < 0.1 ? 1 : 0;
        else if (ind.unit === '%') realVal = Math.min(100, Math.max(45, Number((targetVal * (0.96 + Math.random() * 0.06)).toFixed(1))));

        let achievementPct = 100;
        let statusColor: StatusColor = 'green';
        if (ind.direction === 'higher_is_better') {
          achievementPct = targetVal > 0 ? Number(((realVal / targetVal) * 100).toFixed(1)) : 100;
          statusColor = achievementPct >= 100 ? 'green' : achievementPct >= 85 ? 'yellow' : 'red';
        } else {
          statusColor = realVal <= targetVal ? 'green' : realVal <= targetVal * 1.2 ? 'yellow' : 'red';
          achievementPct = targetVal > 0 ? Number((100 + ((targetVal - realVal) / targetVal) * 100).toFixed(1)) : (realVal === 0 ? 100 : 0);
        }

        // Jan 2026: verified. Feb 2026: pending verification. Mar 2026: draft & revision needed
        let verStatus = m === 1 ? 'verified' : m === 2 ? 'pending_verification' : (b.id === 'br_tgprk' ? 'verified' : b.id === 'br_tgperak' ? 'revision_needed' : 'draft');
        let revNotes = verStatus === 'revision_needed' ? 'Perlu rekonsiliasi data volume peti kemas dengan billing system sebelum pengesahan.' : null;

        stmtRec.run(
          recId,
          b.id,
          ind.department_id,
          ind.id,
          m,
          2026,
          targetVal,
          realVal,
          ind.unit,
          achievementPct,
          statusColor,
          'DATA SIMULASI - Pelaporan Kinerja Berjalan 2026',
          'upload_xlsx',
          `batch_2026_${m}`,
          verStatus,
          revNotes,
          'pic_cabang',
          `2026-0${m}-04T08:30:00Z`,
          verStatus === 'verified' ? 'adminreg' : null,
          verStatus === 'verified' ? `2026-0${m}-06T14:00:00Z` : null
        );
      }
    }
  }

  // 7. Seed Initial Audit Logs
  const auditEntries = [
    { user_id: 'usr_super', user_name: 'Budi Santoso', user_role: 'super_admin', action: 'CONFIG_UPDATE' as const, entity: 'SYSTEM', entity_id: 'init', details: 'Inisialisasi sistem database master cabang dan departemen.' },
    { user_id: 'usr_pic_priok', user_name: 'Ahmad Dahlan', user_role: 'pic_cabang', action: 'UPLOAD' as const, entity: 'MONTHLY_RECORD', entity_id: 'batch_2026_1', details: 'Upload spreadsheet kinerja Cabang Tanjung Priok periode Januari 2026.' },
    { user_id: 'usr_adminreg', user_name: 'Hendra Wijaya', user_role: 'admin_regional', action: 'APPROVE' as const, entity: 'MONTHLY_RECORD', entity_id: 'batch_2026_1', details: 'Verifikasi dan pengesahan seluruh data kinerja Regional Januari 2026.' },
    { user_id: 'usr_adminreg', user_name: 'Hendra Wijaya', user_role: 'admin_regional', action: 'REVISE' as const, entity: 'MONTHLY_RECORD', entity_id: 'rec_2026_3_cbg-tgbrk_ops-03', details: 'Meminta revisi volume arus petikemas Cabang Surabaya untuk bulan Maret 2026.' },
  ];

  const stmtAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, details, timestamp, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let audIdx = 1;
  for (const a of auditEntries) {
    stmtAudit.run(`aud_${audIdx++}`, a.user_id, a.user_name, a.user_role, a.action, a.entity, a.entity_id, a.details, new Date().toISOString(), '127.0.0.1');
  }

  console.log('Seeding completed successfully!');
}

// Auto-run if executed directly
if (require.main === module) {
  runSeed(true);
}
