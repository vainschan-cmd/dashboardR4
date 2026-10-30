import { dbQueries } from './db';
import { MonthlyRecord, StatusColor } from './types';

export interface ValidationErrorItem {
  row: number;
  column?: string;
  field?: string;
  value?: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
  previewRows: Array<Record<string, any>>;
  parsedRecords: Array<Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>>;
}

export function validateSpreadsheetRows(
  rows: Array<Record<string, any>>,
  options: {
    departmentId?: string;
    targetMonth?: number;
    targetYear?: number;
    uploaderUsername: string;
    sourceType: 'upload_xlsx' | 'upload_csv' | 'google_sheets';
    batchId: string;
  }
): ValidationResult {
  const branches = dbQueries.getBranches();
  const branchByCode = new Map(branches.map(b => [b.code.toUpperCase().trim(), b]));
  const branchByName = new Map(branches.map(b => [b.name.toLowerCase().trim(), b]));

  const departments = dbQueries.getDepartments();
  const deptByCode = new Map(departments.map(d => [d.code.toUpperCase().trim(), d]));

  const allIndicators = dbQueries.getIndicators();
  const indByCode = new Map(allIndicators.map(i => [i.code.toUpperCase().trim(), i]));

  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];
  const parsedRecords: Array<Omit<MonthlyRecord, 'branch_name' | 'branch_code' | 'department_name' | 'indicator_name' | 'indicator_code' | 'direction'>> = [];
  const seenKeys = new Set<string>();

  const totalRows = rows.length;

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1, data starts at row 2

    // Helper to find key case-insensitively
    const getVal = (candidates: string[]): any => {
      for (const k of Object.keys(row)) {
        const cleaned = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const c of candidates) {
          if (cleaned === c.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            return row[k];
          }
        }
      }
      return undefined;
    };

    const rawBranchCode = getVal(['Kode Cabang', 'KodeCabang', 'BranchCode', 'CabangCode']);
    const rawBranchName = getVal(['Nama Cabang', 'NamaCabang', 'BranchName', 'Cabang']);
    const rawDeptCode = getVal(['Departemen', 'Dept', 'Kode Departemen', 'DepartmentCode']);
    const rawMonth = getVal(['Bulan', 'Month', 'Periode Bulan', 'PeriodeBulan']);
    const rawYear = getVal(['Tahun', 'Year', 'Periode Tahun', 'PeriodeTahun']);
    const rawIndCode = getVal(['Kode Indikator', 'KodeIndikator', 'IndicatorCode', 'Indikator']);
    const rawIndName = getVal(['Nama Indikator', 'NamaIndikator', 'IndicatorName']);
    const rawTarget = getVal(['Target', 'Rencana', 'Anggaran']);
    const rawReal = getVal(['Realisasi', 'Aktual', 'Actual', 'Nilai']);
    const rawUnit = getVal(['Satuan', 'Unit']);
    const rawNotes = getVal(['Keterangan', 'Notes', 'Catatan']) || '';

    let rowHasError = false;

    // 1. Branch Validation
    let branch = rawBranchCode ? branchByCode.get(String(rawBranchCode).toUpperCase().trim()) : null;
    if (!branch && rawBranchName) {
      branch = branchByName.get(String(rawBranchName).toLowerCase().trim()) || null;
    }
    if (!branch) {
      errors.push({
        row: rowNum,
        column: 'Kode Cabang / Nama Cabang',
        field: 'branch',
        value: rawBranchCode || rawBranchName,
        message: `Cabang '${rawBranchCode || rawBranchName || '(kosong)'}' tidak terdaftar pada Master Cabang.`,
        severity: 'error'
      });
      rowHasError = true;
    }

    // 2. Department Validation
    let dept = rawDeptCode ? deptByCode.get(String(rawDeptCode).toUpperCase().trim()) : null;
    if (!dept && options.departmentId) {
      dept = departments.find(d => d.id === options.departmentId) || null;
    }
    if (!dept) {
      errors.push({
        row: rowNum,
        column: 'Departemen',
        field: 'department',
        value: rawDeptCode,
        message: `Departemen '${rawDeptCode || '(kosong)'}' tidak valid.`,
        severity: 'error'
      });
      rowHasError = true;
    }

    // 3. Indicator Validation
    let indicator = rawIndCode ? indByCode.get(String(rawIndCode).toUpperCase().trim()) : null;
    if (!indicator) {
      errors.push({
        row: rowNum,
        column: 'Kode Indikator',
        field: 'indicator',
        value: rawIndCode,
        message: `Kode Indikator '${rawIndCode || '(kosong)'}' tidak ditemukan dalam Master Indikator.`,
        severity: 'error'
      });
      rowHasError = true;
    } else if (dept && indicator.department_id !== dept.id) {
      warnings.push({
        row: rowNum,
        column: 'Kode Indikator',
        field: 'indicator_dept_mismatch',
        value: rawIndCode,
        message: `Indikator '${indicator.name}' biasanya berada di bawah departemen lain.`,
        severity: 'warning'
      });
    }

    // 4. Period (Month & Year) Validation
    const month = parseInt(rawMonth, 10);
    const year = parseInt(rawYear, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      errors.push({
        row: rowNum,
        column: 'Bulan',
        field: 'month',
        value: rawMonth,
        message: `Format bulan '${rawMonth}' tidak valid (wajib angka 1 - 12).`,
        severity: 'error'
      });
      rowHasError = true;
    }

    if (isNaN(year) || year < 2020 || year > 2035) {
      errors.push({
        row: rowNum,
        column: 'Tahun',
        field: 'year',
        value: rawYear,
        message: `Format tahun '${rawYear}' tidak valid (misal: 2024, 2025, 2026).`,
        severity: 'error'
      });
      rowHasError = true;
    }

    // 5. Target & Realization Numeric Validation
    const cleanNum = (val: any): number => {
      if (val === undefined || val === null || val === '') return NaN;
      if (typeof val === 'number') return val;
      const str = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
      return parseFloat(str);
    };

    const targetNum = cleanNum(rawTarget);
    const realNum = cleanNum(rawReal);

    if (isNaN(targetNum)) {
      errors.push({
        row: rowNum,
        column: 'Target',
        field: 'target',
        value: rawTarget,
        message: `Nilai target '${rawTarget}' harus berupa angka numerik valid.`,
        severity: 'error'
      });
      rowHasError = true;
    }

    if (isNaN(realNum)) {
      errors.push({
        row: rowNum,
        column: 'Realisasi',
        field: 'realization',
        value: rawReal,
        message: `Nilai realisasi '${rawReal}' harus berupa angka numerik valid.`,
        severity: 'error'
      });
      rowHasError = true;
    }

    // 6. Duplicate check within file
    if (branch && indicator && !isNaN(month) && !isNaN(year)) {
      const duplicateKey = `${branch.id}_${indicator.id}_${year}_${month}`;
      if (seenKeys.has(duplicateKey)) {
        errors.push({
          row: rowNum,
          column: 'Duplikasi Record',
          field: 'duplicate',
          value: duplicateKey,
          message: `Duplikasi data ditemukan pada baris ini untuk Cabang '${branch.name}', Indikator '${indicator.name}', Periode ${month}/${year}.`,
          severity: 'error'
        });
        rowHasError = true;
      } else {
        seenKeys.add(duplicateKey);
      }
    }

    // If completely valid, construct parsed record
    if (!rowHasError && branch && dept && indicator) {
      // Calculate Achievement & Traffic Light
      let achievementPct = 100;
      let statusColor: StatusColor = 'green';

      if (indicator.direction === 'higher_is_better') {
        achievementPct = targetNum > 0 ? Number(((realNum / targetNum) * 100).toFixed(1)) : 100;
        statusColor = achievementPct >= 100 ? 'green' : achievementPct >= 85 ? 'yellow' : 'red';
      } else {
        if (targetNum === 0) {
          achievementPct = realNum === 0 ? 100 : 0;
          statusColor = realNum === 0 ? 'green' : 'red';
        } else {
          achievementPct = Number((100 + ((targetNum - realNum) / targetNum) * 100).toFixed(1));
          statusColor = realNum <= targetNum ? 'green' : realNum <= targetNum * 1.2 ? 'yellow' : 'red';
        }
      }

      parsedRecords.push({
        id: `rec_imp_${year}_${month}_${branch.code}_${indicator.code}_${Date.now()}_${index}`.toLowerCase(),
        branch_id: branch.id,
        department_id: dept.id,
        indicator_id: indicator.id,
        month,
        year,
        target: targetNum,
        realization: realNum,
        unit: rawUnit ? String(rawUnit) : indicator.unit,
        achievement_pct: achievementPct,
        status_color: statusColor,
        notes: rawNotes ? String(rawNotes) : 'Diimpor melalui spreadsheet',
        source_type: options.sourceType,
        batch_id: options.batchId,
        verification_status: 'pending_verification',
        revision_notes: null,
        uploaded_by: options.uploaderUsername,
        uploaded_at: new Date().toISOString(),
        verified_by: null,
        verified_at: null,
        is_simulated: true, // marked as simulated until official department guidelines
      });
    }
  });

  return {
    isValid: errors.length === 0,
    totalRows,
    validRowsCount: parsedRecords.length,
    errorRowsCount: totalRows - parsedRecords.length,
    errors,
    warnings,
    previewRows: rows.slice(0, 15),
    parsedRecords,
  };
}
