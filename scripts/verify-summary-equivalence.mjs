#!/usr/bin/env node
/**
 * scripts/verify-summary-equivalence.mjs
 *
 * Proves that `/api/dashboard/summary` returns the same numbers the Beranda used
 * to compute in the browser.
 *
 * Why this exists: PERF-03 replaced client-side aggregation with SQL `GROUP BY`.
 * A payload-size win is worthless if a revenue figure shifts by one rupiah — the
 * numbers on this page feed executive decisions, and a previous audit round
 * (DATA-01) already caught fabricated figures. This script recomputes every
 * branch using the ORIGINAL client algorithm against the raw rows and diffs it
 * against the aggregated endpoint.
 *
 * Usage:
 *   node scripts/verify-summary-equivalence.mjs
 *   TEST_PERIOD="YTD Sep 2026" node scripts/verify-summary-equivalence.mjs
 *
 * Exit code 1 on any mismatch.
 */

import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const PERIOD = process.env.TEST_PERIOD || 'YTD Sep 2026';

function parseCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const jar = {};
  for (const cookie of raw) {
    const [pair] = cookie.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  return jar;
}

async function login(nipp, password) {
  // The credential-free path only works when a bootstrap password is provided.
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nipp, password }),
  });
  assert.equal(res.status, 200, `Login ${nipp} gagal (${res.status})`);
  const jar = parseCookies(res);
  return `portsight_access_token=${jar.portsight_access_token}`;
}

/** Exact reproduction of the old client-side aggregation for one branch. */
function legacyBranchMetrics(code, { finansial, opkom, peralatan, utilisasi, kpiRecords }) {
  const bOp = opkom.filter((o) => o.branchCode === code);
  const bFin = finansial.filter((f) => f.branchCode === code);
  const bAlat = peralatan.filter((p) => p.branchCode === code);
  const bUtil = utilisasi.filter((u) => u.branchCode === code);
  // The KPI rows arrive camelCase (`indicatorId`), matching the hook after the
  // field-name fix; snake_case here would silently disable the RFU fallback.
  const bKpi = kpiRecords.filter((r) => r.branchCode === code);

  const revRows = bFin.filter((f) => (f.rekening || '').toLowerCase().includes('pendapatan'));
  const opRpRows = bOp.filter((o) => o.satuan === 'Rp');
  const revenueTotal =
    revRows.length > 0
      ? revRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0)
      : opRpRows.length > 0
        ? opRpRows.reduce((a, b) => a + (b.jumlahRp || 0), 0)
        : null;

  const profitRows = bFin.filter((f) => (f.rekening || '').toLowerCase() === 'laba usaha');
  const operatingProfitTotal =
    profitRows.length > 0 ? profitRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0) : null;

  const teusRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TEUS'));
  const teusTotal = teusRows.length > 0 ? teusRows.reduce((a, b) => a + (b.jumlahRp || 0), 0) : null;

  const tonRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TON'));
  const tonTotal = tonRows.length > 0 ? tonRows.reduce((a, b) => a + (b.jumlahRp || 0), 0) : null;

  const avgRka =
    bOp.length > 0
      ? Number((bOp.reduce((a, b) => a + (b.rka || 0), 0) / bOp.length).toFixed(1))
      : revRows.length > 0
        ? Number((revRows.reduce((a, b) => a + (b.rka || 0), 0) / revRows.length).toFixed(1))
        : null;
  const avgYoy =
    bOp.length > 0
      ? Number((bOp.reduce((a, b) => a + (b.yoy || 0), 0) / bOp.length).toFixed(1))
      : revRows.length > 0
        ? Number((revRows.reduce((a, b) => a + (b.yoy || 0), 0) / revRows.length).toFixed(1))
        : null;

  const validAlat = bAlat.filter((p) => (p.availability || 0) > 0);
  const rfuRows = bKpi.filter((r) => r.indicatorId === 'kpi_rfu');
  const rfu =
    validAlat.length > 0
      ? (validAlat.reduce((a, b) => a + (b.availability || 0), 0) / validAlat.length).toFixed(1)
      : rfuRows.length > 0
        ? (rfuRows.reduce((a, b) => a + (b.realization || 0), 0) / rfuRows.length).toFixed(1)
        : null;

  const bor = bUtil.length > 0 ? (bUtil[0].bor ?? 0) : null;

  return { code, revenueTotal, operatingProfitTotal, teusTotal, tonTotal, avgRka, avgYoy, rfu, bor };
}

