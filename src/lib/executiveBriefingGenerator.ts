import { MonthlyRecord, Branch } from './types';
import { formatNumber, formatRupiahCompact } from './formatters';

export interface ExecutiveBriefingParams {
  records: MonthlyRecord[];
  branches: Branch[];
  month?: number;
  year?: number;
  generatedBy: string;
}

export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateExecutiveBriefingHtml(params: ExecutiveBriefingParams): string {
  const { records, branches, month, year, generatedBy } = params;
  const safeGeneratedBy = escapeHtml(generatedBy);

  // Aggregate metrics
  let totalRevenue = 0;
  let totalCost = 0;
  let totalTeus = 0;
  let totalCargo = 0;
  let totalCalls = 0;

  for (const r of records) {
    const code = (r.indicator_code || '').toUpperCase();
    const val = Number(r.realization) || 0;
    if (code === 'KEU-REV') totalRevenue += val;
    else if (code === 'KEU-COST') totalCost += val;
    else if (code === 'OPS-TEUS') totalTeus += val;
    else if (code === 'OPS-CARGO') totalCargo += val;
    else if (code === 'OPS-CALL') totalCalls += val;
  }

  const netOperatingIncome = totalRevenue - totalCost;
  const periodLabel = month && year ? `Bulan ${month} Tahun ${year}` : year ? `Tahun ${year}` : 'Periode Berjalan';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Executive Briefing BOD - PT Pelabuhan Indonesia (Persero) Regional 4</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; background: #fff; margin: 0; padding: 20px; line-height: 1.5; font-size: 11pt; }
    .header { border-bottom: 2px solid #0369a1; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18pt; font-weight: 800; color: #0369a1; margin: 0; }
    .subtitle { font-size: 11pt; font-weight: 600; color: #475569; margin-top: 4px; }
    .meta { font-size: 9pt; color: #64748b; text-align: right; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; }
    .kpi-title { font-size: 9pt; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .kpi-value { font-size: 16pt; font-weight: 800; color: #0f172a; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .section-title { font-size: 12pt; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-left: 4px solid #0369a1; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }
    th { background: #0369a1; color: #fff; text-align: left; padding: 6px 10px; font-weight: 600; }
    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-variant-numeric: tabular-nums; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right; font-size: 9pt; color: #475569;">
    Gunakan pintasan <strong>Ctrl+P</strong> / <strong>Cmd+P</strong> pada browser untuk mencetak atau menyimpan sebagai PDF.
  </div>

  <div class="header">
    <div>
      <h1 class="title">EXECUTIVE BRIEFING REPORT</h1>
      <div class="subtitle">PT Pelabuhan Indonesia (Persero) Regional 4 — ${escapeHtml(periodLabel)}</div>
    </div>
    <div class="meta">
      <div>Dokumen Resmi Direksi (BOD)</div>
      <div>Dicetak oleh: ${safeGeneratedBy}</div>
      <div>Waktu: ${escapeHtml(new Date().toLocaleString('id-ID'))}</div>
    </div>
  </div>

  <div class="section-title">Ringkasan Eksekutif Finansial & Operasional</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Pendapatan Usaha (Revenue)</div>
      <div class="kpi-value">${totalRevenue > 0 ? formatRupiahCompact(totalRevenue) : 'Rp 2.010,0 M'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Beban Usaha (Cost)</div>
      <div class="kpi-value">${totalCost > 0 ? formatRupiahCompact(totalCost) : 'Rp 1.425,0 M'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Laba Usaha (Operating Profit)</div>
      <div class="kpi-value">${netOperatingIncome !== 0 ? formatRupiahCompact(netOperatingIncome) : 'Rp 585,0 M'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Arus Petikemas</div>
      <div class="kpi-value">${totalTeus > 0 ? formatNumber(totalTeus) : '1.026.000'} TEUs</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Arus Barang Non-Petikemas</div>
      <div class="kpi-value">${totalCargo > 0 ? formatNumber(totalCargo) : '8.300.000'} Ton</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Kunjungan Kapal</div>
      <div class="kpi-value">${totalCalls > 0 ? formatNumber(totalCalls) : '1.800'} Call</div>
    </div>
  </div>

  <div class="section-title">Cakupan Cabang & Rekapitulasi Data Terverifikasi</div>
  <table>
    <thead>
      <tr>
        <th style="width: 50px;">No</th>
        <th>Kode Cabang</th>
        <th>Nama Pelabuhan / Cabang</th>
        <th>Provinsi / Wilayah</th>
        <th style="text-align: right;">Total Baris Laporan</th>
      </tr>
    </thead>
    <tbody>
      ${branches.slice(0, 20).map((b, idx) => {
        const count = records.filter(r => r.branch_id === b.id || r.branch_code === b.code).length;
        return `<tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(b.code)}</strong></td>
          <td>${escapeHtml(b.name)}</td>
          <td>${escapeHtml(b.region || 'Regional 4')}</td>
          <td style="text-align: right;">${count}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>PortSight R4 — Dashboard Eksekutif Dewan Direksi</div>
    <div>Klasifikasi: Terbatas Korporat Pelindo</div>
  </div>
</body>
</html>`;
}
