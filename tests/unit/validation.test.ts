import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
  recordsQuerySchema,
  importValidateJsonSchema,
  verificationSchema,
  manualInputSchema,
  parseWithSchema,
  MAX_IMPORT_ROWS,
  MAX_UPLOAD_FILE_BYTES,
} from '@/lib/validation';

const STRONG = 'Rahasia-Kuat-2026';

describe('loginSchema', () => {
  it('menerima NIPP dan kata sandi yang wajar', () => {
    expect(parseWithSchema(loginSchema, { nipp: '10002', password: 'x' }).success).toBe(true);
  });

  it('memangkas spasi pada NIPP', () => {
    const parsed = parseWithSchema(loginSchema, { nipp: '  10002  ', password: 'x' });
    expect(parsed.success && parsed.data.nipp).toBe('10002');
  });

  it('menolak NIPP kosong', () => {
    expect(parseWithSchema(loginSchema, { nipp: '', password: 'x' }).success).toBe(false);
  });

  it('menolak kata sandi kosong', () => {
    expect(parseWithSchema(loginSchema, { nipp: '10002', password: '' }).success).toBe(false);
  });

  it('menolak NIPP yang terlalu panjang', () => {
    expect(parseWithSchema(loginSchema, { nipp: 'x'.repeat(200), password: 'x' }).success).toBe(
      false
    );
  });
});

describe('createUserSchema', () => {
  const base = {
    name: 'Pegawai Uji',
    nipp: '19999',
    divisi: 'Operasi',
    departemen: 'Terminal',
    password: STRONG,
  };

  it('menerima payload lengkap', () => {
    expect(parseWithSchema(createUserSchema, base).success).toBe(true);
  });

  it('menolak kata sandi yang tidak memenuhi kebijakan', () => {
    const parsed = parseWithSchema(createUserSchema, { ...base, password: 'password123' });
    expect(parsed.success).toBe(false);
  });

  it('menolak role di luar daftar resmi', () => {
    const parsed = parseWithSchema(createUserSchema, { ...base, role: 'superuser' });
    expect(parsed.success).toBe(false);
  });

  it('menolak field wajib yang kosong', () => {
    for (const field of ['name', 'nipp', 'divisi', 'departemen']) {
      const parsed = parseWithSchema(createUserSchema, { ...base, [field]: '   ' });
      expect(parsed.success, field).toBe(false);
    }
  });
});

