import { NextRequest, NextResponse } from 'next/server';
import { saveManualInputRecord, ModuleType } from '@/lib/manualInputService';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import {
  requireAuth,
  validateBranchWriteAccess,
  validateDepartmentWriteAccess,
} from '@/lib/rbac';
import { manualInputSchema, parseWithSchema } from '@/lib/validation';

const MODULE_DEPARTMENT_MAP: Record<ModuleType, string> = {
  finansial: 'dept_keu',
  opkom: 'dept_ops',
  kinerja: 'dept_ops',
  utilisasi: 'dept_ops',
  peralatan: 'dept_tek',
  fasilitas: 'dept_tek',
};

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

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'dashboard:read' });
  if (!auth.authorized) return auth.response;

  const branches =
    auth.session.role === 'pic_cabang' && auth.session.branch_id && auth.session.branch_id !== 'R99'
      ? OFFICIAL_BRANCHES.filter(b => b.code === auth.session.branch_id)
      : OFFICIAL_BRANCHES;

  return NextResponse.json({
    success: true,
    branches,
    options: MODULE_OPTIONS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { requiredPermission: 'manual_input:write' });
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const parsed = parseWithSchema(manualInputSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }
    const { module, data } = parsed.data as { module: ModuleType; data: Record<string, any> };

    // 1. Enforce Server-Side Branch Scope (Row-Level Security for pic_cabang)
    const requestedBranch = data.kodeCabang || data.branchCode || data.KODE_CBG;
    const branchCheck = validateBranchWriteAccess(auth.session, requestedBranch);
    if (!branchCheck.allowed) {
      return NextResponse.json(
        { success: false, error: branchCheck.error },
        { status: 403 }
      );
    }

    // 2. Enforce Server-Side Department Scope (Row-Level Security for pic_dept_regional)
    const targetDeptId = MODULE_DEPARTMENT_MAP[module as ModuleType];
    const deptCheck = validateDepartmentWriteAccess(auth.session, targetDeptId);
    if (!deptCheck.allowed) {
      return NextResponse.json(
        { success: false, error: deptCheck.error },
        { status: 403 }
      );
    }

    // Lock branch code in payload to validated branch
    const scopedData = {
      ...data,
      kodeCabang: branchCheck.canonicalCode,
    };

    const result = saveManualInputRecord({
      module: module as ModuleType,
      data: scopedData,
      user: {
        id: auth.session.sub,
        name: auth.session.name,
        role: auth.session.role,
        nipp: auth.session.nipp,
      },
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      isUpdate: result.isUpdate,
      verificationStatus: result.verificationStatus,
      recordId: result.recordId,
      monthlyRecordId: result.monthlyRecordId,
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
