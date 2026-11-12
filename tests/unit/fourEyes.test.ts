import { describe, it, expect } from 'vitest';
import {
  checkSeparationOfDuties,
  findUploaderConflict,
  fourEyesMessage,
} from '@/lib/fourEyes';

/**
 * `RBAC-14` — four eyes on the full chain.
 *
 * Two gaps this closes:
 * 1. The check only read `monthly_records.uploaded_by`, while the same figures are
 *    also written into six `module_*` tables each with its own uploader.
 * 2. Identity comparison mixed NIPP and display name with no clear precedence,
 *    so renaming an account (or two people sharing a name) changed the outcome.
 */

const actor = { nipp: '10002', name: 'Asqar', sub: 'usr_10002_3' };

describe('findUploaderConflict', () => {
  it('menemukan konflik ketika NIPP pengunggah sama dengan verifikator', () => {
    const conflict = findUploaderConflict(actor, ['10002']);
    expect(conflict).toEqual({ uploader: '10002', matchedOn: 'nipp' });
  });

  it('tidak terpengaruh spasi dan huruf besar/kecil', () => {
    expect(findUploaderConflict(actor, ['  10002 '])?.matchedOn).toBe('nipp');
    expect(findUploaderConflict(actor, ['Usr_10002_3'])?.matchedOn).toBe('sub');
  });

  it('mengenali baris lama yang menyimpan nama, bukan NIPP', () => {
    // Rows written before NIPPs were recorded still have to be protected, or the
    // oldest data in the system becomes the easiest to self-approve.
    const conflict = findUploaderConflict(actor, ['ASQAR']);
    expect(conflict).toEqual({ uploader: 'ASQAR', matchedOn: 'name' });
  });

  it('mengizinkan verifikator yang benar-benar orang lain', () => {
    expect(findUploaderConflict(actor, ['10004', 'Nuka'])).toBeNull();
  });

  it('mengabaikan nilai kosong tanpa menganggapnya konflik', () => {
    expect(findUploaderConflict(actor, ['', '   ', null, undefined])).toBeNull();
  });

  it('aktornya sendiri tanpa identitas tidak pernah cocok dengan apa pun', () => {
    // Failing closed here would block every verification; the auth layer already
    // guarantees nipp/sub are present, so an empty actor simply cannot match.
    expect(findUploaderConflict({}, ['10002', 'Asqar'])).toBeNull();
  });

  it('mengembalikan konflik pertama yang ditemukan, berurutan', () => {
    expect(findUploaderConflict(actor, ['10004', '10002'])?.uploader).toBe('10002');
  });
});

describe('checkSeparationOfDuties', () => {
  it('menolak ketika pengunggah berasal dari tabel modul, bukan hanya record induk', () => {
    // This is the `RBAC-14` gap: the parent record was uploaded by someone else,
    // but a module row carries the verifier's own NIPP.
    const result = checkSeparationOfDuties(actor, {
      uploaders: ['10004', '10002'],
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.conflict.uploader).toBe('10002');
    }
  });

  it('mengizinkan ketika seluruh pengunggah berbeda dari verifikator', () => {
    const result = checkSeparationOfDuties(actor, { uploaders: ['10004', '10005'] });
    expect(result).toEqual({ allowed: true });
  });

  it('menolak ketika tidak ada pengunggah tercatat sama sekali? Tidak — data tanpa pengunggah tidak dapat dipisahkan', () => {
    // With no recorded uploader the control has nothing to compare against. The
    // honest outcome is "cannot prove a conflict", not "assume a conflict":
    // blocking here would make legacy rows unverifiable forever.
    expect(checkSeparationOfDuties(actor, { uploaders: [] })).toEqual({ allowed: true });
  });
});

describe('fourEyesMessage', () => {
  it('menyebut id rekaman agar pengguna dan support membicarakan baris yang sama', () => {
    const message = fourEyesMessage({ uploader: '10002', matchedOn: 'nipp' }, 'rec_2026_9_r01_rfu');
    expect(message).toContain('rec_2026_9_r01_rfu');
    expect(message).toContain('Four-Eyes');
  });

  it('menjelaskan bahwa pencocokan terjadi lewat nama ketika itu penyebabnya', () => {
    const message = fourEyesMessage({ uploader: 'ASQAR', matchedOn: 'name' });
    expect(message).toContain('nama akun Anda');
  });

  it('menyebutkan langkah berikutnya, bukan hanya penolakan', () => {
    const message = fourEyesMessage({ uploader: '10002', matchedOn: 'nipp' });
    expect(message.toLowerCase()).toContain('rekan lain');
  });
});
