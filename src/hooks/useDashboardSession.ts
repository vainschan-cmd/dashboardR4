'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SystemParameters, User, UserRole } from '@/lib/types';

/**
 * Session, theme, and inactivity handling for the dashboard shell (`CODE-02`).
 *
 * Extracted from `page.tsx`, where this was ~250 lines of effects interleaved
 * with layout JSX. The behaviour is unchanged on purpose — the point of the
 * move is that the idle-timeout rules can now be read (and tested) without
 * scrolling past tables:
 *
 *   • the access cookie lives 15 minutes, so a silent rotation runs every 10
 *     minutes while the user is still active;
 *   • idle logout is decided client-side from `portsight_last_activity`, and the
 *     server enforces its own timeout independently — neither one is trusted
 *     alone;
 *   • an account holding a temporary password cannot dismiss the password modal,
 *     including after a page reload that restores its session.
 */

const THEME_KEY = 'portsight_theme';
const ACTIVITY_KEY = 'portsight_last_activity';
const LEGACY_USER_KEY = 'portsight_auth_user';

export const DEFAULT_SYSTEM_PARAMS: SystemParameters = {
  session_timeout_minutes: 30,
  auto_logout_idle: true,
  warning_before_minutes: 2,
  default_theme: 'light',
};

/** How the current session began — a deep link must keep its `?branch=`. */
export type SignInSource = 'login' | 'restore';

export interface SignInEvent {
  user: User;
  source: SignInSource;
  /** Monotonic counter so an identical re-login is still observable. */
  seq: number;
}

/** Safe `localStorage` access: private mode and embedded webviews throw. */
function readActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeActivity(value: number): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(value));
  } catch {
    // Storage unavailable; the in-memory timestamp still drives the timer.
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // Storage unavailable; the React state is cleared regardless.
  }
}

