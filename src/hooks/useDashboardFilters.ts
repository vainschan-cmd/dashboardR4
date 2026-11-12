'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import { isGovernanceTab, isValidTab } from '@/lib/tabs';
import type { SignInEvent } from './useDashboardSession';

/**
 * Tab, branch, and period filters for the dashboard shell (`CODE-02`).
 *
 * Three rules live here, and only here, because each one was previously
 * duplicated between the mount effect, the `popstate` handler, and the login
 * callback — which is exactly how a deep link and a fresh login end up
 * disagreeing about which branch is selected:
 *
 *   1. the URL is the initial source of truth (`?tab=&branch=&period=`);
 *   2. a *fresh login* resets the branch to the user's own scope, while a
 *      *restored* session must keep the branch in the deep link, unless RBAC
 *      pins the user to one branch;
 *   3. `pic_cabang` can never widen its own branch filter.
 */

const DEFAULT_PERIOD = 'YTD Sep 2026';

/** The branch a user is allowed to look at after signing in. */
function branchScopeOf(user: User): string {
  const locked = user.role === 'pic_cabang' && !!user.branch_id && user.branch_id !== 'R99';
  return locked ? String(user.branch_id) : 'ALL';
}

export interface DashboardFiltersOptions {
  currentUser: User | null;
  signIn: SignInEvent | null;
  /** Bounce a `viewer` out of governance tabs (they are hidden for that role). */
  isBod: boolean;
}

export function useDashboardFilters({ currentUser, signIn, isBod }: DashboardFiltersOptions) {
  const [activeTab, setActiveTab] = useState<string>('beranda');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(DEFAULT_PERIOD);

  // Initial deep link + browser back/forward.
  useEffect(() => {
    const applyFromUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const branch = params.get('branch');
        const period = params.get('period');
        if (isValidTab(tab)) setActiveTab(tab);
        if (branch) setSelectedTerminal(branch);
        if (period) setSelectedPeriod(period);
      } catch (e) {
        console.warn('Gagal membaca parameter URL:', e);
      }
    };

    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, []);

  // Keep the address bar shareable.
  useEffect(() => {
    if (!currentUser) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      url.searchParams.set('branch', selectedTerminal);
      url.searchParams.set('period', selectedPeriod);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Gagal memperbarui parameter URL:', e);
    }
  }, [activeTab, selectedTerminal, selectedPeriod, currentUser]);

  // A new session decides the branch: fresh logins reset, deep links persist,
  // RBAC-scoped users are always pinned. Deferred to keep the effect body free
  // of synchronous setState.
  useEffect(() => {
    if (!signIn) return;
    const scope = branchScopeOf(signIn.user);
    if (signIn.source !== 'login' && scope === 'ALL') return;
    const timer = window.setTimeout(() => setSelectedTerminal(scope), 0);
    return () => window.clearTimeout(timer);
  }, [signIn]);

  // `viewer` (BOD) must not sit on a governance tab reached via the URL.
  useEffect(() => {
    if (!isBod || !isGovernanceTab(activeTab)) return;
    const timer = window.setTimeout(() => setActiveTab('beranda'), 0);
    return () => window.clearTimeout(timer);
  }, [isBod, activeTab]);

  const isPicCabang =
    currentUser?.role === 'pic_cabang' && !!currentUser.branch_id && currentUser.branch_id !== 'R99';

  /** Branch changes are refused when RBAC pins the user to one branch. */
  const selectTerminal = useCallback(
    (branchId: string) => {
      if (currentUser?.role === 'pic_cabang' && currentUser.branch_id && currentUser.branch_id !== 'R99') {
        return;
      }
      setSelectedTerminal(branchId);
    },
    [currentUser]
  );

  /** Navigate to a tab, optionally carrying a branch selection with it. */
  const navigateToTab = useCallback((tabId: string, branchCode?: string) => {
    if (branchCode) setSelectedTerminal(branchCode);
    setActiveTab(tabId);
  }, []);

  return {
    activeTab,
    setActiveTab,
    selectedTerminal,
    selectTerminal,
    setSelectedTerminal,
    selectedPeriod,
    setSelectedPeriod,
    isPicCabang,
    navigateToTab,
  };
}

/** Branch assignment for the initial render, before any sign-in event fires. */
export { branchScopeOf };
