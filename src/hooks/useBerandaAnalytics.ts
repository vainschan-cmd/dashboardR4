'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, UserRole } from '@/lib/types';
import type { BerandaSummaryResponse } from '@/lib/berandaSummary';

export interface UseBerandaAnalyticsParams {
  selectedTerminal: string;
  currentUser?: User | null;
  userRole: UserRole;
  onSelectTerminal?: (terminalId: string) => void;
}

export interface UseBerandaAnalyticsResult {
  tahun: number;
  bulan: number;
  selectedBranches: string[];
  verifiedOnly: boolean;
  isBodViewer: boolean;
  isPicCabang: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  summary: BerandaSummaryResponse | null;
  setTahun: (tahun: number) => void;
  setBulan: (bulan: number) => void;
  toggleBranch: (nmCbg: string) => void;
  setSelectedBranches: (branches: string[]) => void;
  clearBranches: () => void;
  setVerifiedOnly: (val: boolean) => void;
  resetFilters: () => void;
  refresh: () => void;
}

export function useBerandaAnalytics({
  selectedTerminal,
  currentUser,
  userRole,
  onSelectTerminal,
}: UseBerandaAnalyticsParams): UseBerandaAnalyticsResult {
  const effectiveRole: UserRole = currentUser?.role || userRole;
  const picBranchId = currentUser?.branch_id || '';
  const isBodViewer = effectiveRole === 'viewer';
  const isPicCabang =
    effectiveRole === 'pic_cabang' && Boolean(picBranchId) && picBranchId !== 'R99';

  const [tahun, setTahunState] = useState<number>(2026);
  const [bulan, setBulanState] = useState<number>(8);
  const [selectedBranches, setSelectedBranchesState] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(isBodViewer);
  const [summary, setSummary] = useState<BerandaSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const hasLoadedOnceRef = useRef<boolean>(false);
  const prevRoleRef = useRef<UserRole>(effectiveRole);

  useEffect(() => {
    if (prevRoleRef.current !== effectiveRole) {
      prevRoleRef.current = effectiveRole;
      setVerifiedOnly(effectiveRole === 'viewer');
    }
  }, [effectiveRole]);

  const nmCbgKey = selectedBranches.join('||');

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchSummary() {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('tahun', String(tahun));
        params.set('bulan', String(bulan));
        params.set('verifiedOnly', String(verifiedOnly));

        if (!isPicCabang) {
          if (selectedBranches.length > 0) {
            for (const branchName of selectedBranches) {
              params.append('nmCbg', branchName);
            }
          } else if (selectedTerminal && selectedTerminal !== 'ALL' && selectedTerminal !== 'NONE') {
            params.set('branchCode', selectedTerminal);
          }
        } else if (picBranchId) {
          params.set('branchCode', picBranchId);
        }

        const res = await fetch(`/api/beranda-summary?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as BerandaSummaryResponse;
        if (!isActive) return;

        hasLoadedOnceRef.current = true;
        setSummary(data);

        // Keep UI slicer values synchronized if backend fell back to an available year/month
        if (data.filters.tahun !== tahun) {
          setTahunState(data.filters.tahun);
        }
        if (data.filters.bulan !== bulan) {
          setBulanState(data.filters.bulan);
        }
      } catch (err) {
        if (!isActive || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Gagal mengambil data Beranda Summary');
      } finally {
        if (isActive) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    fetchSummary();

    return () => {
      isActive = false;
      controller.abort();
    };
    // nmCbgKey captures selectedBranches cleanly for React Compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan, nmCbgKey, verifiedOnly, isPicCabang, picBranchId, selectedTerminal, reloadTick]);

  const setTahun = useCallback((nextYear: number) => {
    setTahunState(nextYear);
  }, []);

  const setBulan = useCallback((nextMonth: number) => {
    setBulanState(nextMonth);
  }, []);

  const toggleBranch = useCallback(
    (nmCbg: string) => {
      if (isPicCabang) return;
      if (onSelectTerminal && selectedTerminal !== 'ALL') {
        onSelectTerminal('ALL');
      }
      setSelectedBranchesState((prev) =>
        prev.includes(nmCbg) ? prev.filter((item) => item !== nmCbg) : [...prev, nmCbg]
      );
    },
    [isPicCabang, onSelectTerminal, selectedTerminal]
  );

  const setSelectedBranches = useCallback(
    (branches: string[]) => {
      if (isPicCabang) return;
      if (onSelectTerminal && selectedTerminal !== 'ALL') {
        onSelectTerminal('ALL');
      }
      setSelectedBranchesState(branches);
    },
    [isPicCabang, onSelectTerminal, selectedTerminal]
  );

  const clearBranches = useCallback(() => {
    if (isPicCabang) return;
    if (onSelectTerminal && selectedTerminal !== 'ALL') {
      onSelectTerminal('ALL');
    }
    setSelectedBranchesState([]);
  }, [isPicCabang, onSelectTerminal, selectedTerminal]);

  const resetFilters = useCallback(() => {
    setTahunState(2026);
    setBulanState(8);
    if (!isPicCabang) {
      setSelectedBranchesState([]);
      if (onSelectTerminal && selectedTerminal !== 'ALL') {
        onSelectTerminal('ALL');
      }
    }
  }, [isPicCabang, onSelectTerminal, selectedTerminal]);

  const refresh = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  return {
    tahun,
    bulan,
    selectedBranches,
    verifiedOnly,
    isBodViewer,
    isPicCabang,
    loading,
    refreshing,
    error,
    summary,
    setTahun,
    setBulan,
    toggleBranch,
    setSelectedBranches,
    clearBranches,
    setVerifiedOnly,
    resetFilters,
    refresh,
  };
}