function nearlyEqual(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a === 'string' || typeof b === 'string') return String(a) === String(b);
  // Money is stored as REAL; compare with a tolerance far below one rupiah.
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

async function main() {
  const viewerPassword = process.env.TEST_VIEWER_PASSWORD || process.env.TEST_PIC_PASSWORD;
  if (!viewerPassword) {
    console.error(
      'TEST_VIEWER_PASSWORD (atau TEST_PIC_PASSWORD) wajib diatur untuk uji ekuivalensi.'
    );
    process.exit(1);
  }
  const viewerNipp = process.env.TEST_VIEWER_NIPP || '10000';

  const cookie = await login(viewerNipp, viewerPassword);
  const headers = { Cookie: cookie };

  console.log(`\n=== Ekuivalensi agregasi Beranda (${BASE_URL}, periode "${PERIOD}") ===\n`);

  const rawRes = await fetch(
    `${BASE_URL}/api/modules-data?period=${encodeURIComponent(PERIOD)}&verifiedOnly=true`,
    { headers }
  );
  assert.equal(rawRes.status, 200, `modules-data gagal (${rawRes.status})`);
  const raw = await rawRes.json();

  const summaryRes = await fetch(
    `${BASE_URL}/api/dashboard/summary?period=${encodeURIComponent(PERIOD)}&verifiedOnly=true`,
    { headers }
  );
  assert.equal(summaryRes.status, 200, `dashboard/summary gagal (${summaryRes.status})`);
  const summary = await summaryRes.json();

  assert.equal(summary.success, true, 'Endpoint ringkasan harus sukses');
  assert.ok(Array.isArray(summary.branches), 'branches harus berupa array');
  assert.ok(summary.branches.length > 0, 'Ringkasan harus memuat setidaknya satu cabang');

  console.log(`Cabang diperiksa: ${summary.branches.length}`);
  console.log(`Ukuran payload mentah : ${(JSON.stringify(raw).length / 1024).toFixed(0)} KB`);
  console.log(`Ukuran payload ringkas: ${(JSON.stringify(summary).length / 1024).toFixed(1)} KB\n`);

  const fields = [
    'revenueTotal',
    'operatingProfitTotal',
    'teusTotal',
    'tonTotal',
    'avgRka',
    'avgYoy',
    'rfu',
    'bor',
  ];

  let mismatches = 0;
  for (const branch of summary.branches) {
    const legacy = legacyBranchMetrics(branch.code, {
      finansial: raw.finansial || [],
      opkom: raw.opkom || [],
      peralatan: raw.peralatan || [],
      utilisasi: raw.utilisasi || [],
      kpiRecords: raw.kpiRecords || [],
    });

    const diffs = fields.filter((field) => !nearlyEqual(branch[field] ?? null, legacy[field] ?? null));
    if (diffs.length > 0) {
      mismatches += 1;
      console.log(`✗ ${branch.code} ${branch.name}: ${diffs.length} kolom berbeda`);
      for (const field of diffs) {
        console.log(`    ${field.padEnd(22)} ringkas=${JSON.stringify(branch[field])}  lama=${JSON.stringify(legacy[field])}`);
      }
    }
  }

  if (mismatches > 0) {
    console.error(`\n${mismatches} cabang berbeda dari perhitungan lama. Perbaiki sebelum memakai endpoint ini.`);
    process.exit(1);
  }

  // Headline totals must equal the sum of the per-branch numbers.
  const sumOrNull = (values) => {
    const present = values.filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)));
    return present.length === 0 ? null : present.reduce((a, b) => a + Number(b), 0);
  };
  const expectedTotals = {
    revenueTotal: sumOrNull(summary.branches.map((b) => b.revenueTotal)),
    operatingProfitTotal: sumOrNull(summary.branches.map((b) => b.operatingProfitTotal)),
    teusTotal: sumOrNull(summary.branches.map((b) => b.teusTotal)),
    tonTotal: sumOrNull(summary.branches.map((b) => b.tonTotal)),
  };
  for (const [key, expected] of Object.entries(expectedTotals)) {
    assert.ok(
      nearlyEqual(summary.totals[key] ?? null, expected ?? null),
      `Total ${key} tidak konsisten: ${summary.totals[key]} vs ${expected}`
    );
  }

  console.log('✓ Seluruh cabang identik dengan perhitungan lama.');
  console.log('✓ Total konsolidasi konsisten dengan penjumlahan per cabang.\n');
}

main().catch((error) => {
  console.error('\nUji ekuivalensi gagal:', error.message);
  process.exit(1);
});
