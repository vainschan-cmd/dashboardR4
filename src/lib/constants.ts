export interface OfficialBranch {
  code: string;
  name: string;
  id: string;
  order: number;
}

export const OFFICIAL_BRANCHES: OfficialBranch[] = [
  { code: 'R01', name: 'Makassar', id: 'term_makassar', order: 1 },
  { code: 'R02', name: 'TPK Makassar', id: 'term_tpk_makassar', order: 2 },
  { code: 'R03', name: 'Samarinda', id: 'term_samarinda', order: 3 },
  { code: 'R04', name: 'Balikpapan', id: 'term_balikpapan', order: 4 },
  { code: 'R05', name: 'Bitung', id: 'term_bitung', order: 5 },
  { code: 'R06', name: 'TPK Bitung', id: 'term_tpk_bitung', order: 6 },
  { code: 'R07', name: 'Ambon', id: 'term_ambon', order: 7 },
  { code: 'R08', name: 'Sorong', id: 'term_sorong', order: 8 },
  { code: 'R09', name: 'Jayapura', id: 'term_jayapura', order: 9 },
  { code: 'R10', name: 'Tarakan', id: 'term_tarakan', order: 10 },
  { code: 'R11', name: 'Pantoloan', id: 'term_pantoloan', order: 11 },
  { code: 'R12', name: 'Ternate', id: 'term_ternate', order: 12 },
  { code: 'R13', name: 'Kendari', id: 'term_kendari', order: 13 },
  { code: 'R14', name: 'Parepare', id: 'term_parepare', order: 14 },
  { code: 'R15', name: 'Biak', id: 'term_biak', order: 15 },
  { code: 'R16', name: 'Merauke', id: 'term_merauke', order: 16 },
  { code: 'R17', name: 'Manokwari', id: 'term_manokwari', order: 17 },
  { code: 'R18', name: 'Nunukan', id: 'term_nunukan', order: 18 },
  { code: 'R19', name: 'Tg Redeb', id: 'term_tg_redeb', order: 19 },
  { code: 'R20', name: 'Gorontalo', id: 'term_gorontalo', order: 20 },
  { code: 'R21', name: 'Fakfak', id: 'term_fakfak', order: 21 },
  { code: 'R22', name: 'Tolitoli', id: 'term_tolitoli', order: 22 },
  { code: 'R23', name: 'Manado', id: 'term_manado', order: 23 },
  { code: 'R24', name: 'Makassar New Port', id: 'term_makassar_new_port', order: 24 },
  { code: 'R25', name: 'Bontang', id: 'term_bontang', order: 25 },
  { code: 'R26', name: 'KKT', id: 'term_kkt', order: 26 },
  { code: 'R80', name: 'Luwuk Tangkiang', id: 'term_luwuk_tangkiang', order: 27 },
  { code: 'R99', name: 'Regional 4', id: 'term_regional_4', order: 28 },
];

export const MAIN_NAVIGATION_TABS = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'periode', label: 'Data per Periode' },
  { id: 'keuangan', label: 'Finance (Keuangan)' },
  { id: 'opkom', label: 'Opkom (Operasi & Komersial)' },
  { id: 'kinerja', label: 'Kinerja' },
  { id: 'utilisasi', label: 'Utilisasi' },
  { id: 'peralatan', label: 'Peralatan' },
  { id: 'fasilitas', label: 'Fasilitas' },
];

export function getBranchByCode(code: string): OfficialBranch | undefined {
  return OFFICIAL_BRANCHES.find(b => b.code.toUpperCase() === code.trim().toUpperCase());
}

export function getBranchById(id: string): OfficialBranch | undefined {
  return OFFICIAL_BRANCHES.find(b => b.id === id);
}

