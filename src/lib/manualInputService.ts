import fs from 'fs';
import path from 'path';
import os from 'os';
import * as xlsx from 'xlsx';
import { OFFICIAL_BRANCHES, getBranchByCode } from './constants';
import { ingestInputData } from './ingestInputData';
import { dbQueries } from './db';

export type ModuleType = 'finansial' | 'opkom' | 'kinerja' | 'utilisasi' | 'peralatan' | 'fasilitas';

export interface ManualInputPayload {
  module: ModuleType;
  user?: {
    id: string;
    name: string;
    role: string;
  };
  data: Record<string, any>;
}

export function getInputDataSpreadsheetPath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'input_data.xlsx');
}

export function saveManualInputRecord(payload: ManualInputPayload): {
  success: boolean;
  message: string;
  isUpdate: boolean;
  record: any;
} {
  const { module, data, user } = payload;
  const excelPath = getInputDataSpreadsheetPath();

  if (!fs.existsSync(excelPath)) {
    throw new Error('File input_data.xlsx tidak ditemukan di folder data.');
  }

  const fileBuffer = fs.readFileSync(excelPath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });

  // Resolve branch and period
  const branchCode = String(data.KODE_CBG || data.branchCode || 'R01').trim().toUpperCase();
  const branchObj = getBranchByCode(branchCode);
  const branchName = data.NM_CBG || data.branchName ? String(data.NM_CBG || data.branchName).trim() : (branchObj ? branchObj.name : branchCode);

  const year = Number(data.TAHUN ?? data.year) || new Date().getFullYear();
  const month = Number(data.BULAN ?? data.month) || (new Date().getMonth() + 1);

  let sheetName = module;
  if (module === 'fasilitas' && wb.Sheets['fasilitas (2)']) {
    sheetName = 'fasilitas (2)' as any;
  }

  let ws = wb.Sheets[sheetName];
  if (!ws) {
    ws = xlsx.utils.json_to_sheet([]);
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  }

  const existingRows: any[] = xlsx.utils.sheet_to_json(ws);
  let isUpdate = false;
  let formattedRecord: any = {};

  if (module === 'finansial') {
    const rekening = String(data.REKENING ?? data.rekening ?? 'Pendapatan').trim();
    const cabang = Number(data.CABANG ?? data.cabang) || 0;
    const pmt = Number(data.PMT ?? data.pmt) || 0;
    const ptp = Number(data.PTP ?? data.ptp) || 0;
    const psl = Number(data.PSL ?? data.psl) || 0;
    const pjm = Number(data.PJM ?? data.pjm) || 0;
    const eliminasi = Number(data.ELIMINASI ?? data.eliminasi) || 0;
    const konsolidasiVal = data.KONSOLIDASI ?? data.konsolidasi;
    const konsolidasi = (konsolidasiVal !== undefined && konsolidasiVal !== null && konsolidasiVal !== '')
      ? Number(konsolidasiVal)
      : (cabang + pmt + ptp + psl + pjm + eliminasi);
    const yoy = Number(data.YOY ?? data.yoy) || 100;
    const rka = Number(data.RKA ?? data.rka) || 100;

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      REKENING: rekening,
      CABANG: cabang,
      PMT: pmt,
      PTP: ptp,
      PSL: psl,
      PJM: pjm,
      ELIMINASI: eliminasi,
      KONSOLIDASI: konsolidasi,
      YOY: yoy,
      RKA: rka,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      String(r.REKENING || '').trim().toLowerCase() === rekening.toLowerCase()
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  } else if (module === 'opkom') {
    const layanan = String(data.LAYANAN ?? data.layanan ?? 'KAPAL').trim().toUpperCase();
    const satuan = String(data.SATUAN ?? data.satuan ?? 'Rp').trim();
    const jumlah = Number(data.JUMLAH ?? data.jumlah) || 0;
    const yoy = Number(data.YOY ?? data.yoy) || 100;
    const rka = Number(data.RKA ?? data.rka) || 100;

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      LAYANAN: layanan,
      SATUAN: satuan,
      ' JUMLAH ': jumlah,
      ' YOY ': yoy,
      ' RKA ': rka,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      String(r.LAYANAN || '').trim().toUpperCase() === layanan
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  } else if (module === 'kinerja') {
    const kdKine = String(data.KD_KINE ?? data.kdKine ?? 'K01').trim().toUpperCase();
    const nmKine = String(data.NM_KINE ?? data.nmKine ?? 'KAPAL').trim().toUpperCase();
    const satuan = String(data.SATUAN ?? data.satuan ?? 'WTP').trim();
    const nilai = Number(data.NILAI ?? data.nilai) || 0;

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_KINE: kdKine,
      NM_KINE: nmKine,
      SATUAN: satuan,
      NILAI: nilai,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      (String(r.KD_KINE || '').trim().toUpperCase() === kdKine || String(r.NM_KINE || '').trim().toUpperCase() === nmKine)
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  } else if (module === 'utilisasi') {
    const kdJenderm = data.KD_JENDERM ?? data.kdJenderm ?? 1;
    const dermaga = String(data.DERMAGA ?? data.dermaga ?? 'MULTIPURPOSE').trim().toUpperCase();
    const bor = Number(data.BOR ?? data.bor) || 0;
    const yor = Number(data.YOR ?? data.yor) || 0;
    const sor = Number(data.SOR ?? data.sor) || 0;

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_JENDERM: kdJenderm,
      DERMAGA: dermaga,
      BOR: bor,
      YOR: yor,
      SOR: sor,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      String(r.DERMAGA || '').trim().toUpperCase() === dermaga
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  } else if (module === 'peralatan') {
    const kdAlat = String(data.KD_ALAT ?? data.kdAlat ?? 'AL01').trim().toUpperCase();
    const nmAlat = String(data.NM_ALAT ?? data.nmAlat ?? 'Quay Container Crane').trim();
    const singkatan = String(data.SINGKATAN_ALAT ?? data.singkatan ?? 'QCC').trim().toUpperCase();
    const jnsAlat = String(data.JNS_ALAT ?? data.jnsAlat ?? 'OPERASI KAPAL').trim().toUpperCase();
    const jumlah = Number(data.JUMLAH ?? data.jumlah) || 0;
    const utilisasi = Number(data.UTILISASI ?? data.utilisasi) || 0;

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      KD_ALAT: kdAlat,
      NM_ALAT: nmAlat,
      SINGKATAN_ALAT: singkatan,
      JNS_ALAT: jnsAlat,
      ' JUMLAH ': jumlah,
      ' UTILISASI ': utilisasi,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      (String(r.KD_ALAT || '').trim().toUpperCase() === kdAlat || String(r.NM_ALAT || '').trim().toLowerCase() === nmAlat.toLowerCase())
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  } else if (module === 'fasilitas') {
    const nmPasfel = String(data.nm_pasfel || data.namaFasilitas || 'Dermaga').trim();
    const jnsFaspel = String(data.jns_faspel || data.jenisFasilitas || 'Dermaga').trim();
    const satuan = String(data.satuan || 'meter').trim();
    const panjang = Number(data.panjang || data.panjangM) || 0;
    const lebar = Number(data.lebar || data.lebarM) || 0;
    const mLws = Number(data.mLws) || 0;
    const nilai = Number(data.nilai || data.luas || data.luasSqm) || (panjang * lebar);
    const ket = String(data.ket || data.keterangan || '').trim();

    formattedRecord = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
      nm_pasfel: nmPasfel,
      jns_faspel: jnsFaspel,
      satuan: satuan,
      ' panjang ': panjang,
      ' lebar ': lebar,
      ' mLws ': mLws,
      nilai: nilai,
      ket: ket,
    };

    const idx = existingRows.findIndex(r =>
      Number(r.TAHUN) === year &&
      Number(r.BULAN) === month &&
      String(r.KODE_CBG || '').trim().toUpperCase() === branchCode &&
      String(r.nm_pasfel || '').trim().toLowerCase() === nmPasfel.toLowerCase()
    );

    if (idx >= 0) {
      existingRows[idx] = { ...existingRows[idx], ...formattedRecord };
      isUpdate = true;
    } else {
      existingRows.push(formattedRecord);
    }
  }

  // Write sheet back
  wb.Sheets[sheetName] = xlsx.utils.json_to_sheet(existingRows);
  const updatedBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(excelPath, updatedBuf);

  // Sync to Downloads folder if exists
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'input_data.xlsx');
    if (fs.existsSync(downloadsPath)) {
      fs.writeFileSync(downloadsPath, updatedBuf);
    }
  } catch {}

  // Sync SQLite DB
  try {
    ingestInputData(excelPath);
  } catch (e) {
    console.error('[ManualInput] Error re-ingesting into SQLite:', e);
  }

  // Audit log
  try {
    dbQueries.createAuditLog({
      user_id: user?.id || 'manual_user',
      user_name: user?.name || 'PIC Input Manual',
      user_role: user?.role || 'pic',
      action: isUpdate ? 'UPDATE_MANUAL_DATA' : 'CREATE_MANUAL_DATA',
      entity: `module_${module}`,
      entity_id: `${branchCode}_${year}_${month}`,
      details: `Input manual modul ${module} untuk ${branchName} (${branchCode}), periode ${month}/${year}.`,
    });
  } catch {}

  return {
    success: true,
    isUpdate,
    message: isUpdate
      ? `Data ${module.toUpperCase()} untuk ${branchName} (${month}/${year}) berhasil diperbarui di spreadsheet dan database!`
      : `Data ${module.toUpperCase()} baru untuk ${branchName} (${month}/${year}) berhasil ditambahkan ke spreadsheet dan database!`,
    record: formattedRecord,
  };
}
