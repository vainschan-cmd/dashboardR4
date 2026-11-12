import { NextRequest, NextResponse } from 'next/server';
import { saveManualInputRecord, getModuleDepartmentId, ModuleType } from '@/lib/manualInputService';
import { OFFICIAL_BRANCHES } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { resolveReadBranchScope } from '@/lib/policy';
import {
  requireAuth,
  validateBranchWriteAccess,
  validateDepartmentWriteAccess,
} from '@/lib/rbac';
import { manualInputSchema, parseWithSchema } from '@/lib/validation';
import { ModuleScopeError } from '@/lib/dataIntegrity';

const MODULE_OPTIONS = {
  finansial: {
    rekening: ['Pendapatan', 'Beban', 'Laba Usaha', 'Laba Bersih'],
    entitas: ['CABANG', 'PMT', 'PTP', 'PSL', 'PJM', 'ELIMINASI'],
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
    grupEntitas: ['PTP', 'PMT', 'MTI', 'R4'],
    kategoriAlat: ['Alat CY', 'Alat Dermaga', 'Alat Bantu'],
    kondisi: ['READY', 'READY DENGAN CATATAN', 'BREAKDOWN', 'USUL/PROSES PENGHAPUSAN'],
    jenisAlat: [
      'Chassis',
      'Forklift',
      'Head Truck',
      'Mobile Crane',
      'Quay Container Crane',
      'Reach Stacker',
      'Rubber Tyred Gantry Crane',
      'Side Loader',
      'Terminal Tractor',
      'Tronton',
      'EXCAVATOR',
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

  const branchScope = resolveReadBranchScope(
    {
      role: auth.session.role,
      branch_id: auth.session.branch_id,
      department_id: auth.session.department_id,
      sub: auth.session.sub,
    },
    undefined
  );
  const branches = branchScope
    ? OFFICIAL_BRANCHES.filter((b) => b.code === branchScope)
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
    const { module, data } = parsed.data;

    // 1. Enforce Server-Side Branch Scope (Row-Level Security for pic_cabang)
    const rawRequestedBranch = data.kodeCabang || data.branchCode || data.KODE_CBG;
    const requestedBranch = typeof rawRequestedBranch === 'string' ? rawRequestedBranch : undefined;
    const branchCheck = validateBranchWriteAccess(auth.session, requestedBranch);
    if (!branchCheck.allowed) {
      return NextResponse.json(
        { success: false, error: branchCheck.error },
        { status: 403 }
      );
    }

    // 2. Enforce Server-Side Department Scope (Row-Level Security for pic_dept_regional)
    const targetDeptId = getModuleDepartmentId(module as ModuleType);
    const deptCheck = validateDepartmentWriteAccess(auth.session, targetDeptId);
    if (!deptCheck.allowed) {
      return NextResponse.json(
        { success: false, error: deptCheck.error },
        { status: 403 }
      );
    }

    // Lock branch code in payload to validated branch
    const scopedData: Record<string, unknown> = {
      ...data,
      kodeCabang: branchCheck.canonicalCode,
    };

    const result = await saveManualInputRecord({
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
  } catch (error: unknown) {
    // A rejected scope is the caller's mistake, not a server fault: report it as
    // 400 with the specific problem so the operator can fix the payload (`DATA-10`).
    if (error instanceof ModuleScopeError) {
      return NextResponse.json(
        { success: false, error: error.message, issues: error.issues, code: 'invalid_scope' },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Gagal menyimpan data manual.';
    logError('api/manual-input', error, { requestId: req.headers.get('x-request-id') });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
