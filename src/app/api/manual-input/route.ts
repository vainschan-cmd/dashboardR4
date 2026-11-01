import { NextRequest, NextResponse } from 'next/server';
import { saveManualInputRecord, ModuleType } from '@/lib/manualInputService';
import { OFFICIAL_BRANCHES } from '@/lib/constants';

const MODULE_OPTIONS = {
  finansial: {
    rekening: ['Pendapatan', 'Beban', 'Laba Usaha', 'Laba Bersih', 'EBITDA'],
  },
  opkom: {
    layanan: ['KAPAL', 'PETIKEMAS', 'BARANG', 'PENUMPANG', 'RUPA-RUPA'],
    satuan: ['Rp', 'GT', 'TEUS', 'TON/M3', 'ORANG', 'BOX', 'CALL'],
  },
  kinerja: {
    namaKinerja: ['KAPAL', 'PETIKEMAS', 'GENERAL CARGO', 'CURAH KERING', 'CURAH CAIR'],
    satuan: ['WTP', 'ET:BT', 'BSH', 'BCH', 'TGH', 'TSD'],
    defaultCodes: {
      'KAPAL': 'K01',
      'GENERAL CARGO': 'K02',
      'CURAH KERING': 'K03',
      'CURAH CAIR': 'K04',
      'PETIKEMAS': 'K05',
    } as Record<string, string>,
  },
  utilisasi: {
    dermaga: ['MULTIPURPOSE', 'PETIKEMAS', 'MULTIPURPOSE PRE', 'MULTIPURPOSE GRK', 'CURAH KERING', 'CURAH CAIR', 'KONVENSIONAL'],
  },
  peralatan: {
    jenisAlat: ['OPERASI KAPAL', 'OPERASI LAPANGAN', 'ALAT APUNG', 'ALAT BANTU'],
    katalogAlat: [
      { kd: 'AL01', nm: 'Quay Container Crane', singkt: 'QCC', jns: 'OPERASI KAPAL' },
      { kd: 'AL02', nm: 'Harbour Mobile Crane', singkt: 'HMC', jns: 'OPERASI KAPAL' },
      { kd: 'AL03', nm: 'Fixed Crane', singkt: 'FC', jns: 'OPERASI KAPAL' },
      { kd: 'AL04', nm: 'Rubber Tyred Gantry Crane', singkt: 'RTG', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL05', nm: 'Reach Stacker', singkt: 'RS', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL06', nm: 'Side Loader', singkt: 'SL', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL07', nm: 'Top Loader', singkt: 'TL', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL08', nm: 'Head Truck', singkt: 'HT', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL09', nm: 'Terminal Tractor', singkt: 'TT', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL10', nm: 'Chassis', singkt: 'CH', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL11', nm: 'Forklift', singkt: 'FL', jns: 'OPERASI LAPANGAN' },
      { kd: 'AL12', nm: 'Kapal Tunda (Tugboat)', singkt: 'TB', jns: 'ALAT APUNG' },
      { kd: 'AL13', nm: 'Kapal Pandu (Pilot Boat)', singkt: 'PB', jns: 'ALAT APUNG' },
    ],
  },
  fasilitas: {
    jenisFasilitas: ['Dermaga', 'Lapangan', 'Gudang', 'Terminal Penumpang', 'Terminal Kendaraan', 'Alur Pelayaran', 'Kolam Pelabuhan'],
    satuan: ['meter', 'm2', 'm3', 'mLws', 'unit', 'orang', 'ton'],
  },
};

export async function GET() {
  return NextResponse.json({
    success: true,
    branches: OFFICIAL_BRANCHES,
    options: MODULE_OPTIONS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { module, data, user } = body;

    if (!module) {
      return NextResponse.json(
        { success: false, error: 'Parameter module wajib disertakan.' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Data form input wajib disertakan.' },
        { status: 400 }
      );
    }

    const validModules: ModuleType[] = ['finansial', 'opkom', 'kinerja', 'utilisasi', 'peralatan', 'fasilitas'];
    if (!validModules.includes(module as ModuleType)) {
      return NextResponse.json(
        { success: false, error: `Modul "${module}" tidak valid. Pilih dari: ${validModules.join(', ')}` },
        { status: 400 }
      );
    }

    const result = saveManualInputRecord({
      module: module as ModuleType,
      data,
      user,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      isUpdate: result.isUpdate,
      record: result.record,
    });
  } catch (error: any) {
    console.error('Error in POST /api/manual-input:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
