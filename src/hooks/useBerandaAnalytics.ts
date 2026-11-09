'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  OFFICIAL_BRANCHES,
  getBranchByCode,
  isBranchMatch,
  parseSelectedBranches,
} from '@/lib/constants';
import { formatRupiahFull, formatRupiahCompact } from '@/lib/formatters';
import { User, UserRole } from '@/lib/types';

export interface BerandaKpiItem {
  title: string;
  value: string;
  fullValue?: string;
  comp1: string;
  comp1Good: boolean;
  comp2: string;
  comp2Good: boolean;
  rawTarget: string;
  rawRealization: string;
  hasData: boolean;
  hasPending: boolean;
}

export function useBerandaAnalytics({
  selectedTerminal = 'ALL',
  selectedPeriod = 'YTD Sep 2026',
  currentUser,
  userRole,
  terminalSearch = '',
}: {
  selectedTerminal?: string;
  selectedPeriod?: string;
  currentUser?: User | null;
  userRole?: UserRole;
  terminalSearch?: string;
}) {
  const isBodViewer = userRole === 'viewer' || currentUser?.role === 'viewer';
  const [loading, setLoading] = useState<boolean>(true);
  const [finansial, setFinansial] = useState<any[]>([]);
  const [opkom, setOpkom] = useState<any[]>([]);
  const [peralatan, setPeralatan] = useState<any[]>([]);
  const [kinerja, setKinerja] = useState<any[]>([]);
  const [utilisasi, setUtilisasi] = useState<any[]>([]);
  const [kpiRecords, setKpiRecords] = useState<any[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(isBodViewer);
  const [verificationSummary, setVerificationSummary] = useState<{
    verifiedCount: number;
    pendingCount: number;
    revisionCount: number;
  }>({ verifiedCount: 0, pendingCount: 0, revisionCount: 0 });

  useEffect(() => {
    setVerifiedOnly(userRole === 'viewer' || currentUser?.role === 'viewer');
  }, [userRole, currentUser?.role]);

  useEffect(() => {
    const abortController = new AbortController();
    async function loadData() {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams();
        if (selectedPeriod) {
          queryParams.append('period', selectedPeriod);
        }
        queryParams.append('verifiedOnly', String(verifiedOnly));
        const res = await fetch(`/api/modules-data?${queryParams.toString()}`, {
          credentials: 'include',
          signal: abortController.signal,
        });
        const json = await res.json();
        if (json.success) {
          setFinansial(json.finansial || []);
          setOpkom(json.opkom || []);
          setPeralatan(json.peralatan || []);
          setKinerja(json.kinerja || []);
          setUtilisasi(json.utilisasi || []);
          setKpiRecords(json.kpiRecords || []);
          if (json.verificationSummary) {
            setVerificationSummary(json.verificationSummary);
          }
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('Error loading beranda data:', e);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => abortController.abort();
  }, [selectedPeriod, verifiedOnly]);

  const isPicCabang =
    userRole === 'pic_cabang' ||
    (currentUser?.role === 'pic_cabang' && !!currentUser?.branch_id && currentUser.branch_id !== 'R99');
  const assignedBranch = currentUser?.branch_id
    ? OFFICIAL_BRANCHES.find((b) => b.code === currentUser?.branch_id)
    : undefined;
  const isNone = !isPicCabang && selectedTerminal === 'NONE';
  const isAll = !isPicCabang && (!selectedTerminal || selectedTerminal === 'ALL');

  const selectedCodes = useMemo(() => {
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      return [currentUser.branch_id];
    }
    if (isNone) return [];
    if (isAll) return OFFICIAL_BRANCHES.map((b) => b.code);
    return parseSelectedBranches(selectedTerminal);
  }, [isPicCabang, currentUser?.branch_id, isNone, isAll, selectedTerminal]);

  const isSingle = isPicCabang || (!isAll && !isNone && selectedCodes.length === 1);
  const isMulti = !isPicCabang && !isAll && !isNone && selectedCodes.length > 1;

  const activeBranch = useMemo(() => {
    if (isPicCabang && currentUser?.branch_id) {
      return assignedBranch || getBranchByCode(currentUser.branch_id) || null;
    }
    if (!isSingle) return null;
    return getBranchByCode(selectedCodes[0]) || OFFICIAL_BRANCHES.find((b) => b.code === selectedCodes[0]);
  }, [isPicCabang, currentUser?.branch_id, assignedBranch, isSingle, selectedCodes]);

  const filteredFin = useMemo(() => {
    if (isNone) return [];
    if (isAll) return finansial;
    return finansial.filter((f) => isBranchMatch(selectedTerminal, f.branchCode, f.branchName));
  }, [isNone, isAll, selectedTerminal, finansial]);

  const filteredOpkom = useMemo(() => {
    if (isNone) return [];
    if (isAll) return opkom;
    return opkom.filter((o) => isBranchMatch(selectedTerminal, o.branchCode, o.branchName));
  }, [isNone, isAll, selectedTerminal, opkom]);

  const filteredPeralatan = useMemo(() => {
    if (isNone) return [];
    if (isAll) return peralatan;
    return peralatan.filter((p) => isBranchMatch(selectedTerminal, p.branchCode, p.branchName));
  }, [isNone, isAll, selectedTerminal, peralatan]);

  const filteredKinerja = useMemo(() => {
    if (isNone) return [];
    if (isAll) return kinerja;
    return kinerja.filter((k) => isBranchMatch(selectedTerminal, k.branchCode, k.branchName));
  }, [isNone, isAll, selectedTerminal, kinerja]);

  const filteredUtilisasi = useMemo(() => {
    if (isNone) return [];
    if (isAll) return utilisasi;
    return utilisasi.filter((u) => isBranchMatch(selectedTerminal, u.branchCode, u.branchName));
  }, [isNone, isAll, selectedTerminal, utilisasi]);

  const filteredKpiRecords = useMemo(() => {
    if (isNone) return [];
    if (isAll) return kpiRecords;
    return kpiRecords.filter((r) => isBranchMatch(selectedTerminal, r.branchCode, r.branchName));
  }, [isNone, isAll, selectedTerminal, kpiRecords]);

  const serviceKpis: BerandaKpiItem[] = useMemo(() => {
    if (isNone) {
      return ['Kapal (GT)', 'Petikemas (TEUs)', 'Barang (ton)', 'Penumpang (orang)', 'Rupa-rupa usaha'].map(
        (title) => ({
          title,
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Cabang Kosong',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '-',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        })
      );
    }

    const formatVolume = (
      val: number | null,
      unit: string,
      suffixJt: string = `jt ${unit}`,
      suffixRb: string = `rb ${unit}`
    ) => {
      if (val === null) return 'Belum Lapor';
      if (val === 0) return `0 ${unit}`;
      if (val >= 1_000_000) {
        return `${(val / 1_000_000).toLocaleString('id-ID', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${suffixJt}`;
      }
      if (val >= 1_000) {
        return `${(val / 1_000).toLocaleString('id-ID', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} ${suffixRb}`;
      }
      return `${val.toLocaleString('id-ID')} ${unit}`;
    };

    const buildServiceMetric = (
      title: string,
      rows: any[],
      unit: string,
      isRupiah = false,
      suffixJt?: string,
      suffixRb?: string
    ): BerandaKpiItem => {
      const hasData = rows.length > 0;
      const hasPending = rows.some((r) => r.verificationStatus === 'pending_verification' || r.hasPendingUpdate);
      if (!hasData) {
        return {
          title,
          value: 'Belum Lapor',
          fullValue: 'Belum Lapor',
          comp1: 'RKAP: Belum Lapor',
          comp1Good: false,
          comp2: 'YoY: Tidak Tersedia',
          comp2Good: false,
          rawTarget: 'Belum Lapor',
          rawRealization: 'Belum Lapor',
          hasData: false,
          hasPending: false,
        };
      }

      const totalVal = rows.reduce((a, b) => a + Number(b.jumlahRp ?? 0), 0);
      const avgRka = rows.reduce((a, b) => a + Number(b.rka ?? 0), 0) / rows.length;
      const avgYoy = rows.reduce((a, b) => a + Number(b.yoy ?? 0), 0) / rows.length;
      const rkaStr = avgRka.toFixed(1);
      const yoyDiff = (avgYoy - 100).toFixed(1);
      const targetVal = avgRka > 0 ? Math.round(totalVal / (avgRka / 100)) : totalVal;

      const compactVal = isRupiah
        ? totalVal === 0
          ? 'Rp 0'
          : formatRupiahCompact(totalVal)
        : formatVolume(totalVal, unit, suffixJt, suffixRb);

      const fullVal = isRupiah
        ? totalVal === 0
          ? 'Rp 0'
          : formatRupiahFull(totalVal)
        : `${Math.round(totalVal).toLocaleString('id-ID')} ${unit}`;

      const formattedTarget = isRupiah
        ? targetVal === 0
          ? 'Rp 0'
          : formatRupiahFull(targetVal)
        : formatVolume(targetVal, unit, suffixJt, suffixRb);

      return {
        title,
        value: compactVal,
        fullValue: fullVal,
        comp1: `RKAP ${rkaStr}%`,
        comp1Good: avgRka >= 100,
        comp2: `YoY ${avgYoy >= 100 ? '+' : ''}${yoyDiff}%`,
        comp2Good: avgYoy >= 100,
        rawTarget: formattedTarget,
        rawRealization: fullVal,
        hasData: true,
        hasPending,
      };
    };

    const kapalGtRows = filteredOpkom.filter((o) => {
      const lay = (o.layanan || '').toUpperCase();
      const sat = (o.satuan || '').toUpperCase();
      return lay.includes('KAPAL') && sat.includes('GT');
    });

    const teusRows = filteredOpkom.filter((o) => {
      const lay = (o.layanan || '').toUpperCase();
      const sat = (o.satuan || '').toUpperCase();
      return lay.includes('PETIKEMAS') && sat.includes('TEUS');
    });

    const tonRows = filteredOpkom.filter((o) => {
      const lay = (o.layanan || '').toUpperCase();
      const sat = (o.satuan || '').toUpperCase();
      return lay.includes('BARANG') && sat.includes('TON');
    });

    const pnpRows = filteredOpkom.filter((o) => {
      const lay = (o.layanan || '').toUpperCase();
      const sat = (o.satuan || '').toUpperCase();
      return lay.includes('PENUMPANG') && sat.includes('ORANG');
    });

    const rupaRows = filteredOpkom.filter((o) => {
      const lay = (o.layanan || '').toUpperCase();
      return lay.includes('RUPA');
    });

    return [
      buildServiceMetric('Kapal (GT)', kapalGtRows, 'GT', false, 'jt GT', 'rb GT'),
      buildServiceMetric('Petikemas (TEUs)', teusRows, 'TEUs', false, 'jt', 'rb TEUs'),
      buildServiceMetric('Barang (ton)', tonRows, 'ton', false, 'jt', 'rb ton'),
      buildServiceMetric('Penumpang (orang)', pnpRows, 'org', false, 'jt org', 'rb org'),
      buildServiceMetric('Rupa-rupa usaha', rupaRows, 'Rp', true),
    ];
  }, [filteredOpkom, isNone]);

  const financeKpis: BerandaKpiItem[] = useMemo(() => {
    if (isNone) {
      return [
        {
          title: 'Pendapatan',
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Cabang Kosong',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '-',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        },
        {
          title: 'Beban biaya',
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Cabang Kosong',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '-',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        },
        {
          title: 'Laba usaha',
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Cabang Kosong',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '-',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        },
        {
          title: 'Kesiapan alat',
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Target 92,0%',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '92,0%',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        },
        {
          title: 'SLA keluhan',
          value: 'Belum Dipilih',
          fullValue: 'Belum Dipilih',
          comp1: 'Target 90,0%',
          comp1Good: false,
          comp2: 'Pilih cabang',
          comp2Good: false,
          rawTarget: '90,0%',
          rawRealization: '-',
          hasData: false,
          hasPending: false,
        },
      ];
    }

    const buildFinMetric = (title: string, rows: any[], isCostAccount = false): BerandaKpiItem => {
      const hasData = rows.length > 0;
      const hasPending = rows.some((r) => r.verificationStatus === 'pending_verification' || r.hasPendingUpdate);
      if (!hasData) {
        return {
          title,
          value: 'Belum Lapor',
          fullValue: 'Belum Lapor',
          comp1: 'RKAP: Belum Lapor',
          comp1Good: false,
          comp2: 'YoY: Tidak Tersedia',
          comp2Good: false,
          rawTarget: 'Belum Lapor',
          rawRealization: 'Belum Lapor',
          hasData: false,
          hasPending: false,
        };
      }

      const rawSum = rows.reduce((a, b) => a + Number(b.konsolidasiRp ?? 0), 0);
      const totalRp = isCostAccount ? Math.abs(rawSum) : rawSum;
      const avgRka = rows.reduce((a, b) => a + Number(b.rka ?? 0), 0) / rows.length;
      const avgYoy = rows.reduce((a, b) => a + Number(b.yoy ?? 0), 0) / rows.length;
      const rkaStr = avgRka.toFixed(1);
      const yoyDiff = (avgYoy - 100).toFixed(1);
      const targetRp = avgRka > 0 ? Math.round(totalRp / (avgRka / 100)) : totalRp;

      const compactVal = totalRp === 0 ? 'Rp 0' : formatRupiahCompact(totalRp);
      const fullVal = totalRp === 0 ? 'Rp 0' : formatRupiahFull(totalRp);
      const formattedTarget = targetRp === 0 ? 'Rp 0' : formatRupiahFull(targetRp);

      return {
        title,
        value: compactVal,
        fullValue: fullVal,
        comp1: `RKAP ${rkaStr}%`,
        comp1Good: isCostAccount ? avgRka <= 100 : avgRka >= 100,
        comp2: `YoY ${avgYoy >= 100 ? '+' : ''}${yoyDiff}%`,
        comp2Good: isCostAccount ? avgYoy <= 100 : avgYoy >= 100,
        rawTarget: formattedTarget,
        rawRealization: fullVal,
        hasData: true,
        hasPending,
      };
    };

    const revRows = filteredFin.filter((f) => (f.rekening || '').toLowerCase().includes('pendapatan'));
    const costRows = filteredFin.filter((f) => (f.rekening || '').toLowerCase().includes('beban'));
    const opRows = filteredFin.filter((f) => (f.rekening || '').toLowerCase() === 'laba usaha');

    const validAvailAlat = filteredPeralatan.filter((p) => Number(p.availability || 0) > 0);
    const rfuKpiRows = filteredKpiRecords.filter((r) => r.indicatorId === 'kpi_rfu');
    let alatMetric: BerandaKpiItem;

    if (validAvailAlat.length > 0) {
      const avgAlatVal =
        validAvailAlat.reduce((a, b) => a + Number(b.availability || 0), 0) / validAvailAlat.length;
      const avgAlatStr = avgAlatVal.toFixed(1);
      alatMetric = {
        title: 'Kesiapan alat',
        value: `${avgAlatStr}%`,
        fullValue: `${avgAlatStr}%`,
        comp1: 'Target 92,0%',
        comp1Good: avgAlatVal >= 92,
        comp2: `Capaian ${((avgAlatVal / 92) * 100).toFixed(1)}%`,
        comp2Good: avgAlatVal >= 92,
        rawTarget: '92,0%',
        rawRealization: `${avgAlatStr}%`,
        hasData: true,
        hasPending: validAvailAlat.some(
          (p) => p.verificationStatus === 'pending_verification' || p.hasPendingUpdate
        ),
      };
    } else if (rfuKpiRows.length > 0) {
      const avgRfuVal = rfuKpiRows.reduce((a, b) => a + Number(b.realization || 0), 0) / rfuKpiRows.length;
      const avgTargetVal = rfuKpiRows.reduce((a, b) => a + Number(b.target || 92), 0) / rfuKpiRows.length;
      const avgRfuStr = avgRfuVal.toFixed(1);
      alatMetric = {
        title: 'Kesiapan alat',
        value: `${avgRfuStr}%`,
        fullValue: `${avgRfuStr}%`,
        comp1: `Target ${avgTargetVal.toFixed(1)}%`,
        comp1Good: avgRfuVal >= avgTargetVal,
        comp2: `Capaian ${((avgRfuVal / (avgTargetVal || 92)) * 100).toFixed(1)}%`,
        comp2Good: avgRfuVal >= avgTargetVal,
        rawTarget: `${avgTargetVal.toFixed(1)}%`,
        rawRealization: `${avgRfuStr}%`,
        hasData: true,
        hasPending: rfuKpiRows.some((r) => r.verificationStatus === 'pending_verification'),
      };
    } else {
      alatMetric = {
        title: 'Kesiapan alat',
        value: 'Belum Lapor',
        fullValue: 'Belum Lapor',
        comp1: 'Target 92,0%',
        comp1Good: false,
        comp2: 'Data RFU belum dilaporkan',
        comp2Good: false,
        rawTarget: '92,0%',
        rawRealization: 'Belum Lapor',
        hasData: false,
        hasPending: false,
      };
    }

    const slaKpiRows = filteredKpiRecords.filter((r) => r.indicatorId === 'kpi_sla');
    let slaMetric: BerandaKpiItem;
    if (slaKpiRows.length > 0) {
      const avgSlaVal = slaKpiRows.reduce((a, b) => a + Number(b.realization || 0), 0) / slaKpiRows.length;
      const avgTargetVal = slaKpiRows.reduce((a, b) => a + Number(b.target || 90), 0) / slaKpiRows.length;
      const avgSlaStr = avgSlaVal.toFixed(1);
      slaMetric = {
        title: 'SLA keluhan',
        value: `${avgSlaStr}%`,
        fullValue: `${avgSlaStr}%`,
        comp1: `Target ${avgTargetVal.toFixed(1)}%`,
        comp1Good: avgSlaVal >= avgTargetVal,
        comp2: `Capaian ${((avgSlaVal / (avgTargetVal || 90)) * 100).toFixed(1)}%`,
        comp2Good: avgSlaVal >= avgTargetVal,
        rawTarget: `${avgTargetVal.toFixed(1)}%`,
        rawRealization: `${avgSlaStr}%`,
        hasData: true,
        hasPending: slaKpiRows.some((r) => r.verificationStatus === 'pending_verification'),
      };
    } else {
      slaMetric = {
        title: 'SLA keluhan',
        value: 'Belum Lapor',
        fullValue: 'Belum Lapor',
        comp1: 'Target 90,0%',
        comp1Good: false,
        comp2: 'Data SLA belum dilaporkan',
        comp2Good: false,
        rawTarget: '90,0%',
        rawRealization: 'Belum Lapor',
        hasData: false,
        hasPending: false,
      };
    }

    return [
      buildFinMetric('Pendapatan', revRows, false),
      buildFinMetric('Beban biaya', costRows, true),
      buildFinMetric('Laba usaha', opRows, false),
      alatMetric,
      slaMetric,
    ];
  }, [filteredFin, filteredPeralatan, filteredKpiRecords, isNone]);

  const topKpis = useMemo(() => [...serviceKpis, ...financeKpis], [serviceKpis, financeKpis]);

  const terminalsOverview = useMemo(() => {
    const branchesSource =
      isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99'
        ? OFFICIAL_BRANCHES.filter((b) => b.code === currentUser.branch_id)
        : OFFICIAL_BRANCHES;

    return branchesSource.map((branchInfo) => {
      const code = branchInfo.code;
      const bOp = opkom.filter((o) => o.branchCode === code);
      const bFin = finansial.filter((f) => f.branchCode === code);

      const teusRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TEUS'));
      const tonRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TON'));
      const revRows = bFin.filter((f) => (f.rekening || '').toLowerCase().includes('pendapatan'));

      const hasAnyData = bOp.length > 0 || bFin.length > 0;
      const hasPending =
        bOp.some((o) => o.verificationStatus === 'pending_verification' || o.hasPendingUpdate) ||
        bFin.some((f) => f.verificationStatus === 'pending_verification' || f.hasPendingUpdate);

      const teusTotal = teusRows.reduce((a, b) => a + (b.jumlahRp || 0), 0);
      const tonTotal = tonRows.reduce((a, b) => a + (b.jumlahRp || 0), 0);
      const revTotal = revRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0);

      const avgRka =
        bOp.length > 0
          ? Number((bOp.reduce((a, b) => a + (b.rka || 0), 0) / bOp.length).toFixed(1))
          : revRows.length > 0
            ? Number((revRows.reduce((a, b) => a + (b.rka || 0), 0) / revRows.length).toFixed(1))
            : null;
      const avgYoy =
        bOp.length > 0
          ? Number((bOp.reduce((a, b) => a + (b.yoy || 0), 0) / bOp.length).toFixed(1))
          : revRows.length > 0
            ? Number((revRows.reduce((a, b) => a + (b.yoy || 0), 0) / revRows.length).toFixed(1))
            : null;

      let subtype = 'Multipurpose';
      if (
        code === 'R02' ||
        code === 'R06' ||
        code === 'R07' ||
        code === 'R08' ||
        branchInfo.name.toLowerCase().includes('tpk')
      ) {
        subtype = 'Petikemas';
      } else if (code === 'R24') {
        subtype = 'Petikemas Modern';
      } else if (code === 'R26') {
        subtype = 'Petikemas (KKT)';
      } else if (code === 'R99') {
        subtype = 'Regional 4 (Konsolidasi)';
      }

      let valueDisplay = 'Belum Lapor';
      let fullValueDisplay = 'Belum Lapor';
      if (revRows.length > 0) {
        valueDisplay = revTotal === 0 ? 'Rp 0' : formatRupiahCompact(revTotal);
        fullValueDisplay = revTotal === 0 ? 'Rp 0' : formatRupiahFull(revTotal);
      } else if (teusRows.length > 0) {
        valueDisplay =
          teusTotal === 0
            ? '0 TEUs'
            : teusTotal >= 1_000_000
              ? `${(teusTotal / 1_000_000).toFixed(2)} jt TEUs`
              : `${(teusTotal / 1_000).toFixed(1)} rb TEUs`;
        fullValueDisplay = `${Math.round(teusTotal).toLocaleString('id-ID')} TEUs`;
      } else if (tonRows.length > 0) {
        valueDisplay =
          tonTotal === 0
            ? '0 ton'
            : tonTotal >= 1_000_000
              ? `${(tonTotal / 1_000_000).toFixed(2)} jt ton`
              : `${(tonTotal / 1_000).toFixed(1)} rb ton`;
        fullValueDisplay = `${Math.round(tonTotal).toLocaleString('id-ID')} ton`;
      } else if (bOp.length > 0) {
        const totalOpkomRp = bOp
          .filter((o) => o.satuan === 'Rp')
          .reduce((a, b) => a + (b.jumlahRp || 0), 0);
        valueDisplay = totalOpkomRp === 0 ? 'Rp 0' : formatRupiahCompact(totalOpkomRp);
        fullValueDisplay = totalOpkomRp === 0 ? 'Rp 0' : formatRupiahFull(totalOpkomRp);
      }

      const isGood = avgRka !== null ? avgRka >= 100 : false;

      return {
        id: code,
        code,
        name: branchInfo.name || code,
        subtype,
        status: !hasAnyData ? 'Belum Lapor' : isGood ? 'Baik' : 'Waspada',
        value: valueDisplay,
        fullValue: fullValueDisplay,
        rkap: avgRka !== null ? `RKAP ${avgRka}%` : 'RKAP: -',
        yoy: avgYoy !== null ? `YoY ${avgYoy >= 100 ? '+' : ''}${(avgYoy - 100).toFixed(1)}%` : 'YoY: -',
        isGood,
        hasData: hasAnyData,
        hasPending,
      };
    });
  }, [opkom, finansial, isPicCabang, currentUser?.branch_id]);

  const filteredTerminalsOverview = useMemo(() => {
    if (isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99') {
      return terminalsOverview.filter((t) => t.code === currentUser.branch_id);
    }
    if (isNone) return [];
    let list = terminalsOverview;
    if (!isAll) {
      list = terminalsOverview.filter((t) => isBranchMatch(selectedTerminal, t.code, t.name));
    }
    if (!terminalSearch.trim()) return list;
    const q = terminalSearch.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.subtype.toLowerCase().includes(q)
    );
  }, [
    terminalsOverview,
    terminalSearch,
    isNone,
    isAll,
    selectedTerminal,
    isPicCabang,
    currentUser?.branch_id,
  ]);

  const selectedBranchesMetrics = useMemo(() => {
    if (isNone) return [];
    const targetCodes =
      isPicCabang && currentUser?.branch_id && currentUser.branch_id !== 'R99'
        ? [currentUser.branch_id]
        : isAll
          ? OFFICIAL_BRANCHES.map((b) => b.code)
          : selectedCodes;

    return targetCodes.map((code) => {
      const bInfo =
        getBranchByCode(code) || OFFICIAL_BRANCHES.find((b) => b.code === code) || { code, name: code };
      const bOp = opkom.filter((o) => o.branchCode === code);
      const bFin = finansial.filter((f) => f.branchCode === code);
      const bAlat = peralatan.filter((p) => p.branchCode === code);
      const bUtil = utilisasi.filter((u) => u.branchCode === code);
      const bKpi = kpiRecords.filter((r) => r.branchCode === code);

      const revRows = bFin.filter((f) => (f.rekening || '').toLowerCase().includes('pendapatan'));
      const opRpRows = bOp.filter((o) => o.satuan === 'Rp');
      const revTotal =
        revRows.length > 0
          ? revRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0)
          : opRpRows.length > 0
            ? opRpRows.reduce((a, b) => a + (b.jumlahRp || 0), 0)
            : null;

      const opRows = bFin.filter((f) => (f.rekening || '').toLowerCase() === 'laba usaha');
      const opTotal =
        opRows.length > 0 ? opRows.reduce((a, b) => a + (b.konsolidasiRp || 0), 0) : null;

      const teusRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TEUS'));
      const teusTotal = teusRows.length > 0 ? teusRows.reduce((a, b) => a + (b.jumlahRp || 0), 0) : null;

      const tonRows = bOp.filter((o) => (o.satuan || '').toUpperCase().includes('TON'));
      const tonTotal = tonRows.length > 0 ? tonRows.reduce((a, b) => a + (b.jumlahRp || 0), 0) : null;

      const avgRka =
        bOp.length > 0
          ? Number((bOp.reduce((a, b) => a + (b.rka || 0), 0) / bOp.length).toFixed(1))
          : revRows.length > 0
            ? Number((revRows.reduce((a, b) => a + (b.rka || 0), 0) / revRows.length).toFixed(1))
            : null;
      const avgYoy =
        bOp.length > 0
          ? Number((bOp.reduce((a, b) => a + (b.yoy || 0), 0) / bOp.length).toFixed(1))
          : revRows.length > 0
            ? Number((revRows.reduce((a, b) => a + (b.yoy || 0), 0) / revRows.length).toFixed(1))
            : null;

      const validAlat = bAlat.filter((p) => (p.availability || 0) > 0);
      const rfuRows = bKpi.filter((r) => r.indicatorId === 'kpi_rfu');
      const rfu =
        validAlat.length > 0
          ? (validAlat.reduce((a, b) => a + (b.availability || 0), 0) / validAlat.length).toFixed(1)
          : rfuRows.length > 0
            ? (rfuRows.reduce((a, b) => a + (b.realization || 0), 0) / rfuRows.length).toFixed(1)
            : null;

      const bor = bUtil.length > 0 ? (bUtil[0].bor ?? 0) : null;

      const isGood = avgRka !== null ? avgRka >= 100 : false;
      const hasData = bOp.length > 0 || bFin.length > 0;

      return {
        code,
        name: bInfo.name,
        revTotal,
        opTotal,
        teusTotal,
        tonTotal,
        avgRka,
        avgYoy,
        rfu,
        bor,
        isGood,
        hasData,
      };
    });
  }, [
    isNone,
    isAll,
    selectedCodes,
    opkom,
    finansial,
    peralatan,
    utilisasi,
    kpiRecords,
    isPicCabang,
    currentUser?.branch_id,
  ]);

  const branchCommoditiesBreakdown = useMemo(() => {
    if (!isSingle) return [];

    const groups: Record<string, { jumlah: number; satuan: string; rka: number[]; yoy: number[] }> = {};
    const targetRows = filteredOpkom.some((o) => o.satuan === 'Rp')
      ? filteredOpkom.filter((o) => o.satuan === 'Rp')
      : filteredOpkom;

    targetRows.forEach((o) => {
      const lay = o.layanan || 'LAINNYA';
      if (!groups[lay]) {
        groups[lay] = { jumlah: 0, satuan: o.satuan || 'Rp', rka: [], yoy: [] };
      }
      groups[lay].jumlah += o.jumlahRp || 0;
      if (o.rka) groups[lay].rka.push(o.rka);
      if (o.yoy) groups[lay].yoy.push(o.yoy);
    });

    return Object.keys(groups).map((lay) => {
      const item = groups[lay];
      const avgRka =
        item.rka.length > 0
          ? Number((item.rka.reduce((a, b) => a + b, 0) / item.rka.length).toFixed(1))
          : 100.0;
      const avgYoy =
        item.yoy.length > 0
          ? Number((item.yoy.reduce((a, b) => a + b, 0) / item.yoy.length).toFixed(1))
          : 100.0;
      const isGood = avgRka >= 100;

      let formattedVal = `${item.jumlah.toLocaleString('id-ID')} ${item.satuan}`;
      let fullVal = formattedVal;
      if (item.satuan === 'Rp') {
        formattedVal = formatRupiahCompact(item.jumlah);
        fullVal = formatRupiahFull(item.jumlah);
      }

      return {
        layanan: lay,
        satuan: item.satuan,
        value: formattedVal,
        fullValue: fullVal,
        rkap: `RKAP ${avgRka}%`,
        yoy: `YoY ${avgYoy >= 100 ? '+' : ''}${(avgYoy - 100).toFixed(1)}%`,
        isGood,
      };
    });
  }, [isSingle, filteredOpkom]);

  const attentionItems = useMemo(() => {
    const alerts: {
      header: string;
      desc: string;
      sourceSheet: string;
      sourceModule: string;
      tabId: string;
      branchCode: string;
      linkText: string;
    }[] = [];

    const lowOpkom = [...filteredOpkom]
      .filter((o) => Number(o.rka || 0) > 0 && Number(o.rka || 0) < 95)
      .sort((a, b) => Number(a.rka || 0) - Number(b.rka || 0))
      .slice(0, 3);

    lowOpkom.forEach((o) => {
      alerts.push({
        header: `${o.branchName || o.branchCode} [${o.branchCode}] - ${o.layanan}`,
        desc: `Realisasi ${o.layanan} (${o.satuan}) mencapai ${o.rka}% RKAP, pertumbuhan ${(Number(o.yoy || 100) - 100).toFixed(1)}% YoY.`,
        sourceSheet: 'module_opkom',
        sourceModule: 'Operasi & Komersial',
        tabId: 'opkom',
        branchCode: o.branchCode,
        linkText: `Buka Data Opkom [${o.branchCode}]`,
      });
    });

    const lowAlat = filteredPeralatan.find(
      (p) => Number(p.jumlah || 0) > 0 && Number(p.utilisasi || 0) > 0 && Number(p.utilisasi || 0) < 50
    );
    if (lowAlat) {
      alerts.push({
        header: `${lowAlat.branchName || lowAlat.branchCode} [${lowAlat.branchCode}] - ${lowAlat.nmAlat || lowAlat.kdAlat}`,
        desc: `Utilisasi ${lowAlat.singkatan || lowAlat.kdAlat} tercatat ${lowAlat.utilisasi}% (${lowAlat.jumlah} unit operasional).`,
        sourceSheet: 'module_peralatan',
        sourceModule: 'Peralatan Pelabuhan',
        tabId: 'peralatan',
        branchCode: lowAlat.branchCode,
        linkText: `Buka Data Peralatan [${lowAlat.branchCode}]`,
      });
    }

    if (verificationSummary.pendingCount > 0) {
      alerts.push({
        header: `Antrean Verifikasi Data (${verificationSummary.pendingCount} Rekaman)`,
        desc: `Terdapat ${verificationSummary.pendingCount} rekaman input manual/impor yang berstatus Menunggu Verifikasi Admin Regional.`,
        sourceSheet: 'monthly_records',
        sourceModule: 'Antrean Verifikasi',
        tabId: 'verification',
        branchCode: isAll ? 'ALL' : selectedTerminal,
        linkText: 'Buka Antrean Verifikasi',
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        header: `${isAll ? 'Regional 4 Konsolidasi' : activeBranch?.name || selectedTerminal} Terkendali`,
        desc: 'Seluruh indikator layanan yang dilaporkan pada periode ini memenuhi ambang target RKAP.',
        sourceSheet: 'module_opkom',
        sourceModule: 'Operasi & Komersial',
        tabId: 'opkom',
        branchCode: isAll ? 'ALL' : selectedTerminal,
        linkText: 'Periksa Data Opkom',
      });
    }

    return alerts.slice(0, 4);
  }, [
    isAll,
    activeBranch,
    selectedTerminal,
    filteredOpkom,
    filteredPeralatan,
    verificationSummary.pendingCount,
  ]);

  const mainCombinedChartData = useMemo(() => {
    const parseNominalMiliar = (valStr: string) => {
      if (!valStr || valStr === 'Belum Lapor' || valStr === 'Belum Dipilih' || valStr === '-') return 0;
      const digits = valStr.replace(/[^\d]/g, '');
      if (!digits) return 0;
      const num = Number(digits);
      return Math.round(num / 1_000_000_000);
    };

    const parsePercent = (str: string) => {
      if (!str || str.includes('Belum Lapor') || str.includes('Tidak Tersedia')) return 0;
      const m = str.match(/[-+]?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    };

    const rev = financeKpis[0];
    const cost = financeKpis[1];
    const profit = financeKpis[2];

    return [
      {
        kpi: 'Pendapatan',
        nominalRealisasi: parseNominalMiliar(rev?.rawRealization || '0'),
        nominalTarget: parseNominalMiliar(rev?.rawTarget || '0'),
        capaianRkap: parsePercent(rev?.comp1 || '0'),
        pertumbuhanYoy: parsePercent(rev?.comp2 || '0'),
        satuan: 'Miliar Rp',
        isGood: rev?.comp1Good ?? false,
      },
      {
        kpi: 'Beban Biaya',
        nominalRealisasi: parseNominalMiliar(cost?.rawRealization || '0'),
        nominalTarget: parseNominalMiliar(cost?.rawTarget || '0'),
        capaianRkap: parsePercent(cost?.comp1 || '0'),
        pertumbuhanYoy: parsePercent(cost?.comp2 || '0'),
        satuan: 'Miliar Rp',
        isGood: cost?.comp1Good ?? false,
      },
      {
        kpi: 'Laba Usaha',
        nominalRealisasi: parseNominalMiliar(profit?.rawRealization || '0'),
        nominalTarget: parseNominalMiliar(profit?.rawTarget || '0'),
        capaianRkap: parsePercent(profit?.comp1 || '0'),
        pertumbuhanYoy: parsePercent(profit?.comp2 || '0'),
        satuan: 'Miliar Rp',
        isGood: profit?.comp1Good ?? false,
      },
    ];
  }, [financeKpis]);

  const gaugeMetrics = useMemo(() => {
    const parsePercent = (str: string) => {
      if (!str || str.includes('Belum Lapor') || str.includes('Tidak Tersedia')) return 0;
      const m = str.match(/[-+]?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    };

    const rev = financeKpis[0];
    const cost = financeKpis[1];
    const profit = financeKpis[2];
    const rfu = financeKpis[3];

    const rfuHasData = Boolean(rfu?.hasData);
    const rfuVal = rfuHasData ? parseFloat((rfu?.value || '0').replace(/[^\d.]/g, '')) || 0 : 0;

    return [
      {
        title: 'Pendapatan Usaha',
        realisasi: rev?.value || 'Belum Lapor',
        fullRealisasi: rev?.fullValue || rev?.rawRealization || 'Belum Lapor',
        percentage: parsePercent(rev?.comp1 || '0'),
        target:
          rev?.rawTarget && rev.rawTarget !== 'Belum Lapor'
            ? `Target: ${rev.rawTarget}`
            : 'Target: Belum Lapor',
        yoy: rev?.comp2 || 'YoY: -',
        isGood: rev?.comp1Good ?? false,
        color: '#0284c7',
      },
      {
        title: 'Pengendalian Biaya',
        realisasi: cost?.value || 'Belum Lapor',
        fullRealisasi: cost?.fullValue || cost?.rawRealization || 'Belum Lapor',
        percentage: parsePercent(cost?.comp1 || '0'),
        target:
          cost?.rawTarget && cost.rawTarget !== 'Belum Lapor'
            ? `Target: ${cost.rawTarget}`
            : 'Target: Belum Lapor',
        yoy: cost?.comp2 || 'YoY: -',
        isGood: cost?.comp1Good ?? false,
        color: '#38bdf8',
      },
      {
        title: 'Laba Usaha',
        realisasi: profit?.value || 'Belum Lapor',
        fullRealisasi: profit?.fullValue || profit?.rawRealization || 'Belum Lapor',
        percentage: parsePercent(profit?.comp1 || '0'),
        target:
          profit?.rawTarget && profit.rawTarget !== 'Belum Lapor'
            ? `Target: ${profit.rawTarget}`
            : 'Target: Belum Lapor',
        yoy: profit?.comp2 || 'YoY: -',
        isGood: profit?.comp1Good ?? false,
        color: '#10b981',
      },
      {
        title: 'Kesiapan Alat (RFU)',
        realisasi: rfuHasData ? `${rfuVal}%` : 'Belum Lapor',
        fullRealisasi: rfuHasData ? `${rfuVal}%` : 'Belum Lapor',
        percentage: rfuHasData ? Number(((rfuVal / 92) * 100).toFixed(1)) : 0,
        target: 'Target 92,0% RFU',
        yoy: rfu?.comp2 || 'Belum Lapor',
        isGood: rfuHasData && rfuVal >= 92,
        color: '#f59e0b',
      },
    ];
  }, [financeKpis]);

  const servicesGroupedChartData = useMemo(() => {
    const parsePercent = (str: string) => {
      if (!str || str.includes('Belum Lapor') || str.includes('Tidak Tersedia')) return 0;
      const m = str.match(/[-+]?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    };

    const validBorRows = filteredUtilisasi.filter((u) => Number(u.bor || 0) > 0);
    const avgBorVal =
      validBorRows.length > 0
        ? Number(
            (validBorRows.reduce((a, b) => a + Number(b.bor || 0), 0) / validBorRows.length).toFixed(1)
          )
        : null;

    if (isSingle && branchCommoditiesBreakdown.length > 0) {
      const list = branchCommoditiesBreakdown.map((c) => {
        const rkapPct = parsePercent(c.rkap);
        const yoyPct = parsePercent(c.yoy);
        return {
          layanan: c.layanan.toUpperCase(),
          nominal: c.value,
          fullNominal: c.fullValue,
          capaianRkap: rkapPct,
          pertumbuhanYoy: yoyPct,
          status: c.isGood ? 'Baik' : 'Waspada',
          satuan: c.satuan,
        };
      });

      if (avgBorVal !== null) {
        list.push({
          layanan: 'DERMAGA (BOR)',
          nominal: `${avgBorVal}%`,
          fullNominal: `${avgBorVal}%`,
          capaianRkap: avgBorVal,
          pertumbuhanYoy: 0,
          status: avgBorVal <= 65 ? 'Baik' : 'Waspada',
          satuan: '%',
        });
      }
      return list;
    }

    const baseList = serviceKpis.map((k) => {
      const rkapPct = parsePercent(k.comp1);
      const yoyPct = parsePercent(k.comp2);
      return {
        layanan: k.title.split(' ')[0].toUpperCase(),
        nominal: k.value,
        fullNominal: k.fullValue || k.value,
        capaianRkap: rkapPct,
        pertumbuhanYoy: yoyPct,
        status: k.comp1Good ? 'Baik' : 'Waspada',
        satuan: k.title.includes('(') ? k.title.split('(')[1].replace(')', '') : '',
      };
    });

    if (avgBorVal !== null) {
      baseList.push({
        layanan: 'BOR DERMAGA',
        nominal: `${avgBorVal}%`,
        fullNominal: `${avgBorVal}%`,
        capaianRkap: Number(((avgBorVal / 60) * 100).toFixed(1)),
        pertumbuhanYoy: 0,
        status: avgBorVal <= 65 ? 'Baik' : 'Waspada',
        satuan: '%',
      });
    } else {
      baseList.push({
        layanan: 'BOR DERMAGA',
        nominal: 'Belum Lapor',
        fullNominal: 'Belum Lapor',
        capaianRkap: 0,
        pertumbuhanYoy: 0,
        status: 'Waspada',
        satuan: '%',
      });
    }

    return baseList;
  }, [isSingle, branchCommoditiesBreakdown, serviceKpis, filteredUtilisasi]);

  return {
    loading,
    verifiedOnly,
    setVerifiedOnly,
    verificationSummary,
    isPicCabang,
    isNone,
    isAll,
    isSingle,
    isMulti,
    selectedCodes,
    activeBranch,
    filteredFin,
    filteredOpkom,
    filteredPeralatan,
    filteredKinerja,
    filteredUtilisasi,
    serviceKpis,
    financeKpis,
    topKpis,
    terminalsOverview,
    filteredTerminalsOverview,
    selectedBranchesMetrics,
    branchCommoditiesBreakdown,
    attentionItems,
    mainCombinedChartData,
    gaugeMetrics,
    servicesGroupedChartData,
  };
}