export function useDashboardSession() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('admin_regional');
  const [username, setUsername] = useState<string>('10002');

  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);
  const [systemParams, setSystemParams] = useState<SystemParameters>(DEFAULT_SYSTEM_PARAMS);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  const [signIn, setSignIn] = useState<SignInEvent | null>(null);
  const signInSeq = useRef(0);

  const applyTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (e) {
      console.error(e);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const applyUser = useCallback((user: User, source: SignInSource) => {
    setCurrentUser(user);
    setUserRole(user.role);
    setUsername(user.nipp || user.username);
    signInSeq.current += 1;
    setSignIn({ user, source, seq: signInSeq.current });
    // A restored session must honour the pending password change too, otherwise
    // reloading the page is enough to bypass it.
    if (user.must_change_password) {
      setPasswordChangeRequired(true);
      setPasswordModalOpen(true);
    }
  }, []);

  // Restore the saved theme, read the initial deep link, and validate the
  // HttpOnly JWT session on mount.
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    // Deferred so the effect body stays free of synchronous setState (which
    // would cascade an extra render before first paint).
    const themeTimer = window.setTimeout(() => {
      try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const initialTheme: 'dark' | 'light' = savedTheme === 'dark' ? 'dark' : 'light';
        setTheme(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);
        localStorage.removeItem(LEGACY_USER_KEY);
      } catch (e) {
        console.error(e);
      }
    }, 0);

    const restore = async () => {
      try {
        const res = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data.success || !data.authenticated || !data.user) return;
        applyUser(data.user as User, 'restore');
        writeActivity(Date.now());
      } catch (err: unknown) {
        // Aborted on unmount, or simply not signed in — stay on the login screen.
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.warn('Gagal memulihkan sesi:', err);
        }
      }
    };

    void restore();

    return () => {
      isMounted = false;
      window.clearTimeout(themeTimer);
      abortController.abort();
    };
  }, [applyUser]);

  // Inactivity tracker, auto-logout watcher, and silent token rotation.
  useEffect(() => {
    if (!currentUser) return;

    let lastRecord = Date.now();
    writeActivity(lastRecord);

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecord <= 2000) return;
      lastRecord = now;
      writeActivity(now);
      setIdleWarningSeconds((prev) => (prev !== null ? null : prev));
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    const intervalId = setInterval(() => {
      if (!systemParams.auto_logout_idle) return;
      const lastActivity = readActivity() ?? lastRecord;
      const elapsedMs = Date.now() - lastActivity;
      const timeoutMinutes = systemParams.session_timeout_minutes || 30;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningWindowMs = (systemParams.warning_before_minutes || 2) * 60 * 1000;

      if (elapsedMs >= timeoutMs) {
        clearInterval(intervalId);
        fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        clearStoredSession();
        setIdleWarningSeconds(null);
        setCurrentUser(null);
        setSessionExpiredMessage(
          `Sesi Anda telah berakhir karena tidak ada aktivitas selama ${timeoutMinutes} menit. Silakan masuk kembali.`
        );
        return;
      }

      if (elapsedMs >= timeoutMs - warningWindowMs) {
        setIdleWarningSeconds(Math.max(1, Math.round((timeoutMs - elapsedMs) / 1000)));
        return;
      }

      setIdleWarningSeconds(null);
    }, 4000);

    // The access cookie lives 15 minutes; without this heartbeat an active user
    // would be logged out mid-task.
    const heartbeatId = setInterval(() => {
      const lastActivity = readActivity() ?? lastRecord;
      const timeoutMinutes = systemParams.session_timeout_minutes || 30;
      if (Date.now() - lastActivity >= timeoutMinutes * 60 * 1000) return;
      fetch('/api/users/me?rotate=1', { credentials: 'include', cache: 'no-store' }).catch(() => {
        // Not fatal: the idle timer still owns logout.
      });
    }, 10 * 60 * 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(intervalId);
      clearInterval(heartbeatId);
    };
  }, [currentUser, systemParams]);

  const handleLoginSuccess = useCallback(
    (user: User) => {
      setSessionExpiredMessage(null);
      setIdleWarningSeconds(null);
      clearStoredSession();
      writeActivity(Date.now());
      applyUser(user, 'login');
    },
    [applyUser]
  );

  const handleLogout = useCallback(() => {
    fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch((e) => {
      console.warn('Gagal memanggil endpoint logout:', e);
    });
    clearStoredSession();
    setSessionExpiredMessage(null);
    setIdleWarningSeconds(null);
    setCurrentUser(null);
    setSignIn(null);
    setAuthModalOpen(false);
    setPasswordModalOpen(false);
    setPasswordChangeRequired(false);
  }, []);

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const openPasswordModal = useCallback(() => {
    // Never clear `passwordChangeRequired` here: an account forced to rotate its
    // password must not be able to turn the modal into a dismissable one.
    setPasswordModalOpen(true);
  }, []);

  const finishPasswordChange = useCallback(() => {
    setPasswordChangeRequired(false);
    setPasswordModalOpen(false);
    setCurrentUser((prev) => (prev ? { ...prev, must_change_password: false } : prev));
  }, []);

  /**
   * Dismiss the voluntary password modal. A *required* change stays open: the
   * modal itself ignores the close request when `required` is set.
   */
  const closePasswordModal = useCallback(() => setPasswordModalOpen(false), []);

  /** "Lanjutkan Sesi" on the idle banner — resets the client-side clock. */
  const extendSession = useCallback(() => {
    writeActivity(Date.now());
    setIdleWarningSeconds(null);
  }, []);

  return {
    theme,
    handleThemeChange: applyTheme,
    currentUser,
    userRole,
    username,
    signIn,
    sessionExpiredMessage,
    idleWarningSeconds,
    systemParams,
    setSystemParams,
    authModalOpen,
    authModalMode,
    setAuthModalOpen,
    openAuthModal,
    passwordModalOpen,
    passwordChangeRequired,
    openPasswordModal,
    closePasswordModal,
    finishPasswordChange,
    handleLoginSuccess,
    handleLogout,
    extendSession,
  };
}

export type DashboardSession = ReturnType<typeof useDashboardSession>;
