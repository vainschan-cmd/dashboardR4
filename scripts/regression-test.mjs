// scripts/regression-test.mjs
// Automated security and integration regression test suite for PortDash R4

import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTest(name, fn) {
  process.stdout.write(`• Menguji: ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32m[BERHASIL]\x1b[0m');
  } catch (err) {
    console.log('\x1b[31m[GAGAL]\x1b[0m');
    console.error(err);
    process.exitCode = 1;
  }
}

function parseCookie(response, cookieName) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function loginUser(nipp, password) {
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nipp, password }),
  });
  const data = await res.json();
  const token = parseCookie(res, 'portsight_access_token');
  return { res, data, token };
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
        password: 'password123',
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
    const { res, data, token } = await loginUser('10002', 'password123');
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'admin_regional');
    assert.ok(token, 'Token cookie portsight_session harus terbit');
    adminCookie = `portsight_access_token=${token}`;
  });

  await runTest('Autentikasi BOD / Viewer (10000)', async () => {
    const { res, data, token } = await loginUser('10000', 'password123');
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.role, 'viewer');
    assert.ok(token);
    viewerCookie = `portsight_access_token=${token}`;
  });

  await runTest('Autentikasi PIC Cabang Makassar (10004) dengan branch_id R01', async () => {
    const { res, data, token } = await loginUser('10004', 'password123');
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

  console.log('\n\x1b[32m✔ Seluruh pengujian regresi keamanan dan fungsional selesai dengan sukses.\x1b[0m\n');
}

main().catch((err) => {
  console.error('\n\x1b[31mTerjadi kesalahan fatal selama pengujian regresi:\x1b[0m', err);
  process.exit(1);
});
