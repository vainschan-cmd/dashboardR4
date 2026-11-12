/**
 * Glossary for the abbreviations that appear on the dashboards (`COPY-02`).
 *
 * BOPO, RKA, YoY, BOR, YOR, SOR, WTP and ET:BT were shown bare. An executive who
 * does not work in port finance daily cannot be expected to recall all of them,
 * and a tooltip costs nothing. The definitions are short by design — a glossary
 * nobody opens is the same as no glossary.
 */

export interface GlossaryEntry {
  /** The abbreviation exactly as it appears on screen. */
  term: string;
  /** Full expansion, in Indonesian. */
  expansion: string;
  /** One-sentence definition a reader can act on. */
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  BOPO: {
    term: 'BOPO',
    expansion: 'Biaya Operasional terhadap Pendapatan Operasional',
    definition:
      'Rasio beban biaya dibanding pendapatan usaha. Semakin rendah semakin efisien; di atas 100% berarti biaya melebihi pendapatan.',
  },
  RKA: {
    term: 'RKA',
    expansion: 'Rencana Kerja dan Anggaran',
    definition:
      'Angka target yang disetujui untuk periode berjalan. Capaian RKA 100% berarti realisasi tepat sesuai target.',
  },
  YoY: {
    term: 'YoY',
    expansion: 'Year on Year',
    definition:
      'Perbandingan terhadap periode yang sama pada tahun sebelumnya. YoY 105% berarti naik 5% dibanding tahun lalu.',
  },
  BOR: {
    term: 'BOR',
    expansion: 'Berth Occupancy Ratio',
    definition:
      'Persentase waktu dermaga terpakai dibanding waktu yang tersedia. Menunjukkan seberapa padat dermaga beroperasi.',
  },
  YOR: {
    term: 'YOR',
    expansion: 'Yard Occupancy Ratio',
    definition:
      'Persentase pemakaian lapangan penumpukan (yard) terhadap kapasitasnya.',
  },
  SOR: {
    term: 'SOR',
    expansion: 'Shed Occupancy Ratio',
    definition: 'Persentase pemakaian gudang (shed) terhadap kapasitasnya.',
  },
  RFU: {
    term: 'RFU',
    expansion: 'Ready For Use',
    definition:
      'Tingkat kesiapan peralatan untuk dioperasikan. Target regional 92%; di bawah itu peralatan dianggap menghambat layanan.',
  },
  TEUs: {
    term: 'TEUs',
    expansion: 'Twenty-foot Equivalent Units',
    definition:
      'Satuan baku petikemas: satu TEUs setara satu petikemas ukuran 20 kaki.',
  },
  WTP: {
    term: 'WTP',
    expansion: 'Wajar Tanpa Pengecualian',
    definition:
      'Opini audit tertinggi atas laporan keuangan: tidak ditemukan salah saji material.',
  },
  'ET:BT': {
    term: 'ET:BT',
    expansion: 'Effective Time : Berth Time',
    definition:
      'Perbandingan waktu efektif kerja terhadap total waktu sandar. Semakin mendekati 100%, semakin sedikit waktu tunggu.',
  },
  PMT: {
    term: 'PMT',
    expansion: 'Petikemas',
    definition: 'Segmen usaha bongkar muat petikemas.',
  },
  PTP: {
    term: 'PTP',
    expansion: 'Peti Kemas / Terminal Petikemas',
    definition: 'Terminal khusus pelayanan petikemas.',
  },
  PJM: {
    term: 'PJM',
    expansion: 'Penjaminan Mutu / segmen jasa',
    definition: 'Segmen usaha jasa penjaminan mutu layanan.',
  },
  PSL: {
    term: 'PSL',
    expansion: 'Pelayanan Suku Lapangan',
    definition: 'Segmen usaha pelayanan lapangan penumpukan.',
  },
};

/**
 * Case-insensitive index. Keys are written in their display form (`YoY`, `BOR`),
 * so a lookup on `yoy` has to normalise — otherwise the glossary silently misses
 * exactly the mixed-case terms it was written for.
 */
const GLOSSARY_INDEX: Map<string, GlossaryEntry> = new Map(
  Object.values(GLOSSARY).map((entry) => [entry.term.toUpperCase(), entry])
);

/** Look up a term, tolerating case differences and surrounding whitespace. */
export function lookupGlossary(term: string): GlossaryEntry | null {
  const key = String(term || '').trim().toUpperCase();
  if (!key) return null;
  return GLOSSARY_INDEX.get(key) ?? null;
}

/** Tooltip text for a term: `BOPO — Biaya Operasional terhadap … . <definition>` */
export function glossaryTooltip(term: string): string | null {
  const entry = lookupGlossary(term);
  if (!entry) return null;
  return `${entry.term} — ${entry.expansion}. ${entry.definition}`;
}
