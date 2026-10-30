import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { OFFICIAL_BRANCHES } from '@/lib/constants';


function cleanKey(k: string): string {
  return k.trim().toLowerCase();
}

function getVal(row: any, name: string): any {
  if (!row) return undefined;
  if (row[name] !== undefined) return row[name];
  const target = name.trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === target) {
      return row[k];
    }
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchCode = searchParams.get('branchCode') || searchParams.get('terminal') || undefined;

    const excelPath = path.join(process.cwd(), 'data', 'input_data.xlsx');
    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ success: false, error: 'File input_data.xlsx tidak ditemukan' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(excelPath);
    const wb = xlsx.read(fileBuffer, { type: 'buffer' });

    // 1. Finansial
    const rawFin: any[] = wb.Sheets['finansial'] ? xlsx.utils.sheet_to_json(wb.Sheets['finansial']) : [];
    const finansial = rawFin.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      const konsolidasi = Number(getVal(r, 'KONSOLIDASI') || 0);
      const cabang = Number(getVal(r, 'CABANG') || 0);
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        rekening: String(getVal(r, 'REKENING') || '').trim(),
        cabangRp: cabang,
        cabangM: Number((cabang / 1_000_000_000).toFixed(2)),
        pmtRp: Number(getVal(r, 'PMT') || 0),
        ptpRp: Number(getVal(r, 'PTP') || 0),
        pslRp: Number(getVal(r, 'PSL') || 0),
        pjmRp: Number(getVal(r, 'PJM') || 0),
        eliminasiRp: Number(getVal(r, 'ELIMINASI') || 0),
        konsolidasiRp: konsolidasi,
        konsolidasiM: Number((konsolidasi / 1_000_000_000).toFixed(2)),
        yoy: Number(Number(getVal(r, 'YOY') || 0).toFixed(1)),
        rka: Number(Number(getVal(r, 'RKA') || 0).toFixed(1)),
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 2. Opkom (Operasi & Komersial)
    const rawOpkom: any[] = wb.Sheets['opkom'] ? xlsx.utils.sheet_to_json(wb.Sheets['opkom']) : [];
    const opkom = rawOpkom.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      const jumlahRp = Number(getVal(r, 'JUMLAH') || 0);
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        layanan: String(getVal(r, 'LAYANAN') || '').trim().toUpperCase(),
        satuan: String(getVal(r, 'SATUAN') || 'Rp').trim(),
        jumlahRp,
        jumlahM: Number((jumlahRp / 1_000_000_000).toFixed(2)),
        yoy: Number(Number(getVal(r, 'YOY') || 0).toFixed(1)),
        rka: Number(Number(getVal(r, 'RKA') || 0).toFixed(1)),
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 3. Kinerja
    const rawKin: any[] = wb.Sheets['kinerja'] ? xlsx.utils.sheet_to_json(wb.Sheets['kinerja']) : [];
    const kinerja = rawKin.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        kdKine: String(getVal(r, 'KD_KINE') || '').trim(),
        nmKine: String(getVal(r, 'NM_KINE') || '').trim().toUpperCase(),
        satuan: String(getVal(r, 'SATUAN') || '').trim(),
        nilai: Number(getVal(r, 'NILAI') || 0),
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 4. Utilisasi
    const rawUtil: any[] = wb.Sheets['utilisasi'] ? xlsx.utils.sheet_to_json(wb.Sheets['utilisasi']) : [];
    const utilisasi = rawUtil.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        dermaga: String(getVal(r, 'DERMAGA') || 'MULTIPURPOSE').trim(),
        bor: Number(getVal(r, 'BOR') || 0),
        yor: Number(getVal(r, 'YOR') || 0),
        sor: Number(getVal(r, 'SOR') || 0),
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 5. Peralatan
    const rawAlat: any[] = wb.Sheets['peralatan'] ? xlsx.utils.sheet_to_json(wb.Sheets['peralatan']) : [];
    const peralatan = rawAlat.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        kdAlat: String(getVal(r, 'KD_ALAT') || '').trim(),
        nmAlat: String(getVal(r, 'NM_ALAT') || '').trim(),
        singkatan: String(getVal(r, 'SINGKATAN_ALAT') || '').trim(),
        jnsAlat: String(getVal(r, 'JNS_ALAT') || '').trim(),
        jumlah: Number(getVal(r, 'JUMLAH') || 0),
        availability: Number(getVal(r, 'AVAILABILITY') || 0),
        utilisasi: Number(getVal(r, 'UTILISASI') || 0),
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 6. Fasilitas
    const rawFas: any[] = (wb.Sheets['fasilitas (2)'] || wb.Sheets['fasilitas'])
      ? xlsx.utils.sheet_to_json(wb.Sheets['fasilitas (2)'] || wb.Sheets['fasilitas'])
      : [];
    const fasilitas = rawFas.map(r => {
      const code = String(getVal(r, 'KODE_CBG') || '').trim().toUpperCase();
      return {
        year: Number(getVal(r, 'TAHUN') || 2026),
        month: Number(getVal(r, 'BULAN') || 9),
        branchCode: code,
        branchName: String(getVal(r, 'NM_CBG') || '').trim(),
        namaFasilitas: String(getVal(r, 'nm_pasfel') || getVal(r, 'nm_faspel') || 'Fasilitas').trim(),
        jenisFasilitas: String(getVal(r, 'jns_faspel') || '').trim(),
        panjangM: Number(getVal(r, 'panjang') || 0),
        lebarM: Number(getVal(r, 'lebar') || 0),
        mLws: Number(getVal(r, 'mLws') || 0),
        luasSqm: Number(getVal(r, 'luas') || 0),
        kapasitas: getVal(r, 'kapasitas') ? String(getVal(r, 'kapasitas')).trim() : null,
        keterangan: getVal(r, 'ket') ? String(getVal(r, 'ket')).trim() : '',
      };
    }).filter(r => !branchCode || branchCode === 'ALL' || r.branchCode === branchCode);

    // 7. Equipment Catalog from master
    const masterSheet = wb.Sheets['master'];
    const masterRows: any[][] = masterSheet ? xlsx.utils.sheet_to_json(masterSheet, { header: 1 }) : [];
    const equipmentCatalog: any[] = [];
    for (let i = 1; i <= 25; i++) {
      const row = masterRows[i];
      if (row && row[8] && row[9]) {
        equipmentCatalog.push({
          code: String(row[8]).trim(),
          name: String(row[9]).trim(),
          acronym: String(row[10] || '').trim(),
          category: String(row[11] || 'OPERASIONAL').trim()
        });
      }
    }

    return NextResponse.json({
      success: true,
      branches: OFFICIAL_BRANCHES,
      finansial,
      opkom,
      kinerja,
      utilisasi,
      peralatan,
      fasilitas,
      equipmentCatalog
    });
  } catch (error: any) {
    console.error('Error in /api/modules-data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
