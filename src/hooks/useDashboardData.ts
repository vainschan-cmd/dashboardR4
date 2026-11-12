'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Branch,
  DatabaseConfig,
  Department,
  EquipmentItem,
  IntegrationCredentials,
  KPIIndicator,
  SystemParameters,
  TemplateConfig,
  User,
} from '@/lib/types';
import { resolvePeriodRange } from '@/lib/period';

/**
 * Master data, user list, and verification counters for the dashboard shell
 * (`CODE-02`).
 *
 * These used to be six `useState` pairs plus two effects in `page.tsx`. Pulling
 * them out makes the invalidation contract explicit: every admin view that
 * mutates data receives `reload`, so there is one refresh path and no view can
 * quietly keep a stale copy.
 *
 * The pending counter is fetched separately from `/api/verification` because it
 * must follow the *selected period*, not a hardcoded month.
 */

export interface DashboardDataOptions {
  currentUser: User | null;
  selectedPeriod: string;
  setSystemParams: (params: SystemParameters) => void;
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export function useDashboardData({
  currentUser,
  selectedPeriod,
  setSystemParams,
  onThemeChange,
}: DashboardDataOptions) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<KPIIndicator[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [dbConfig, setDbConfig] = useState<DatabaseConfig | undefined>();
  const [credentials, setCredentials] = useState<IntegrationCredentials | undefined>();

  const canReadUsers =
    !!currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin_regional');

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [resMaster, resUsers] = await Promise.all([
          fetch('/api/master', { credentials: 'include', signal }),
          canReadUsers ? fetch('/api/users', { credentials: 'include', signal }) : Promise.resolve(null),
        ]);

        const dataMaster = await resMaster.json();
        if (dataMaster.success) {
          setBranches(dataMaster.branches || []);
          setDepartments(dataMaster.departments || []);
          setIndicators(dataMaster.indicators || []);
          setEquipment(dataMaster.equipment || []);
          setTemplates(dataMaster.templates || []);
          if (dataMaster.systemParams) setSystemParams(dataMaster.systemParams);
          if (dataMaster.dbConfig) setDbConfig(dataMaster.dbConfig);
          if (dataMaster.credentials) setCredentials(dataMaster.credentials);
        }

        if (resUsers && resUsers.ok) {
          const dataUsers = await resUsers.json();
          setUsersList(dataUsers.success ? dataUsers.users || [] : []);
        } else {
          setUsersList([]);
        }
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === 'AbortError')) console.error(e);
      }
    },
    [canReadUsers, setSystemParams]
  );

  // Load once the session is known.
  useEffect(() => {
    if (!currentUser) return;
    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      void reload(abortController.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [currentUser, reload]);

  // Pending/revision counters follow the selected period.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'viewer') {
      const resetTimer = window.setTimeout(() => setPendingCount(0), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const abortController = new AbortController();
    const range = resolvePeriodRange(selectedPeriod);
    const query = new URLSearchParams({
      year: String(range.endYear),
      month: String(range.endMonth),
    });

    fetch(`/api/verification?${query.toString()}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPendingCount(data?.success ? data.pendingCount || 0 : 0))
      .catch((e: unknown) => {
        if (!(e instanceof Error && e.name === 'AbortError')) setPendingCount(0);
      });

    return () => abortController.abort();
  }, [currentUser, selectedPeriod]);

  /** Settings changes apply the default theme only if the user never chose one. */
  const updateSystemParams = useCallback(
    (params: SystemParameters) => {
      setSystemParams(params);
      let hasExplicitTheme = false;
      try {
        hasExplicitTheme = !!localStorage.getItem('portsight_theme');
      } catch {
        hasExplicitTheme = true; // cannot read storage: never override the live theme
      }
      if (params.default_theme && !hasExplicitTheme) onThemeChange(params.default_theme);
    },
    [setSystemParams, onThemeChange]
  );

  return {
    branches,
    departments,
    indicators,
    equipment,
    templates,
    usersList,
    pendingCount,
    dbConfig,
    setDbConfig,
    credentials,
    setCredentials,
    reload,
    updateSystemParams,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
