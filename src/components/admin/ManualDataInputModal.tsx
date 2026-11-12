'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  Ship,
  Activity,
  Anchor,
  Wrench,
  Warehouse,
  Info
} from 'lucide-react';
import { OFFICIAL_BRANCHES, getBranchByCode } from '@/lib/constants';
import { formatRupiahFull } from '@/lib/formatters';
import {
  FINANSIAL_ENTITAS_LIST,
  FINANSIAL_REKENING_LIST,
  formatPercentOrDash,
  parseMetricPercent,
} from '@/lib/finansialHelpers';
import {
  PERALATAN_ENTITAS_LIST,
  PERALATAN_JENIS_ALAT_LIST,
  PERALATAN_KATEGORI_LIST,
  PERALATAN_KONDISI_LIST,
} from '@/lib/peralatanHelpers';
import { User } from '@/lib/types';

export type ModuleType = 'finansial' | 'opkom' | 'kinerja' | 'utilisasi' | 'peralatan' | 'fasilitas';

interface ManualDataInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: ModuleType;
  selectedTerminal?: string;
  isBranchLocked?: boolean;
  currentUser?: User | null;
  onSuccess?: () => void;
}

const MODULES_CONFIG = [
  { id: 'finansial' as ModuleType, label: 'Finance (Keuangan)', icon: DollarSign, color: '#38bdf8' },
  { id: 'opkom' as ModuleType, label: 'Opkom (Operasi & Komersial)', icon: Ship, color: '#34d399' },
  { id: 'kinerja' as ModuleType, label: 'Kinerja Pelayanan', icon: Activity, color: '#fbbf24' },
  { id: 'utilisasi' as ModuleType, label: 'Utilisasi (BOR/YOR/SOR)', icon: Anchor, color: '#a855f7' },
  { id: 'peralatan' as ModuleType, label: 'Peralatan Pelabuhan', icon: Wrench, color: '#f97316' },
  { id: 'fasilitas' as ModuleType, label: 'Fasilitas & Dermaga', icon: Warehouse, color: '#ec4899' },
];

const MONTHS_LIST = [
  { value: 1, name: 'Januari (Bulan 1)' },
  { value: 2, name: 'Februari (Bulan 2)' },
  { value: 3, name: 'Maret (Bulan 3)' },
  { value: 4, name: 'April (Bulan 4)' },
  { value: 5, name: 'Mei (Bulan 5)' },
  { value: 6, name: 'Juni (Bulan 6)' },
  { value: 7, name: 'Juli (Bulan 7)' },
  { value: 8, name: 'Agustus (Bulan 8)' },
  { value: 9, name: 'September (Bulan 9)' },
  { value: 10, name: 'Oktober (Bulan 10)' },
  { value: 11, name: 'November (Bulan 11)' },
  { value: 12, name: 'Desember (Bulan 12)' },
];

