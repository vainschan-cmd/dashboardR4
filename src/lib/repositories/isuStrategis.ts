import { query } from '@/lib/db/connection';

export interface IsuStrategis {
  id: string;
  kode: string;
  cabangCode: string;
  cabangName: string;
  kategori: 'Operasional' | 'Finansial' | 'Fasilitas' | 'Komersial' | 'HSSE' | 'SDM';
  prioritas: 'P0' | 'P1' | 'P2';
  status: 'Open' | 'On Progress' | 'Monitoring' | 'Resolved';
  judul: string;
  akarMasalah: string;
  tindakLanjut: string;
  pic: string;
  targetSelesai: string;
  progres: number;
  dampak: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface CreateIsuStrategisInput {
  kode?: string;
  cabangCode: string;
  cabangName: string;
  kategori: IsuStrategis['kategori'];
  prioritas: IsuStrategis['prioritas'];
  status: IsuStrategis['status'];
  judul: string;
  akarMasalah: string;
  tindakLanjut: string;
  pic: string;
  targetSelesai: string;
  progres: number;
  dampak: string;
}

export type UpdateIsuStrategisInput = Partial<CreateIsuStrategisInput>;

export interface IsuStrategisFilter {
  cabang?: string;
  kategori?: string;
  prioritas?: string;
  status?: string;
  search?: string;
}

const SEED_ISU_STRATEGIS: Array<CreateIsuStrategisInput & { id: string; kode: string }> = [
  {
    id: 'isu-r4-001',
    kode: 'ISU-R4-OPS-001',
    cabangCode: 'R24',
    cabangName: 'Makassar New Port',
    kategori: 'Operasional',
    prioritas: 'P0',
    status: 'On Progress',
    judul: 'Optimalisasi Utilisasi Dermaga Petikemas & Reduksi Waiting Time Kapal di MNP',
    akarMasalah: 'Fluktuasi window kedatangan kapal dan perlunya percepatan crane cycle time saat window puncak.',
    tindakLanjut: 'Penerapan integrasi Terminal Operating System (TOS) generasi terbaru, pengaturan pola shift ganda, dan pengerukan alur berkala.',
    pic: 'Divisi Pelayanan Kapal & Terminal Petikemas',
    targetSelesai: '31 Des 2026',
    progres: 72,
    dampak: 'Meningkatkan throughput petikemas hingga 15% dan menekan waiting time di bawah 1,0 jam.',
  },
  {
    id: 'isu-r4-002',
    kode: 'ISU-R4-KEU-002',
    cabangCode: 'R99',
    cabangName: 'Regional 4 (Konsolidasi)',
    kategori: 'Finansial',
    prioritas: 'P0',
    status: 'On Progress',
    judul: 'Penyelarasan Saldo Rekonsiliasi & Transaksi Eliminasi Antar-Entitas Pelindo R4',
    akarMasalah: 'Perbedaan timing pencatatan transaksi antar-entitas (PMT, PTP, PSL, PJM) pada penutupan buku triwulanan.',
    tindakLanjut: 'Pembentukan Task Force Rekonsiliasi mingguan, automasi jurnal eliminasi di database PostgreSQL, dan harmonisasi kode akun.',
    pic: 'Divisi Keuangan & Manajemen Risiko',
    targetSelesai: '30 Nov 2026',
    progres: 65,
    dampak: 'Memastikan laporan keuangan konsolidasi auditable dan mencegah selisih eliminasi antar-anak usaha.',
  },
  {
    id: 'isu-r4-003',
    kode: 'ISU-R4-FAS-003',
    cabangCode: 'R04',
    cabangName: 'Balikpapan',
    kategori: 'Fasilitas',
    prioritas: 'P1',
    status: 'Monitoring',
    judul: 'Kesiapan Fasilitas Dermaga & Lapangan Penumpukan Pendukung Logistik IKN Nusantara',
    akarMasalah: 'Kebutuhan lonjakan throughput material semen, baja, dan modular konstruksi ke arah IKN.',
    tindakLanjut: 'Penguatan daya dukung lantai dermaga (quay deck load), penataan alur truk container, dan penambahan lighting lapangan 24/7.',
    pic: 'Divisi Fasilitas & Peralatan Pelabuhan',
    targetSelesai: '15 Des 2026',
    progres: 88,
    dampak: 'Menjamin 100% kelancaran pasokan material strategis nasional tanpa bottleneck di pelabuhan.',
  },
  {
    id: 'isu-r4-004',
    kode: 'ISU-R4-HSE-004',
    cabangCode: 'R05',
    cabangName: 'Bitung',
    kategori: 'HSSE',
    prioritas: 'P1',
    status: 'On Progress',
    judul: 'Penerapan Standar Keselamatan HSSE Golden Rules & Zero Accident di Dermaga Curah Kering',
    akarMasalah: 'Tingginya intensitas debu dan pergerakan alat berat excavator di area conveyor curah.',
    tindakLanjut: 'Pemasangan misting spray penekan debu, sertifikasi ulang operator alat, dan patroli keselamatan terjadwal setiap shift.',
    pic: 'Departemen HSSE Regional 4',
    targetSelesai: '31 Des 2026',
    progres: 80,
    dampak: 'Mencapai target Zero Fatalities and Zero Severe LTI (Lost Time Injury) sepanjang tahun berjalan.',
  },
  {
    id: 'isu-r4-005',
    kode: 'ISU-R4-OPS-005',
    cabangCode: 'R06',
    cabangName: 'Ambon',
    kategori: 'Operasional',
    prioritas: 'P2',
    status: 'On Progress',
    judul: 'Peremajaan Komponen Elektrikal & Kesiapan Suku Cadang Kritis Container Crane',
    akarMasalah: 'Komponen inverter dan kabel reel mengalami degradasi akibat salinitas udara laut tinggi.',
    tindakLanjut: 'Penggantian suku cadang preventif dengan spesifikasi marine-grade dan kontrak servis SLA vendor resmi.',
    pic: 'Departemen Pemeliharaan & Teknik Cabang Ambon',
    targetSelesai: '28 Feb 2027',
    progres: 55,
    dampak: 'Meningkatkan availability crane dari 88% menjadi di atas 95% secara stabil.',
  },
  {
    id: 'isu-r4-006',
    kode: 'ISU-R4-KOM-006',
    cabangCode: 'R07',
    cabangName: 'Jayapura',
    kategori: 'Komersial',
    prioritas: 'P2',
    status: 'Open',
    judul: 'Digitalisasi Pencatatan Kinerja Muatan Logistik & Tol Laut Wilayah Papua',
    akarMasalah: 'Masih adanya pencatatan manual di dermaga perintis dan keterbatasan koneksi stabil di pelabuhan satelit.',
    tindakLanjut: 'Pengadaan tablet tahan cuaca untuk tally dermaga, sistem offline-first sinkronisasi, dan pelatihan operator cabang.',
    pic: 'Divisi Komersial & TI Regional 4',
    targetSelesai: '31 Mar 2027',
    progres: 35,
    dampak: 'Akurasi rekonsiliasi data muatan naik menjadi 99,8% dan mempercepat proses invoicing pelanggan.',
  },
];

let tableInitialized = false;

function mapRowToIsu(row: Record<string, unknown>): IsuStrategis {
  return {
    id: String(row.id),
    kode: String(row.kode),
    cabangCode: String(row.cabang_code),
    cabangName: String(row.cabang_name),
    kategori: row.kategori as IsuStrategis['kategori'],
    prioritas: row.prioritas as IsuStrategis['prioritas'],
    status: row.status as IsuStrategis['status'],
    judul: String(row.judul),
    akarMasalah: String(row.akar_masalah),
    tindakLanjut: String(row.tindak_lanjut),
    pic: String(row.pic),
    targetSelesai: String(row.target_selesai),
    progres: Number(row.progres || 0),
    dampak: String(row.dampak),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  };
}

export const isuStrategisRepository = {
  /**
   * Memastikan tabel isu_strategis ada di PostgreSQL secara idempoten.
   * Jika tabel masih kosong, melakukan seeding awal 6 isu prioritas default.
   */
  ensureTable: async (): Promise<void> => {
    if (tableInitialized) return;

    await query(`
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
    `);

    // Periksa apakah tabel kosong, jika ya, isi seed awal
    const countRes = await query<{ count: number | string }>('SELECT COUNT(*) AS count FROM isu_strategis');
    const totalCount = Number(countRes.rows[0]?.count || 0);

    if (totalCount === 0) {
      for (const item of SEED_ISU_STRATEGIS) {
        await query(
          `INSERT INTO isu_strategis (
            id, kode, cabang_code, cabang_name, kategori, prioritas, status,
            judul, akar_masalah, tindak_lanjut, pic, target_selesai, progres, dampak,
            created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14,
            'SYSTEM_SEED', 'SYSTEM_SEED'
          ) ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.kode,
            item.cabangCode,
            item.cabangName,
            item.kategori,
            item.prioritas,
            item.status,
            item.judul,
            item.akarMasalah,
            item.tindakLanjut,
            item.pic,
            item.targetSelesai,
            item.progres,
            item.dampak,
          ]
        );
      }
    }

    tableInitialized = true;
  },

  /**
   * Mengambil seluruh daftar Isu Strategis dengan filter opsional.
   */
  getAll: async (filter?: IsuStrategisFilter): Promise<IsuStrategis[]> => {
    await isuStrategisRepository.ensureTable();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.cabang && filter.cabang !== 'ALL') {
      params.push(filter.cabang);
      conditions.push(`(cabang_code = $${params.length} OR cabang_code = 'R99')`);
    }

    if (filter?.kategori && filter.kategori !== 'ALL') {
      params.push(filter.kategori);
      conditions.push(`kategori = $${params.length}`);
    }

    if (filter?.prioritas && filter.prioritas !== 'ALL') {
      params.push(filter.prioritas);
      conditions.push(`prioritas = $${params.length}`);
    }

    if (filter?.status && filter.status !== 'ALL') {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filter?.search && filter.search.trim()) {
      params.push(`%${filter.search.trim().toLowerCase()}%`);
      const idx = params.length;
      conditions.push(`(
        LOWER(judul) LIKE $${idx} OR
        LOWER(kode) LIKE $${idx} OR
        LOWER(akar_masalah) LIKE $${idx} OR
        LOWER(pic) LIKE $${idx} OR
        LOWER(cabang_name) LIKE $${idx}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, kode, cabang_code, cabang_name, kategori, prioritas, status,
             judul, akar_masalah, tindak_lanjut, pic, target_selesai, progres, dampak,
             created_at, updated_at, created_by, updated_by
      FROM isu_strategis
      ${whereClause}
      ORDER BY
        CASE prioritas WHEN 'P0' THEN 1 WHEN 'P1' THEN 2 ELSE 3 END ASC,
        created_at DESC
    `;

    const res = await query<Record<string, unknown>>(sql, params);
    return res.rows.map(mapRowToIsu);
  },

  /**
   * Mengambil Isu Strategis berdasarkan ID.
   */
  getById: async (id: string): Promise<IsuStrategis | null> => {
    await isuStrategisRepository.ensureTable();

    const res = await query<Record<string, unknown>>(
      `SELECT id, kode, cabang_code, cabang_name, kategori, prioritas, status,
              judul, akar_masalah, tindak_lanjut, pic, target_selesai, progres, dampak,
              created_at, updated_at, created_by, updated_by
       FROM isu_strategis
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) return null;
    return mapRowToIsu(res.rows[0]);
  },

  /**
   * Menambah Isu Strategis baru ke database PostgreSQL.
   */
  create: async (
    data: CreateIsuStrategisInput,
    author: string = 'SYSTEM'
  ): Promise<IsuStrategis> => {
    await isuStrategisRepository.ensureTable();

    const id = `isu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const kode = data.kode && data.kode.trim()
      ? data.kode.trim().toUpperCase()
      : `ISU-R4-${data.kategori.substring(0, 3).toUpperCase()}-${String(Date.now()).slice(-4)}`;

    const res = await query<Record<string, unknown>>(
      `INSERT INTO isu_strategis (
        id, kode, cabang_code, cabang_name, kategori, prioritas, status,
        judul, akar_masalah, tindak_lanjut, pic, target_selesai, progres, dampak,
        created_at, updated_at, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        NOW(), NOW(), $15, $15
      ) RETURNING *`,
      [
        id,
        kode,
        data.cabangCode,
        data.cabangName,
        data.kategori,
        data.prioritas,
        data.status || 'Open',
        data.judul,
        data.akarMasalah,
        data.tindakLanjut,
        data.pic,
        data.targetSelesai,
        Math.min(100, Math.max(0, Number(data.progres) || 0)),
        data.dampak,
        author,
      ]
    );

    return mapRowToIsu(res.rows[0]);
  },

  /**
   * Memperbarui Isu Strategis di database PostgreSQL.
   */
  update: async (
    id: string,
    data: UpdateIsuStrategisInput,
    updater: string = 'SYSTEM'
  ): Promise<IsuStrategis | null> => {
    await isuStrategisRepository.ensureTable();

    const current = await isuStrategisRepository.getById(id);
    if (!current) return null;

    const merged = {
      kode: data.kode !== undefined ? data.kode : current.kode,
      cabangCode: data.cabangCode !== undefined ? data.cabangCode : current.cabangCode,
      cabangName: data.cabangName !== undefined ? data.cabangName : current.cabangName,
      kategori: data.kategori !== undefined ? data.kategori : current.kategori,
      prioritas: data.prioritas !== undefined ? data.prioritas : current.prioritas,
      status: data.status !== undefined ? data.status : current.status,
      judul: data.judul !== undefined ? data.judul : current.judul,
      akarMasalah: data.akarMasalah !== undefined ? data.akarMasalah : current.akarMasalah,
      tindakLanjut: data.tindakLanjut !== undefined ? data.tindakLanjut : current.tindakLanjut,
      pic: data.pic !== undefined ? data.pic : current.pic,
      targetSelesai: data.targetSelesai !== undefined ? data.targetSelesai : current.targetSelesai,
      progres: data.progres !== undefined ? Math.min(100, Math.max(0, Number(data.progres))) : current.progres,
      dampak: data.dampak !== undefined ? data.dampak : current.dampak,
    };

    const res = await query<Record<string, unknown>>(
      `UPDATE isu_strategis
       SET kode = $1,
           cabang_code = $2,
           cabang_name = $3,
           kategori = $4,
           prioritas = $5,
           status = $6,
           judul = $7,
           akar_masalah = $8,
           tindak_lanjut = $9,
           pic = $10,
           target_selesai = $11,
           progres = $12,
           dampak = $13,
           updated_at = NOW(),
           updated_by = $14
       WHERE id = $15
       RETURNING *`,
      [
        merged.kode,
        merged.cabangCode,
        merged.cabangName,
        merged.kategori,
        merged.prioritas,
        merged.status,
        merged.judul,
        merged.akarMasalah,
        merged.tindakLanjut,
        merged.pic,
        merged.targetSelesai,
        merged.progres,
        merged.dampak,
        updater,
        id,
      ]
    );

    if (res.rows.length === 0) return null;
    return mapRowToIsu(res.rows[0]);
  },

  /**
   * Menghapus Isu Strategis dari database PostgreSQL.
   */
  delete: async (id: string): Promise<boolean> => {
    await isuStrategisRepository.ensureTable();

    const res = await query('DELETE FROM isu_strategis WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  },
};