export function getCanonicalBranchCode(code?: string, name?: string): string {
  if (name) {
    const cleanName = String(name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const b of OFFICIAL_BRANCHES) {
      const bClean = b.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanName === bClean) return b.code;
    }
    if (cleanName === 'tanjungredeb' || cleanName === 'tgredeb') return 'R19';
    if (cleanName === 'luwuktangkian' || cleanName === 'luwuktangkiang') return 'R80';
    if (cleanName === 'mnp' || cleanName === 'makassarnewport') return 'R24';
    if (cleanName === 'tpkmakassar') return 'R02';
    if (cleanName === 'tpkbitung') return 'R06';
    if (cleanName === 'regional4' || cleanName === 'reg4') return 'R99';
  }
  if (code) {
    const cleanCode = String(code).trim().toUpperCase();
    const found = OFFICIAL_BRANCHES.find(b => b.code === cleanCode);
    if (found) return found.code;
    return cleanCode;
  }
  return '';
}

export function getBranchNameByCode(code: string): string {
  const found = getBranchByCode(code);
  return found ? found.name : code;
}

/**
 * Parse selected terminal filter into array of branch codes
 */
export function parseSelectedBranches(filterValue: string | undefined | null): string[] {
  if (!filterValue || filterValue === 'ALL') return ['ALL'];
  if (filterValue === 'NONE') return [];
  return filterValue
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Check if a branch matches the filter string.
 * filter can be:
 * - 'ALL' or empty: matches all branches
 * - 'NONE': matches no branches (all unchecked)
 * - Single code e.g. 'R01' or id 'term_makassar'
 * - Comma-separated list of branch codes e.g. 'R01,R02,R04'
 */
export function isBranchMatch(filterValue: string | undefined | null, branchCode?: string, branchName?: string): boolean {
  if (!filterValue || filterValue === 'ALL') return true;
  if (filterValue === 'NONE') return false;
  const canonicalBranch = getCanonicalBranchCode(branchCode, branchName);
  const selectedCodes = parseSelectedBranches(filterValue);

  if (selectedCodes.includes('ALL')) return true;
  if (selectedCodes.length === 0) return false;
  if (!canonicalBranch) return false;
  return selectedCodes.includes(canonicalBranch.toUpperCase());
}

/**
 * Get readable label for selectedTerminal (e.g. 'ALL' -> 'Semua Cabang', 'R01' -> '[R01] Makassar', 'R01,R02' -> 'Makassar & Bitung (2 Cabang)')
 */
export function getSelectedBranchLabel(filterValue: string | undefined | null): string {
  if (!filterValue || filterValue === 'ALL') return 'Semua Cabang (28 Cabang)';
  if (filterValue === 'NONE') return 'Pilih Cabang (0 Terpilih)';
  const codes = parseSelectedBranches(filterValue);
  if (codes.length === 0) return 'Pilih Cabang (0 Terpilih)';
  if (codes.length === 1) {
    const b = OFFICIAL_BRANCHES.find(ob => ob.code === codes[0]);
    return b ? `[${b.code}] ${b.name}` : `[${codes[0]}]`;
  }
  if (codes.length === 2) {
    const b1 = OFFICIAL_BRANCHES.find(ob => ob.code === codes[0]);
    const b2 = OFFICIAL_BRANCHES.find(ob => ob.code === codes[1]);
    const n1 = b1 ? b1.name : codes[0];
    const n2 = b2 ? b2.name : codes[1];
    return `${n1} & ${n2} (2 Cabang)`;
  }
  if (codes.length <= 3) {
    const names = codes.map(c => {
      const b = OFFICIAL_BRANCHES.find(ob => ob.code === c);
      return b ? b.name : c;
    });
    return `${names.join(', ')} (${codes.length} Cabang)`;
  }
  return `${codes.length} Cabang Dipilih (${codes.slice(0, 2).join(', ')}...)`;
}

/**
 * Get list of selected OfficialBranch objects
 */
export function getSelectedBranches(filterValue: string | undefined | null): OfficialBranch[] {
  if (!filterValue || filterValue === 'ALL') return OFFICIAL_BRANCHES;
  if (filterValue === 'NONE') return [];
  const codes = parseSelectedBranches(filterValue);
  return OFFICIAL_BRANCHES.filter(b => codes.includes(b.code));
}
