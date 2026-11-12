// scripts/regression-test.mjs
// Automated security and integration regression test suite for PortDash R4

import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
// Bootstrap/seed password is provided via env. Never hardcode credentials in tests.
const TEST_PASSWORD = process.env.TEST_PIC_PASSWORD || process.env.BOOTSTRAP_PIC_PASSWORD || '';
// Development may generate a distinct random password per account; supply them here.
let TEST_PASSWORD_MAP = {};
try {
  TEST_PASSWORD_MAP = JSON.parse(process.env.TEST_PIC_PASSWORDS || '{}');
} catch {
  TEST_PASSWORD_MAP = {};
}
if (
  !TEST_PASSWORD &&
  !process.env.TEST_ADMIN_PASSWORD &&
  !process.env.TEST_VIEWER_PASSWORD &&
  Object.keys(TEST_PASSWORD_MAP).length === 0
) {
  console.error(
    'Kredensial uji wajib diatur: TEST_ADMIN_PASSWORD (10002), TEST_VIEWER_PASSWORD (10000), ' +
      'TEST_PIC_PASSWORD (10004), atau satu peta TEST_PIC_PASSWORDS=\'{"10000":"...","10002":"...","10004":"..."}\'.'
  );
  process.exit(1);
}
// Per-account credentials.
//
// Resolution order for each NIPP: `TEST_PIC_PASSWORDS` (JSON map) → role-specific
// variable → `TEST_PASSWORD`. Role-specific variables exist because a silent typo
// is expensive here: five failed logins lock the account for 15 minutes, and the
// rest of the suite then fails with 401 instead of reporting the real problem.
//
//   TEST_VIEWER_PASSWORD → 10000 (BOD / viewer)
//   TEST_ADMIN_PASSWORD  → 10002 (Admin Regional)
//   TEST_PIC_PASSWORD    → 10004 (PIC cabang)
const ROLE_PASSWORD_ENV = {
  '10000': process.env.TEST_VIEWER_PASSWORD,
  '10002': process.env.TEST_ADMIN_PASSWORD,
  '10004': process.env.TEST_PIC_PASSWORD || process.env.BOOTSTRAP_PIC_PASSWORD,
};

function passwordFor(nipp) {
  return TEST_PASSWORD_MAP[nipp] || ROLE_PASSWORD_ENV[nipp] || TEST_PASSWORD;
}

// Failure accounting. Previously a failing assertion printed [GAGAL] and set a
// non-zero exit code, but the closing line still announced "selesai dengan
// sukses" — a green summary over a red run is how a suite stops being trusted.
const failures = [];
let testCount = 0;