export default function ManualDataInputModal({
  isOpen,
  onClose,
  defaultModule = 'finansial',
  selectedTerminal = 'R01',
  isBranchLocked = false,
  currentUser,
  onSuccess,
}: ManualDataInputModalProps) {
  // BOD / Viewer role is prohibited from manual input
  if (!isOpen || currentUser?.role === 'viewer' || currentUser?.nipp === '10000' || String(currentUser?.name).toLowerCase().includes('bod')) {
    return null;
  }

  const [activeModule, setActiveModule] = useState<ModuleType>(defaultModule);

  // Common fields
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(9);
  const [branchCode, setBranchCode] = useState<string>(() => {
    if (currentUser?.role === 'pic_cabang' && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      return currentUser.branch_id;
    }
    return selectedTerminal && selectedTerminal !== 'ALL' ? selectedTerminal : 'R01';
  });

  // 1. Finansial state (9 field standar)
  const [finRekening, setFinRekening] = useState<string>('Pendapatan');
  const [finEntitas, setFinEntitas] = useState<string>('CABANG');
  const [finRealisasi, setFinRealisasi] = useState<number>(170176612011);
  const [finRkaInput, setFinRkaInput] = useState<string>('99.01');
  const [finYoyInput, setFinYoyInput] = useState<string>('103.00');

  // 2. Opkom state
  const [opLayanan, setOpLayanan] = useState('KAPAL');
  const [opSatuan, setOpSatuan] = useState('Rp');
  const [opJumlah, setOpJumlah] = useState<number>(50000000000);
  const [opYoy, setOpYoy] = useState<number>(104.5);
  const [opRka, setOpRka] = useState<number>(98.2);

  // 3. Kinerja state
  const [kinKode, setKinKode] = useState('K01');
  const [kinNama, setKinNama] = useState('KAPAL');
  const [kinSatuan, setKinSatuan] = useState('WTP');
  const [kinNilai, setKinNilai] = useState<number>(0.85);

  // 4. Utilisasi state
  const [utDermaga, setUtDermaga] = useState('MULTIPURPOSE');
  const [utBor, setUtBor] = useState<number>(55.4);
  const [utYor, setUtYor] = useState<number>(42.1);
  const [utSor, setUtSor] = useState<number>(38.0);

  // 5. Peralatan state (9 kolom standar monitoring kondisi)
  const [alTanggal, setAlTanggal] = useState<string>('2026-11-08');
  const [alGrupEntitas, setAlGrupEntitas] = useState<string>('R4');
  const [alNama, setAlNama] = useState<string>('Forklift 01');
  const [alJenis, setAlJenis] = useState<string>('Forklift');
  const [alKategori, setAlKategori] = useState<string>('Alat CY');
  const [alKondisi, setAlKondisi] = useState<string>('READY');
  const [alKerusakan, setAlKerusakan] = useState<string>('-');
  const [alTindakLanjut, setAlTindakLanjut] = useState<string>('-');

  // 6. Fasilitas state
  const [fasNama, setFasNama] = useState('Dermaga Nusantara');
  const [fasJenis, setFasJenis] = useState('Dermaga');
  const [fasSatuan, setFasSatuan] = useState('meter');
  const [fasPanjang, setFasPanjang] = useState<number>(450);
  const [fasLebar, setFasLebar] = useState<number>(25);
  const [fasMLws, setFasMLws] = useState<number>(-12);
  const [fasNilai, setFasNilai] = useState<number>(11250);
  const [fasKet, setFasKet] = useState('Segmen A-D');

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveModule(defaultModule);
    if (currentUser?.role === 'pic_cabang' && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      setBranchCode(currentUser.branch_id);
    } else if (selectedTerminal && selectedTerminal !== 'ALL') {
      setBranchCode(selectedTerminal);
    }
  }, [defaultModule, selectedTerminal, currentUser, isOpen]);

  if (!isOpen) return null;

  // Selected branch helper
  const branchObj = getBranchByCode(branchCode);
  const branchName = branchObj ? branchObj.name : branchCode;

  const parsedFinRka = parseMetricPercent(finRkaInput);
  const parsedFinYoy = parseMetricPercent(finYoyInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let payloadData: Record<string, any> = {
      TAHUN: year,
      BULAN: month,
      KODE_CBG: branchCode,
      NM_CBG: branchName,
    };

    if (activeModule === 'finansial') {
      payloadData = {
        ...payloadData,
        REKENING: finRekening,
        ENTITAS: finEntitas,
        REALISASI: finRealisasi,
        RKA: finRealisasi === 0 && parsedFinRka === null ? '-' : parsedFinRka ?? '-',
        YOY: finRealisasi === 0 && parsedFinYoy === null ? '-' : parsedFinYoy ?? '-',
      };
    } else if (activeModule === 'opkom') {
      payloadData = {
        ...payloadData,
        LAYANAN: opLayanan,
        SATUAN: opSatuan,
        JUMLAH: opJumlah,
        YOY: opYoy,
        RKA: opRka,
      };
    } else if (activeModule === 'kinerja') {
      payloadData = {
        ...payloadData,
        KD_KINE: kinKode,
        NM_KINE: kinNama,
        SATUAN: kinSatuan,
        NILAI: kinNilai,
      };
    } else if (activeModule === 'utilisasi') {
      payloadData = {
        ...payloadData,
        KD_JENDERM: 1,
        DERMAGA: utDermaga,
        BOR: utBor,
        YOR: utYor,
        SOR: utSor,
      };
    } else if (activeModule === 'peralatan') {
      payloadData = {
        ...payloadData,
        tanggal: alTanggal,
        grup_entitas: alGrupEntitas,
        nama_cabang: branchName,
        nama_alat: alNama,
        jenis_alat: alJenis,
        kategori_alat: alKategori,
        kondisi: alKondisi,
        kerusakan: alKerusakan,
        tindak_lanjut: alTindakLanjut,
      };
    } else if (activeModule === 'fasilitas') {
      payloadData = {
        ...payloadData,
        nm_pasfel: fasNama,
        jns_faspel: fasJenis,
        satuan: fasSatuan,
        panjang: fasPanjang,
        lebar: fasLebar,
        mLws: fasMLws,
        nilai: fasNilai || (fasPanjang * fasLebar),
        ket: fasKet,
      };
    }

    try {
      const res = await fetch('/api/manual-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: activeModule,
          data: payloadData,
        }),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        setErrorMsg(resJson.error || 'Gagal menyimpan data manual.');
      } else {
        setSuccessMsg(resJson.message || 'Data berhasil disimpan ke spreadsheet input_data.xlsx dan database!');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '680px', width: '100%', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)',
              }}
            >
              <PlusCircle size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Input Data Manual Operasional & Keuangan
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Field input diselaraskan persis dengan struktur spreadsheet <strong>input_data.xlsx</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Module Selector Tabs */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-inner)',
            padding: '4px 8px',
            gap: '4px',
          }}
        >
          {MODULES_CONFIG.map((m) => {
            const Icon = m.icon;
            const isSelected = activeModule === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveModule(m.id);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  background: isSelected ? 'var(--bg-card)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} color={isSelected ? 'var(--accent-blue)' : m.color} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div
            className="modal-body"
            style={{
              maxHeight: '68vh',
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  color: '#f87171',
                  fontSize: '12px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid #10b981',
                  borderRadius: '8px',
                  color: '#34d399',
                  fontSize: '12px',
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* General Row: Cabang & Periode Waktu */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                backgroundColor: 'var(--bg-inner)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={12} color="var(--accent-cyan)" />
                    <span>Cabang Pelabuhan (KODE_CBG)</span>
                  </span>
                  {isBranchLocked && (
                    <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', backgroundColor: 'rgba(2, 132, 199, 0.2)', padding: '1px 6px', borderRadius: '8px' }}>
                      🔒 Terkunci PIC
                    </span>
                  )}
                </label>
                <select
                  value={branchCode}
                  onChange={(e) => {
                    if (!isBranchLocked) {
                      setBranchCode(e.target.value);
                    }
                  }}
                  disabled={isBranchLocked}
                  className="form-control"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    opacity: isBranchLocked ? 0.85 : 1,
                    cursor: isBranchLocked ? 'not-allowed' : 'pointer',
                  }}
                  required
                >
                  {(isBranchLocked && currentUser?.branch_id && currentUser.branch_id !== 'R99'
                    ? OFFICIAL_BRANCHES.filter((b) => b.code === currentUser.branch_id)
                    : OFFICIAL_BRANCHES
                  ).map((b) => (
                    <option key={b.code} value={b.code}>
                      [{b.code}] {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Calendar size={12} color="var(--accent-orange)" />
                  <span>Tahun (TAHUN)</span>
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  min={2020}
                  max={2035}
                  className="form-control"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Calendar size={12} color="var(--accent-orange)" />
                  <span>Bulan (BULAN)</span>
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="form-control"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                  required
                >
                  {MONTHS_LIST.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* MODULE SPECIFIC FIELDS */}

            {/* 1. FINANCE / FINANSIAL (9 Field Standar) */}
            {activeModule === 'finansial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Rekening Akuntansi (REKENING)
                    </label>
                    <select
                      value={finRekening}
                      onChange={(e) => setFinRekening(e.target.value)}
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    >
                      {FINANSIAL_REKENING_LIST.map((rek) => (
                        <option key={rek} value={rek}>
                          {rek}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Entitas Pelaporan (ENTITAS)
                    </label>
                    <select
                      value={finEntitas}
                      onChange={(e) => setFinEntitas(e.target.value)}
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    >
                      {FINANSIAL_ENTITAS_LIST.map((ent) => (
                        <option key={ent} value={ent}>
                          {ent}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Realisasi Nominal Rp (REALISASI — gunakan angka negatif untuk Beban atau ELIMINASI)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={finRealisasi}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFinRealisasi(Number.isFinite(val) ? val : 0);
                      if (val === 0) {
                        setFinRkaInput('-');
                        setFinYoyInput('-');
                      }
                    }}
                    className="form-control"
                    placeholder="Contoh: 170176612011 atau -111088687271"
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ color: finRealisasi < 0 ? '#f87171' : 'var(--accent-cyan)', fontWeight: 600 }}>
                      {formatRupiahFull(finRealisasi)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({(finRealisasi / 1_000_000_000).toFixed(2)} Miliar Rp)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Pencapaian RKA % (RKA atau &quot;-&quot; jika 0)
                    </label>
                    <input
                      type="text"
                      value={finRkaInput}
                      onChange={(e) => setFinRkaInput(e.target.value)}
                      className="form-control"
                      placeholder="99.01 atau -"
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Preview: {formatPercentOrDash(finRkaInput)}
                    </span>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Pertumbuhan YoY % (YOY atau &quot;-&quot; jika 0)
                    </label>
                    <input
                      type="text"
                      value={finYoyInput}
                      onChange={(e) => setFinYoyInput(e.target.value)}
                      className="form-control"
                      placeholder="103.00 atau -"
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Preview: {formatPercentOrDash(finYoyInput)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. OPKOM */}
            {activeModule === 'opkom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Layanan Operasional (LAYANAN)
                    </label>
                    <select
                      value={opLayanan}
                      onChange={(e) => setOpLayanan(e.target.value)}
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    >
                      <option value="KAPAL">KAPAL (Kunjungan / Pandu / Tunda)</option>
                      <option value="PETIKEMAS">PETIKEMAS (Bongkar Muat Box/TEUs)</option>
                      <option value="BARANG">BARANG (General Cargo / Curah)</option>
                      <option value="PENUMPANG">PENUMPANG (Pax Embarkasi/Debarkasi)</option>
                      <option value="RUPA-RUPA">RUPA-RUPA (Air Kapal / Jasa Lain)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Satuan Ukuran (SATUAN)
                    </label>
                    <select
                      value={opSatuan}
                      onChange={(e) => setOpSatuan(e.target.value)}
                      className="form-control"
                    >
                      <option value="Rp">Rupiah (Rp)</option>
                      <option value="GT">Gross Tonnage (GT)</option>
                      <option value="TEUS">Twenty-foot Equivalent Unit (TEUs)</option>
                      <option value="TON/M3">Ton / Meter Kubik (TON/M3)</option>
                      <option value="ORANG">Orang / Penumpang</option>
                      <option value="CALL">Call / Kunjungan</option>
                      <option value="BOX">Box Petikemas</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                    Nilai Realisasi (JUMLAH)
                  </label>
                  <input
                    type="number"
                    value={opJumlah}
                    onChange={(e) => setOpJumlah(Number(e.target.value))}
                    className="form-control"
                    placeholder="Contoh: 96720984702"
                    required
                  />
                  {opSatuan === 'Rp' && (
                    <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                      {formatRupiahFull(opJumlah)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      YoY % (YOY)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={opYoy}
                      onChange={(e) => setOpYoy(Number(e.target.value))}
                      className="form-control"
                      placeholder="105.16"
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Pencapaian RKA % (RKA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={opRka}
                      onChange={(e) => setOpRka(Number(e.target.value))}
                      className="form-control"
                      placeholder="91.45"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. KINERJA */}
            {activeModule === 'kinerja' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Nama Kinerja (NM_KINE)
                    </label>
                    <select
                      value={kinNama}
                      onChange={(e) => {
                        const val = e.target.value;
                        setKinNama(val);
                        if (val === 'KAPAL') { setKinKode('K01'); setKinSatuan('WTP'); }
                        else if (val === 'GENERAL CARGO') { setKinKode('K02'); setKinSatuan('TGH'); }
                        else if (val === 'CURAH KERING') { setKinKode('K03'); setKinSatuan('TGH'); }
                        else if (val === 'CURAH CAIR') { setKinKode('K04'); setKinSatuan('TSD'); }
                        else if (val === 'PETIKEMAS') { setKinKode('K05'); setKinSatuan('BSH'); }
                      }}
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    >
                      <option value="KAPAL">KAPAL (Waiting Time, Approach Time)</option>
                      <option value="PETIKEMAS">PETIKEMAS (BSH, BCH)</option>
                      <option value="GENERAL CARGO">GENERAL CARGO (TGH, TSD)</option>
                      <option value="CURAH KERING">CURAH KERING (TGH)</option>
                      <option value="CURAH CAIR">CURAH CAIR (TSD)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Kode Kinerja (KD_KINE)
                    </label>
                    <input
                      type="text"
                      value={kinKode}
                      onChange={(e) => setKinKode(e.target.value.toUpperCase())}
                      className="form-control"
                      placeholder="K01"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Satuan Indikator (SATUAN)
                    </label>
                    <select
                      value={kinSatuan}
                      onChange={(e) => setKinSatuan(e.target.value)}
                      className="form-control"
                    >
                      <option value="WTP">WTP (Waiting Time to Pilot / Jam)</option>
                      <option value="ET:BT">ET:BT (Effective to Berth Time / %)</option>
                      <option value="BSH">BSH (Box per Ship Hour)</option>
                      <option value="BCH">BCH (Box per Crane Hour)</option>
                      <option value="TGH">TGH (Ton per Gang Hour)</option>
                      <option value="TSD">TSD (Ton per Ship Day)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Nilai Capaian (NILAI)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={kinNilai}
                      onChange={(e) => setKinNilai(Number(e.target.value))}
                      className="form-control"
                      placeholder="0.85"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. UTILISASI */}
            {activeModule === 'utilisasi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                    Nama / Jenis Dermaga (DERMAGA)
                  </label>
                  <select
                    value={utDermaga}
                    onChange={(e) => setUtDermaga(e.target.value)}
                    className="form-control"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="MULTIPURPOSE">MULTIPURPOSE</option>
                    <option value="PETIKEMAS">PETIKEMAS</option>
                    <option value="MULTIPURPOSE PRE">MULTIPURPOSE PRE</option>
                    <option value="MULTIPURPOSE GRK">MULTIPURPOSE GRK</option>
                    <option value="CURAH KERING">CURAH KERING</option>
                    <option value="CURAH CAIR">CURAH CAIR</option>
                    <option value="KONVENSIONAL">KONVENSIONAL</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      BOR % (Berth Occupancy)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={utBor}
                      onChange={(e) => setUtBor(Number(e.target.value))}
                      className="form-control"
                      placeholder="55.4"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      YOR % (Yard Occupancy)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={utYor}
                      onChange={(e) => setUtYor(Number(e.target.value))}
                      className="form-control"
                      placeholder="42.1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      SOR % (Shed Occupancy)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={utSor}
                      onChange={(e) => setUtSor(Number(e.target.value))}
                      className="form-control"
                      placeholder="38.0"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. PERALATAN (9 Kolom Standar Monitoring Kondisi) */}
            {activeModule === 'peralatan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Tanggal (tanggal)
                    </label>
                    <input
                      type="date"
                      value={alTanggal}
                      onChange={(e) => setAlTanggal(e.target.value)}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Grup / Entitas
                    </label>
                    <select
                      value={alGrupEntitas}
                      onChange={(e) => setAlGrupEntitas(e.target.value)}
                      className="form-control"
                      style={{ fontWeight: 600 }}
                    >
                      {PERALATAN_ENTITAS_LIST.map((ent) => (
                        <option key={ent} value={ent}>{ent}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Kategori Alat
                    </label>
                    <select
                      value={alKategori}
                      onChange={(e) => setAlKategori(e.target.value)}
                      className="form-control"
                    >
                      {PERALATAN_KATEGORI_LIST.map((kat) => (
                        <option key={kat} value={kat}>{kat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Nama Alat (nama_alat)
                    </label>
                    <input
                      type="text"
                      value={alNama}
                      onChange={(e) => setAlNama(e.target.value)}
                      className="form-control"
                      placeholder="Contoh: RTG 04 / Forklift 01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Jenis Alat (jenis_alat)
                    </label>
                    <select
                      value={alJenis}
                      onChange={(e) => setAlJenis(e.target.value)}
                      className="form-control"
                    >
                      {PERALATAN_JENIS_ALAT_LIST.map((jns) => (
                        <option key={jns} value={jns}>{jns}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Kondisi (kondisi)
                    </label>
                    <select
                      value={alKondisi}
                      onChange={(e) => setAlKondisi(e.target.value)}
                      className="form-control"
                      style={{ fontWeight: 700 }}
                    >
                      {PERALATAN_KONDISI_LIST.map((kon) => (
                        <option key={kon} value={kon}>{kon}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Kerusakan (isi &apos;-&apos; jika tidak ada)
                    </label>
                    <textarea
                      rows={2}
                      value={alKerusakan}
                      onChange={(e) => setAlKerusakan(e.target.value)}
                      className="form-control"
                      placeholder="- atau deskripsi kerusakan..."
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Tindak Lanjut (isi &apos;-&apos; jika tidak ada)
                    </label>
                    <textarea
                      rows={2}
                      value={alTindakLanjut}
                      onChange={(e) => setAlTindakLanjut(e.target.value)}
                      className="form-control"
                      placeholder="- atau rencana perbaikan / sparepart..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. FASILITAS */}
            {activeModule === 'fasilitas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Nama Fasilitas (nm_pasfel)
                    </label>
                    <input
                      type="text"
                      value={fasNama}
                      onChange={(e) => setFasNama(e.target.value)}
                      className="form-control"
                      placeholder="Contoh: Dermaga Soekarno"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-title)', marginBottom: '4px', display: 'block' }}>
                      Jenis Fasilitas (jns_faspel)
                    </label>
                    <select
                      value={fasJenis}
                      onChange={(e) => setFasJenis(e.target.value)}
                      className="form-control"
                    >
                      <option value="Dermaga">Dermaga</option>
                      <option value="Lapangan">Lapangan Penumpukan</option>
                      <option value="Gudang">Gudang</option>
                      <option value="Terminal Penumpang">Terminal Penumpang</option>
                      <option value="Terminal Kendaraan">Terminal Kendaraan</option>
                      <option value="Alur Pelayaran">Alur Pelayaran</option>
                      <option value="Kolam Pelabuhan">Kolam Pelabuhan</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Panjang m (panjang)
                    </label>
                    <input
                      type="number"
                      value={fasPanjang}
                      onChange={(e) => setFasPanjang(Number(e.target.value))}
                      className="form-control"
                      placeholder="1310"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Lebar m (lebar)
                    </label>
                    <input
                      type="number"
                      value={fasLebar}
                      onChange={(e) => setFasLebar(Number(e.target.value))}
                      className="form-control"
                      placeholder="11"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Kedalaman (mLws)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={fasMLws}
                      onChange={(e) => setFasMLws(Number(e.target.value))}
                      className="form-control"
                      placeholder="-9"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Satuan (satuan)
                    </label>
                    <input
                      type="text"
                      value={fasSatuan}
                      onChange={(e) => setFasSatuan(e.target.value)}
                      className="form-control"
                      placeholder="meter"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Luas / Kapasitas Nilai (nilai)
                    </label>
                    <input
                      type="number"
                      value={fasNilai}
                      onChange={(e) => setFasNilai(Number(e.target.value))}
                      className="form-control"
                      placeholder="14410"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Keterangan / Segmen (ket)
                    </label>
                    <input
                      type="text"
                      value={fasKet}
                      onChange={(e) => setFasKet(e.target.value)}
                      className="form-control"
                      placeholder="Contoh: KD 101-05"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            className="modal-footer"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-inner)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} color="var(--accent-blue)" />
              <span>Tersimpan ke file Excel & database real-time</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-dark"
                disabled={loading}
                style={{ padding: '8px 16px', fontSize: '12.5px' }}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{
                  padding: '8px 18px',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Save size={14} />
                <span>{loading ? 'Menyimpan...' : 'Simpan ke Spreadsheet'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
