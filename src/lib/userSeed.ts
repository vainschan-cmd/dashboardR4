import type { User } from './types';

/**
 * Official PIC master seed — pure data, no imports beyond the `User` type.
 *
 * Why a separate module (`CODE-04`): these rows lived in `userPicSync.ts`, which
 * imports `dbQueries` from `db.ts`; `db.ts` then imported this list back from
 * `userPicSync.ts`. That cycle worked only because the values were read lazily at
 * call time — a genuine module-level use would have observed `undefined` in one
 * of the two orders, and the failure would depend on the import order of unrelated
 * files. Keeping the data dependency-free means both sides can import it safely.
 *
 * Credentials are intentionally NOT stored here: initial passwords are resolved at
 * seed time via `resolveBootstrapPassword()` (env `BOOTSTRAP_PIC_PASSWORD` in
 * production, random per-process in dev).
 */
export type InitialPicSeed = Omit<User, 'id' | 'password'>;

export const INITIAL_OFFICIAL_PICS: InitialPicSeed[] = [
  { username: '10000', nipp: '10000', name: 'Akhirman (BOD)', email: 'bod.r4@pelindo.co.id', divisi: 'Direksi Pelindo Regional 4', departemen: 'Kantor Regional 4', role: 'viewer', branch_id: 'R99', department_id: null, active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10001', nipp: '10001', name: 'M Mansyur', email: 'budi.santoso@pelindo.co.id', divisi: 'Divisi Teknologi Informasi & Digitalisasi', departemen: 'Departemen Tata Kelola & Solusi TI', role: 'super_admin', branch_id: 'R99', department_id: 'dept_tek', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10002', nipp: '10002', name: 'Asqar', email: 'hendra.wijaya@pelindo.co.id', divisi: 'Divisi Strategi & Manajemen Kinerja Regional', departemen: 'Departemen Monitoring & Evaluasi Regional 4', role: 'admin_regional', branch_id: 'R99', department_id: 'dept_ops', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10003', nipp: '10003', name: 'Heiruddin', email: 'rudi.hartono@pelindo.co.id', divisi: 'Divisi Operasi & Pelayanan Kapal', departemen: 'Departemen Pelayanan Kapal & Barang', role: 'pic_dept_regional', branch_id: 'R99', department_id: 'dept_ops', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10004', nipp: '10004', name: 'Nuka', email: 'ahmad.dahlan@pelindo.co.id', divisi: 'Divisi Operasional Terminal Cabang', departemen: 'Departemen Operasi Cabang Makassar', role: 'pic_cabang', branch_id: 'R01', department_id: 'dept_ops', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10005', nipp: '10005', name: 'Rahmat Syukur', email: 'siti.rahma@pelindo.co.id', divisi: 'Divisi Keuangan & Manajemen Risiko', departemen: 'Departemen Akuntansi & Perpajakan', role: 'pic_dept_regional', branch_id: 'R99', department_id: 'dept_keu', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10006', nipp: '10006', name: 'Arkam', email: 'dewi.kartika@pelindo.co.id', divisi: 'Divisi Sumber Daya Manusia & Umum', departemen: 'Departemen SDM & Organisasi', role: 'pic_dept_regional', branch_id: 'R99', department_id: 'dept_sdm', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10007', nipp: '10007', name: 'Abri', email: 'agus.santoso@pelindo.co.id', divisi: 'Divisi Fasilitas & Peralatan Pelabuhan', departemen: 'Departemen Pemeliharaan & Teknik', role: 'pic_dept_regional', branch_id: 'R99', department_id: 'dept_tek', active: true, created_at: '2026-01-10T08:00:00Z' },
  { username: '10008', nipp: '10008', name: 'Fachruddin', email: 'faisal.ramadhan@pelindo.co.id', divisi: 'Divisi Operasional Terminal Cabang', departemen: 'Departemen Operasi Cabang Balikpapan', role: 'pic_cabang', branch_id: 'R04', department_id: 'dept_ops', active: true, created_at: '2026-01-12T08:00:00Z' },
  { username: '10009', nipp: '10009', name: 'Angga', email: 'nur.aini@pelindo.co.id', divisi: 'Divisi Operasional Terminal Cabang', departemen: 'Departemen Operasi Cabang Bitung', role: 'pic_cabang', branch_id: 'R05', department_id: 'dept_ops', active: true, created_at: '2026-01-12T08:00:00Z' },
];