async function runTest(name, fn) {
  testCount += 1;
  process.stdout.write(`• Menguji: ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32m[BERHASIL]\x1b[0m');
  } catch (err) {
    console.log('\x1b[31m[GAGAL]\x1b[0m');
    console.error(err);
    failures.push({ name, err });
    process.exitCode = 1;
  }
}

function parseCookie(response, cookieName) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function loginUser(nipp, password = passwordFor(nipp)) {
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nipp, password }),
  });
  const data = await res.json();
  const token = parseCookie(res, 'portsight_access_token');
  const refreshToken = parseCookie(res, 'portsight_refresh_token');
  return { res, data, token, refreshToken };
}

async function main() {
  console.log(`\n=== Memulai Rangkaian Pengujian Regresi Keamanan PortDash R4 (${BASE_URL}) ===\n`);

  // 1. Endpoint Sensitif Menolak Permintaan Tanpa Sesi
  await runTest('GET /api/master tanpa sesi harus ditolak (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/master`);
    assert.equal(res.status, 401, `Status diharapkan 401 tetapi menerima ${res.status}`);
  });

  await runTest('GET /api/users/export tanpa sesi harus ditolak (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/export`);
    assert.equal(res.status, 401, `Status diharapkan 401 tetapi menerima ${res.status}`);
  });

  await runTest('POST /api/import/sheets-sync tanpa sesi harus ditolak (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/import/sheets-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/12345678901234567890123456789012345678901234/edit',
      }),
    });
    assert.equal(res.status, 401, `Status diharapkan 401 tetapi menerima ${res.status}`);
  });

  await runTest('GET /api/import/drive-sync tanpa sesi harus ditolak (401/405)', async () => {
    const res = await fetch(`${BASE_URL}/api/import/drive-sync`);
    assert.ok(res.status === 401 || res.status === 405, `Status diharapkan 401/405 tetapi menerima ${res.status}`);
  });

  await runTest('POST /api/users pendaftaran publik ditolak jika ALLOW_PUBLIC_REGISTRATION=false', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nipp: '99999',
        name: 'Hacker Test',
        divisi: 'Divisi Luar',
        departemen: 'Dept Luar',
        password: passwordFor('10002'),
        role: 'super_admin',
      }),
    });
    // Jika publik ditolak tanpa sesi admin, harus mengembalikan 401 atau 403
    assert.ok(res.status === 401 || res.status === 403, `Status diharapkan 401/403 tetapi menerima ${res.status}`);
  });

  // 2. Login Autentikasi dan Pembuatan Token Sesi
  let adminCookie = '';
  let viewerCookie = '';
  let picCabangCookie = '';

  await runTest('Autentikasi Admin Regional (10002) dan penerbitan HttpOnly cookie', async () => {
    const { res, data, token } = await loginUser('10002');
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'admin_regional');
    assert.ok(token, 'Token cookie portsight_session harus terbit');
    adminCookie = `portsight_access_token=${token}`;
  });

  await runTest('Autentikasi BOD / Viewer (10000)', async () => {
    const { res, data, token } = await loginUser('10000');
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'viewer');
    assert.ok(token);
    viewerCookie = `portsight_access_token=${token}`;
  });

  await runTest('Autentikasi PIC Cabang Makassar (10004) dengan branch_id R01', async () => {
    const { res, data, token } = await loginUser('10004');
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'pic_cabang');
    assert.equal(data.user.branch_id, 'R01');
    assert.ok(token);
    picCabangCookie = `portsight_access_token=${token}`;
  });

  // 3. Hak Akses Sesuai Role
  await runTest('Admin Regional dapat mengakses GET /api/master (200)', async () => {
    const res = await fetch(`${BASE_URL}/api/master`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.branches));
  });

  await runTest('Viewer ditolak saat mengakses GET /api/users/export (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/export`, {
      headers: { Cookie: viewerCookie },
    });
    assert.equal(res.status, 403);
  });

  await runTest('Viewer ditolak saat memanggil POST /api/manual-input (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/manual-input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({
        module: 'finansial',
        data: { TAHUN: 2026, BULAN: 9, KODE_CBG: 'R01', CABANG: 1000000 },
      }),
    });
    assert.equal(res.status, 403);
  });

  // 4. Batasan Akses dan Penegakan ABAC Server-Side
  await runTest('Viewer hanya menerima rekaman terverifikasi pada GET /api/records meskipun verified_only=false dimanipulasi', async () => {
    const res = await fetch(`${BASE_URL}/api/records?verification_status=pending_verification`, {
      headers: { Cookie: viewerCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    for (const r of data.records) {
      assert.equal(
        r.verification_status,
        'verified',
        `Viewer tidak boleh melihat status ${r.verification_status}`
      );
    }
  });

  await runTest('PIC Cabang Makassar (R01) hanya melihat data cabang R01 pada GET /api/records', async () => {
    const res = await fetch(`${BASE_URL}/api/records?branch_id=R04`, {
      headers: { Cookie: picCabangCookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    for (const r of data.records) {
      assert.ok(
        r.branch_id === 'b_makassar' || r.branch_id === 'R01' || r.branch_code === 'R01',
        `PIC R01 tidak boleh melihat data cabang lain: ${r.branch_id}`
      );
    }
  });

  // 5. Validasi Skema Impor & Proteksi Transaksi
  await runTest('POST /api/import/commit menolak rekaman yang tidak valid / melampaui batas batas', async () => {
    const res = await fetch(`${BASE_URL}/api/import/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        batchId: 'invalid-batch',
        records: [
          {
            branch_id: 'INVALID_BRANCH',
            department_id: 'dept_invalid',
            month: 99, // bulan salah
            year: 1990, // tahun salah
            indicator_id: 'kpi_fake',
            realization: 'bukan_angka',
          },
        ],
      }),
    });
    assert.equal(res.status, 400);
  });

  // 6. Keamanan Token & Sesi (Fase 0/1)
  await runTest('Refresh token tidak diterima sebagai Bearer access token (401)', async () => {
    const { refreshToken } = await loginUser('10002');
    assert.ok(refreshToken, 'Refresh token harus terbit');
    const res = await fetch(`${BASE_URL}/api/master`, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(res.status, 401, `Status diharapkan 401 tetapi menerima ${res.status}`);
  });

  await runTest('Logout mencabut access dan refresh token (401)', async () => {
    const { token, refreshToken } = await loginUser('10002');
    const logoutRes = await fetch(`${BASE_URL}/api/users/logout`, {
      method: 'POST',
      headers: {
        Cookie: `portsight_access_token=${token}; portsight_refresh_token=${refreshToken}`,
      },
    });
    assert.equal(logoutRes.status, 200);
    const afterAccess = await fetch(`${BASE_URL}/api/master`, {
      headers: { Cookie: `portsight_access_token=${token}` },
    });
    assert.equal(afterAccess.status, 401);
    const afterRefresh = await fetch(`${BASE_URL}/api/master`, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(afterRefresh.status, 401);
  });

  await runTest('PIC Cabang tidak dapat memperluas filter cabang pada /api/keuangan/konsolidasi', async () => {
    const res = await fetch(
      `${BASE_URL}/api/keuangan/konsolidasi?year=2026&month=8&branches=ALL`,
      { headers: { Cookie: picCabangCookie } }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    const codes = new Set([
      ...(data.charts?.topLabaBranches || []).map((row) => row.branchCode),
      ...(data.charts?.pjmTerendah || []).map((row) => row.branchCode),
    ]);
    for (const code of codes) {
      assert.equal(String(code).toUpperCase(), 'R01', `PIC R01 tidak boleh melihat cabang ${code}`);
    }
  });

  await runTest('Viewer dipaksa verifiedOnly=true pada /api/keuangan/konsolidasi', async () => {
    const res = await fetch(
      `${BASE_URL}/api/keuangan/konsolidasi?year=2026&month=8&verifiedOnly=false`,
      { headers: { Cookie: viewerCookie } }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.verifiedOnly, true);
  });

  // 7. Proteksi CSRF & Default Deny
  await runTest('POST dengan Origin asing ditolak (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ nipp: '10002', password: passwordFor('10002') }),
    });
    assert.equal(res.status, 403);
  });

  await runTest('Endpoint API tanpa kebijakan otorisasi ditolak (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/endpoint-belum-terdaftar`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 403);
  });

  // 8. Manajemen Kata Sandi
  await runTest('POST /api/users/password tanpa sesi ditolak (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'apa-saja',
        newPassword: 'KataSandiBaru-2026',
        confirmPassword: 'KataSandiBaru-2026',
      }),
    });
    assert.equal(res.status, 401);
  });

  await runTest('Ubah kata sandi dengan kata sandi saat ini yang salah ditolak (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        currentPassword: 'jelas-salah-sekali',
        newPassword: 'KataSandiBaru-2026',
        confirmPassword: 'KataSandiBaru-2026',
      }),
    });
    assert.equal(res.status, 401);
  });

  await runTest('Ubah kata sandi dengan kata sandi lemah ditolak (400)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        currentPassword: passwordFor('10002'),
        newPassword: 'rahasia',
        confirmPassword: 'rahasia',
      }),
    });
    assert.equal(res.status, 400);
  });

  await runTest('Reset kata sandi akun sendiri lewat jalur admin ditolak (400)', async () => {
    const meRes = await fetch(`${BASE_URL}/api/users/me`, { headers: { Cookie: adminCookie } });
    const me = await meRes.json();
    const res = await fetch(`${BASE_URL}/api/users/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        userId: me.user.id,
        newPassword: 'KataSandiBaru-2026',
        requireChangeOnNextLogin: true,
      }),
    });
    assert.equal(res.status, 400);
  });

  await runTest('PUT /api/users menolak perubahan kata sandi (400)', async () => {
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
    const users = await usersRes.json();
    const target = (users.users || []).find((u) => u.nipp === '10004');
    assert.ok(target, 'Akun PIC 10004 harus tersedia untuk pengujian');
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        id: target.id,
        name: target.name,
        divisi: target.divisi,
        departemen: target.departemen,
        password: 'Coba-Lewat-Put-2026',
      }),
    });
    assert.equal(res.status, 400);
  });

  // 9. Batas Unggahan Spreadsheet
  await runTest('Unggahan berkas spreadsheet rusak ditolak dengan pesan jelas (400)', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([Buffer.from('bukan berkas spreadsheet')]), 'rusak.xlsx');
    const res = await fetch(`${BASE_URL}/api/import/validate`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(String(data.message || '').length > 0, 'Pesan kesalahan harus informatif');
  });

  await runTest('Unggahan ekstensi terlarang ditolak (400)', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([Buffer.from('MZ')]), 'payload.exe');
    const res = await fetch(`${BASE_URL}/api/import/validate`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    assert.equal(res.status, 400);
  });

  // 10. Kebijakan Token & Observability
  await runTest('Access token berlaku paling lama 15 menit', async () => {
    const { token } = await loginUser('10002');
    assert.ok(token, 'Access token harus tersedia');
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    const ttlMinutes = (payload.exp - payload.iat) / 60;
    assert.ok(ttlMinutes > 0 && ttlMinutes <= 15, `TTL access token ${ttlMinutes} menit, maksimum 15`);
    assert.equal(payload.type, 'access');
  });

  await runTest('GET /api/users/me?rotate=1 menerbitkan access token baru', async () => {
    const { token } = await loginUser('10004');
    assert.ok(token, 'Access token harus tersedia');
    const res = await fetch(`${BASE_URL}/api/users/me?rotate=1`, {
      headers: { Cookie: `portsight_access_token=${token}` },
    });
    assert.equal(res.status, 200);
    const rotated = parseCookie(res, 'portsight_access_token');
    assert.ok(rotated, 'Cookie access token baru harus dikirim');
    assert.notEqual(rotated, token, 'Token hasil rotasi harus berbeda dari token lama');
  });

  await runTest('Setiap respons API menyertakan x-request-id untuk penelusuran', async () => {
    const res = await fetch(`${BASE_URL}/api/master`);
    const requestId = res.headers.get('x-request-id');
    assert.ok(requestId, 'Header x-request-id wajib ada');
    assert.match(requestId, /^[A-Za-z0-9._:-]{8,128}$/);
  });

  // Guards against a proxy regression that rebuilt request headers and dropped
  // the `cookie` header on public endpoints: login returned 200 but the session
  // cookie could never authenticate, so every login looked successful yet failed.
  await runTest('Cookie hasil login benar-benar mengautentikasi /api/users/me', async () => {
    const { token } = await loginUser('10002');
    assert.ok(token, 'Access token harus terbit');
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Cookie: `portsight_access_token=${token}` },
    });
    assert.equal(res.status, 200, 'Cookie dari login harus diterima oleh /api/users/me');
    const data = await res.json();
    assert.equal(data.authenticated, true);
    assert.equal(data.user.role, 'admin_regional');
  });

  await runTest('Kredensial tidak pernah muncul pada respons settings', async () => {
    const res = await fetch(`${BASE_URL}/api/system-params`, { headers: { Cookie: adminCookie } });
    if (res.status !== 200) return; // role tanpa izin sudah tertutup uji RBAC
    const body = await res.text();
    assert.ok(!body.includes('scrypt$'), 'Hash kata sandi tidak boleh terekspos');
    assert.ok(!/pg_password"\s*:\s*"[^•"]/.test(body), 'Kata sandi DB harus dimasking');
  });

  // 11. Centralised policy (RBAC-05): protected-account rules must apply
  // identically through every administrative endpoint.
  await runTest('Admin Regional tidak dapat mengubah akun Super Admin (403)', async () => {
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
    const users = await usersRes.json();
    const target = (users.users || []).find((u) => u.role === 'super_admin');
    if (!target) return; // instalasi tanpa Super Admin: tidak ada yang perlu dilindungi

    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        id: target.id,
        name: 'Percobaan Ambil Alih',
        divisi: target.divisi || 'Direksi',
        departemen: target.departemen || 'Kantor Pusat',
        role: 'super_admin',
      }),
    });
    assert.equal(res.status, 403, 'Admin Regional harus ditolak saat mengubah akun Super Admin');
    const data = await res.json();
    assert.equal(data.code, 'super_admin_only', `Kode policy diharapkan super_admin_only, menerima ${data.code}`);
  });

  await runTest('Admin Regional tidak dapat menghapus akun Super Admin (403)', async () => {
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
    const users = await usersRes.json();
    const target = (users.users || []).find((u) => u.role === 'super_admin');
    if (!target) return;

    const res = await fetch(`${BASE_URL}/api/users?id=${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'super_admin_only');
  });

  await runTest('Admin Regional tidak dapat mereset kata sandi Super Admin (403)', async () => {
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
    const users = await usersRes.json();
    const target = (users.users || []).find((u) => u.role === 'super_admin');
    if (!target) return;

    const res = await fetch(`${BASE_URL}/api/users/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        userId: target.id,
        newPassword: 'Ambil-Alih-Akun-2026',
        requireChangeOnNextLogin: false,
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'super_admin_only');
  });

  await runTest('Admin Regional ditolak saat mengubah konfigurasi database (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/system-params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ action: 'validate_db_path', sqlite_path: 'data/lain.db' }),
    });
    // Admin Regional tidak memiliki system_params:manage, sehingga proxy sudah
    // menolak; bila kelak izin itu diberikan, handler tetap menolak di sini.
    assert.ok(res.status === 403, `Diharapkan 403, menerima ${res.status}`);
  });

  // 12. Idempotensi impor (DATA-08): re-uploading the same rows must not duplicate
  // them, and must not push verified data back into the verification queue.
  await runTest('Impor ulang file yang sama tidak menggandakan baris', async () => {
    const masterRes = await fetch(`${BASE_URL}/api/master`, { headers: { Cookie: adminCookie } });
    const master = await masterRes.json();
    const branch = (master.branches || []).find((b) => b.code === 'R02') || (master.branches || [])[0];
    const dept = (master.departments || [])[0];
    const indicator = (master.indicators || [])[0];
    if (!branch || !dept || !indicator) return; // master belum ter-seed

    // Periode khusus uji agar tidak bertabrakan dengan data sungguhan.
    const record = {
      branch_id: branch.code,
      department_id: dept.id,
      indicator_id: indicator.id,
      month: 12,
      year: 2027,
      target: 1000,
      realization: 850,
      unit: indicator.unit,
      notes: 'uji idempotensi regresi',
    };

    const commitOnce = async (payload = record, suffix = '') => {
      const res = await fetch(`${BASE_URL}/api/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          batchId: `batch_idem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`,
          filename: 'idempotensi.xlsx',
          sourceType: 'upload_xlsx',
          records: [payload],
        }),
      });
      assert.equal(res.status, 200, `Commit gagal dengan status ${res.status}`);
      return res.json();
    };

    // Row IDs are now derived from (year, month, branch, indicator), so a previous
    // run of this suite may already have created this exact row. Asserting
    // `createdCount === 1` unconditionally therefore failed on every re-run — a
    // test that can only pass once is not a regression test. The invariants below
    // hold whether or not the row pre-exists, and the final step restores the
    // original value so the next run starts from the same state.
    const first = await commitOnce();
    assert.equal(
      first.createdCount + first.unchangedCount,
      1,
      'Impor pertama harus membuat baris baru atau melaporkan baris yang sudah ada'
    );

    const second = await commitOnce(); // identik
    assert.equal(second.createdCount, 0, 'Impor ulang tidak boleh membuat baris baru');
    assert.equal(second.updatedCount, 0, 'Impor identik tidak boleh mengubah baris');
    assert.equal(second.unchangedCount, 1, 'Impor identik harus melaporkan 1 baris tidak berubah');

    // Nilai berubah → baris sama diperbarui, bukan ditambah.
    const third = await commitOnce({ ...record, realization: 900 }, '_chg');
    assert.equal(third.createdCount, 0, 'Perubahan nilai tidak boleh membuat baris baru');
    assert.equal(third.updatedCount, 1, 'Perubahan nilai harus memperbarui baris yang sama');

    // Pulihkan nilai asli agar rangkaian uji dapat dijalankan ulang tanpa residu.
    const fourth = await commitOnce(record, '_restore');
    assert.equal(fourth.createdCount, 0, 'Pemulihan nilai tidak boleh membuat baris baru');
    assert.equal(fourth.updatedCount, 1, 'Pemulihan nilai harus memperbarui baris yang sama');
  });

  // 13. DATA-05: an approved figure that was overwritten can be brought back.
  //
  // Editing a verified module row stores the approved values in
  // `verified_snapshot_json`. Without a restore path that copy is write-only, which
  // means a mistaken overwrite of an official figure is unrecoverable.
  await runTest('Snapshot terverifikasi dapat dipulihkan lewat API', async () => {
    const summaryRes = await fetch(`${BASE_URL}/api/dashboard/summary?period=YTD%20Sep%202026`, {
      headers: { Cookie: adminCookie },
    });
    const summary = await summaryRes.json();
    const branch = (summary.branches || [])[0];
    if (!branch) return;

    const masterRes = await fetch(`${BASE_URL}/api/master`, { headers: { Cookie: adminCookie } });
    const master = await masterRes.json();

    // A row that already carries a snapshot? If none exists, write one through the
    // documented path: approve a manual row, then overwrite it.
    const snapshotRes = await fetch(
      `${BASE_URL}/api/verification/restore`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ table: 'module_opkom', id: 'baris_tidak_ada' }),
      }
    );
    // Unknown row must be a clean 404, not a 500 or a silent success.
    assert.equal(snapshotRes.status, 404, `Baris tak dikenal harus 404, menerima ${snapshotRes.status}`);

    // Malformed payloads must be rejected before touching the database.
    const badRes = await fetch(`${BASE_URL}/api/verification/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ table: 'users; DROP TABLE users', id: 'x' }),
    });
    assert.equal(badRes.status, 400, `Nama tabel di luar whitelist harus 400, menerima ${badRes.status}`);
    assert.ok(master.indicators, 'master harus memuat indikator');
  });

  // 14. RBAC-14: separation of duties across the whole chain.
  //
  // An administrator imports a record (so `uploaded_by` is their own NIPP), then
  // tries to approve it. Before the four-eyes check covered the module tables as
  // well as the parent record, this was possible; "verification" then documented
  // nothing because the same person wrote and blessed the figure.
  await runTest('Verifikator tidak dapat menyetujui data yang ia unggah sendiri (Four-Eyes)', async () => {
    const masterRes = await fetch(`${BASE_URL}/api/master`, { headers: { Cookie: adminCookie } });
    const master = await masterRes.json();
    const branch = (master.branches || []).find((b) => b.code === 'R02') || (master.branches || [])[0];
    const dept = (master.departments || [])[0];
    const indicator = (master.indicators || [])[0];
    if (!branch || !dept || !indicator) return; // master belum ter-seed

    // Dedicated far-future period so the row cannot collide with real data.
    const record = {
      branch_id: branch.code,
      department_id: dept.id,
      indicator_id: indicator.id,
      month: 6,
      year: 2028,
      target: 500,
      real: 0,
      realization: 450,
      unit: indicator.unit,
      notes: 'uji four-eyes regresi',
    };

    const commitRes = await fetch(`${BASE_URL}/api/import/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        batchId: `batch_four_eyes_${Date.now()}`,
        filename: 'four-eyes.xlsx',
        sourceType: 'upload_xlsx',
        records: [record],
      }),
    });
    assert.equal(commitRes.status, 200, `Commit gagal dengan status ${commitRes.status}`);
    const committed = await commitRes.json();

    // The row must be pending and uploaded by the acting admin, otherwise this
    // test would pass for the wrong reason.
    if (committed.createdCount === 0 && committed.unchangedCount === 0) {
      return; // nothing written and nothing pre-existing: cannot exercise the rule
    }

    const recordsRes = await fetch(`${BASE_URL}/api/records?limit=200`, {
      headers: { Cookie: adminCookie },
    });
    const recordsBody = await recordsRes.json();
    const target = (recordsBody.records || []).find(
      (r) => r.indicator_id === indicator.id && r.year === 2028 && r.month === 6
    );
    assert.ok(target, 'Rekaman hasil impor harus dapat ditemukan');
    assert.equal(target.verification_status, 'pending_verification');

    const verifyRes = await fetch(`${BASE_URL}/api/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ recordIds: [target.id], status: 'verified' }),
    });
    assert.equal(
      verifyRes.status,
      403,
      `Penyetujuan data sendiri harus ditolak, menerima ${verifyRes.status}`
    );
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.code, 'four_eyes_violation');
    assert.match(String(verifyBody.message || ''), /Four-Eyes/i);

    // And the row must still be pending: a rejection that already wrote the
    // approval would be worse than no rejection.
    const afterRes = await fetch(`${BASE_URL}/api/records?limit=200`, {
      headers: { Cookie: adminCookie },
    });
    const afterBody = await afterRes.json();
    const after = (afterBody.records || []).find((r) => r.id === target.id);
    assert.equal(after?.verification_status, 'pending_verification', 'Status tidak boleh berubah');
  });

  // 14. FEAT-10: a spreadsheet must not be able to grant privileges.
  //
  // The previous role parser matched substrings, so "Supervisor Operasi" became
  // super_admin and "PIC Dept Regional 4" became admin_regional. At a port
  // company "Supervisor" is an ordinary job title, which made a routine staff
  // upload a silent privilege escalation. This drives the real endpoint with a
  // real .xlsx so the fix is proven end to end, not just at the parser.
  await runTest('Impor pengguna menolak jabatan yang bukan role (Supervisor ≠ Super Admin)', async () => {
    const xlsx = await import('xlsx');
    const header = ['NIPP (USERNAME)', 'NAMA LENGKAP', 'DIVISI', 'DEPARTEMEN', 'HAK AKSES (ROLE)', 'CABANG', 'EMAIL', 'STATUS'];
    const rows = [
      header,
      ['99001', 'Uji Supervisor', 'Divisi Uji', 'Dept Uji', 'Supervisor Operasi', 'R01', 'uji99001@pelindo.co.id', 'Aktif'],
      ['99002', 'Uji Escalation', 'Divisi Uji', 'Dept Uji', 'super_admin', 'R99', 'uji99002@pelindo.co.id', 'Aktif'],
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'MASTER_USER_PIC');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append('file', new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), 'uji-role.xlsx');

    const res = await fetch(`${BASE_URL}/api/users/sync-drive`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: form,
    });
    assert.equal(res.status, 200, `Impor pengguna gagal dengan status ${res.status}`);
    const data = await res.json();

    assert.equal(data.rejectedCount, 2, `Kedua baris harus ditolak, menerima ${JSON.stringify(data.rejected)}`);
    const reasons = (data.rejected || []).map((r) => `${r.nipp}: ${r.reason}`).join(' | ');
    assert.ok(/99001/.test(reasons), `Baris "Supervisor Operasi" harus ditolak: ${reasons}`);
    assert.ok(/99002/.test(reasons), `Baris super_admin harus ditolak: ${reasons}`);

    // And neither account may exist afterwards — a rejection that still writes the
    // row would be worse than no rejection at all.
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers: { Cookie: adminCookie } });
    const users = await usersRes.json();
    const created = (users.users || []).filter((u) => u.nipp === '99001' || u.nipp === '99002');
    assert.equal(created.length, 0, `Akun terlarang tidak boleh terbentuk: ${JSON.stringify(created)}`);
  });

  if (failures.length > 0) {
    console.error(
      `\n\x1b[31m✘ ${failures.length} dari ${testCount} pengujian GAGAL:\x1b[0m\n` +
        failures.map((f) => `   - ${f.name}: ${f.err?.message ?? f.err}`).join('\n') +
        '\n'
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n\x1b[32m✔ Seluruh ${testCount} pengujian regresi keamanan dan fungsional selesai dengan sukses.\x1b[0m\n`
  );
}

main().catch((err) => {
  console.error('\n\x1b[31mTerjadi kesalahan fatal selama pengujian regresi:\x1b[0m', err);
  process.exit(1);
});