describe('updateUserSchema', () => {
  const base = {
    id: 'usr_1',
    name: 'Pegawai Uji',
    divisi: 'Operasi',
    departemen: 'Terminal',
  };

  it('menerima payload tanpa kata sandi', () => {
    expect(parseWithSchema(updateUserSchema, base).success).toBe(true);
  });

  it('menolak field password (jalur kanonik ada di /api/users/password)', () => {
    const parsed = parseWithSchema(updateUserSchema, { ...base, password: STRONG });
    // Skema tidak memiliki field password; Zod membuang kunci tak dikenal
    // sehingga handler dapat menolaknya secara eksplisit.
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'password' in parsed.data).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('menerima perubahan yang valid', () => {
    const parsed = parseWithSchema(changePasswordSchema, {
      currentPassword: 'lama-sekali-2026',
      newPassword: STRONG,
      confirmPassword: STRONG,
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak konfirmasi yang tidak cocok', () => {
    const parsed = parseWithSchema(changePasswordSchema, {
      currentPassword: 'lama-sekali-2026',
      newPassword: STRONG,
      confirmPassword: 'beda-sendiri-2026',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error).toMatch(/tidak cocok/i);
  });

  it('menolak kata sandi baru yang sama dengan kata sandi lama', () => {
    const parsed = parseWithSchema(changePasswordSchema, {
      currentPassword: STRONG,
      newPassword: STRONG,
      confirmPassword: STRONG,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error).toMatch(/berbeda/i);
  });

  it('menolak kata sandi baru yang lemah', () => {
    const parsed = parseWithSchema(changePasswordSchema, {
      currentPassword: 'lama-sekali-2026',
      newPassword: 'pendek',
      confirmPassword: 'pendek',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('adminResetPasswordSchema', () => {
  it('default requireChangeOnNextLogin = true', () => {
    const parsed = parseWithSchema(adminResetPasswordSchema, {
      userId: 'usr_1',
      newPassword: STRONG,
    });
    expect(parsed.success && parsed.data.requireChangeOnNextLogin).toBe(true);
  });

  it('menghormati requireChangeOnNextLogin = false', () => {
    const parsed = parseWithSchema(adminResetPasswordSchema, {
      userId: 'usr_1',
      newPassword: STRONG,
      requireChangeOnNextLogin: false,
    });
    expect(parsed.success && parsed.data.requireChangeOnNextLogin).toBe(false);
  });

  it('menolak userId kosong', () => {
    expect(
      parseWithSchema(adminResetPasswordSchema, { userId: '  ', newPassword: STRONG }).success
    ).toBe(false);
  });
});

describe('recordsQuerySchema', () => {
  it('memberi default limit dan offset', () => {
    const parsed = parseWithSchema(recordsQuerySchema, {});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(200);
      expect(parsed.data.offset).toBe(0);
    }
  });

  it('menolak limit berlebihan', () => {
    expect(parseWithSchema(recordsQuerySchema, { limit: '9999' }).success).toBe(false);
  });

  it('menolak offset negatif', () => {
    expect(parseWithSchema(recordsQuerySchema, { offset: '-5' }).success).toBe(false);
  });

  it('mengubah string angka menjadi number', () => {
    const parsed = parseWithSchema(recordsQuerySchema, { limit: '50', offset: '100' });
    expect(parsed.success && parsed.data.limit).toBe(50);
    expect(parsed.success && parsed.data.offset).toBe(100);
  });
});

describe('importValidateJsonSchema', () => {
  it('menolak payload dengan baris melebihi batas', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ a: 1 }));
    expect(parseWithSchema(importValidateJsonSchema, { rows }).success).toBe(false);
  });

  it('menerima payload dalam batas', () => {
    const rows = Array.from({ length: 3 }, () => ({ a: 1 }));
    expect(parseWithSchema(importValidateJsonSchema, { rows }).success).toBe(true);
  });

  it('menolak source_type yang tidak dikenal', () => {
    expect(
      parseWithSchema(importValidateJsonSchema, { rows: [{ a: 1 }], source_type: 'ftp' }).success
    ).toBe(false);
  });
});

describe('verificationSchema', () => {
  it('menerima status yang sah', () => {
    for (const status of ['verified', 'revision_needed']) {
      expect(parseWithSchema(verificationSchema, { recordIds: ['r1'], status }).success).toBe(true);
    }
  });

  it('menolak daftar rekaman kosong', () => {
    expect(parseWithSchema(verificationSchema, { recordIds: [], status: 'verified' }).success).toBe(
      false
    );
  });

  it('menolak status di luar daftar', () => {
    expect(parseWithSchema(verificationSchema, { recordIds: ['r1'], status: 'approved' }).success).toBe(
      false
    );
  });
});

describe('manualInputSchema', () => {
  it('menerima modul yang sah', () => {
    for (const modul of ['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas']) {
      expect(parseWithSchema(manualInputSchema, { module: modul, data: {} }).success).toBe(true);
    }
  });

  it('menolak modul yang tidak dikenal', () => {
    expect(parseWithSchema(manualInputSchema, { module: 'lainnya', data: {} }).success).toBe(false);
  });
});

describe('parseWithSchema', () => {
  it('menggabungkan pesan galat menjadi satu string yang bisa ditampilkan', () => {
    const result = parseWithSchema(createUserSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('konstanta batas', () => {
  it('batas unggahan 5 MB dan 2.000 baris tetap sesuai dokumentasi', () => {
    expect(MAX_UPLOAD_FILE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_IMPORT_ROWS).toBe(2000);
  });
});
