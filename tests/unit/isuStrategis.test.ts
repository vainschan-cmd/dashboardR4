import { describe, it, expect, beforeAll } from 'vitest';
import {
  isuStrategisSchema,
  isuStrategisUpdateSchema,
  parseWithSchema,
} from '@/lib/validation';
import { isuStrategisRepository } from '@/lib/repositories/isuStrategis';

describe('Isu Strategis Validation Schema', () => {
  const validPayload = {
    cabangCode: 'R01',
    cabangName: 'Makassar',
    kategori: 'Operasional',
    prioritas: 'P0',
    status: 'On Progress',
    judul: 'Optimalisasi Waiting Time Kapal Petikemas',
    akarMasalah: 'Fluktuasi kedatangan kapal dan perlunya percepatan cycle time.',
    tindakLanjut: 'Penerapan integrasi TOS generasi baru dan shift ganda.',
    pic: 'Divisi Operasi Pelayanan Kapal',
    targetSelesai: '31 Des 2026',
    progres: 65,
    dampak: 'Reduksi waiting time di bawah 1,0 jam per kapal.',
  };

  it('menerima payload lengkap yang valid', () => {
    const result = parseWithSchema(isuStrategisSchema, validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.judul).toBe(validPayload.judul);
      expect(result.data.progres).toBe(65);
      expect(result.data.prioritas).toBe('P0');
    }
  });

  it('menolak payload jika judul kurang dari 5 karakter', () => {
    const result = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      judul: 'Test',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Judul isu minimal 5 karakter');
    }
  });

  it('menolak payload jika field wajib akarMasalah kosong', () => {
    const result = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      akarMasalah: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Akar masalah wajib diisi');
    }
  });

  it('menolak payload jika progres di luar batas 0 - 100', () => {
    const resultOver = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      progres: 150,
    });
    expect(resultOver.success).toBe(false);

    const resultUnder = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      progres: -5,
    });
    expect(resultUnder.success).toBe(false);
  });

  it('menolak payload jika kategori atau prioritas tidak dikenal', () => {
    const resultInvalidKat = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      kategori: 'KategoriTidakValid',
    });
    expect(resultInvalidKat.success).toBe(false);

    const resultInvalidPrioritas = parseWithSchema(isuStrategisSchema, {
      ...validPayload,
      prioritas: 'P99',
    });
    expect(resultInvalidPrioritas.success).toBe(false);
  });

  it('mendukung pembaruan parsial dengan isuStrategisUpdateSchema', () => {
    const partialPayload = {
      status: 'Resolved',
      progres: 100,
    };
    const result = parseWithSchema(isuStrategisUpdateSchema, partialPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('Resolved');
      expect(result.data.progres).toBe(100);
    }
  });
});

describe('Isu Strategis Repository & Database Flow', () => {
  beforeAll(async () => {
    await isuStrategisRepository.ensureTable();
  });

  it('memastikan pemanggilan ensureTable bersifat idempoten', async () => {
    await expect(isuStrategisRepository.ensureTable()).resolves.toBeUndefined();
  });

  it('mengambil daftar isu strategis dari database', async () => {
    const list = await isuStrategisRepository.getAll();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);

    const first = list[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('kode');
    expect(first).toHaveProperty('judul');
    expect(first).toHaveProperty('prioritas');
    expect(first).toHaveProperty('status');
  });

  it('mendukung filter pencarian teks (search)', async () => {
    const searchResult = await isuStrategisRepository.getAll({ search: 'Optimalisasi' });
    expect(Array.isArray(searchResult)).toBe(true);
    searchResult.forEach((item) => {
      const match =
        item.judul.toLowerCase().includes('optimalisasi') ||
        item.kode.toLowerCase().includes('optimalisasi') ||
        item.akarMasalah.toLowerCase().includes('optimalisasi');
      expect(match).toBe(true);
    });
  });

  it('mendukung alur CRUD lengkap: create, getById, update, dan delete', async () => {
    // 1. Create
    const created = await isuStrategisRepository.create({
      cabangCode: 'R04',
      cabangName: 'Balikpapan',
      kategori: 'Fasilitas',
      prioritas: 'P1',
      status: 'Open',
      judul: 'Uji Coba Unit Test Isu Strategis Balikpapan',
      akarMasalah: 'Verifikasi pipeline database CRUD otomatis.',
      tindakLanjut: 'Uji integrasi repository dengan parameter aman.',
      pic: 'QA Engineer Regional 4',
      targetSelesai: '2026-12-31',
      progres: 10,
      dampak: 'Integritas data 100% tervalidasi.',
    }, 'UnitTester');

    expect(created.id).toBeDefined();
    expect(created.judul).toBe('Uji Coba Unit Test Isu Strategis Balikpapan');
    expect(created.progres).toBe(10);

    // 2. GetById
    const fetched = await isuStrategisRepository.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.cabangCode).toBe('R04');

    // 3. Update
    const updated = await isuStrategisRepository.update(created.id, {
      status: 'On Progress',
      progres: 85,
    }, 'UnitTester');

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('On Progress');
    expect(updated?.progres).toBe(85);

    // 4. Delete
    const deleted = await isuStrategisRepository.delete(created.id);
    expect(deleted).toBe(true);

    const fetchedAfterDelete = await isuStrategisRepository.getById(created.id);
    expect(fetchedAfterDelete).toBeNull();
  });
});

