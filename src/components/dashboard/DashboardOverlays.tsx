'use client';

import type { User } from '@/lib/types';
import {
  AuthModal,
  ComparisonModal,
  ManualDataInputModal,
  PasswordChangeModal,
} from './moduleRegistry';
import DrilldownModal, { type DrilldownItem } from './DrilldownModal';
import IdleWarningBanner from './IdleWarningBanner';

/**
 * Every overlay the shell can raise (`CODE-02`).
 *
 * Grouping them makes the z-order and the "which one wins" rules reviewable in
 * one place. Two invariants that used to be implicit in `page.tsx`:
 *
 *   • the forced password-change modal cannot be dismissed, so it is kept open
 *     by `passwordChangeRequired` even after `onClose` fires;
 *   • manual input is never mounted for the BOD persona, not merely hidden.
 */
export interface DashboardOverlaysProps {
  currentUser: User;
  selectedTerminal: string;
  selectedPeriod: string;

  drilldownItem: DrilldownItem | null;
  onCloseDrilldown: () => void;

  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
  onCloseAuthModal: () => void;
  onLoginSuccess: (user: User) => void;

  manualInputModalOpen: boolean;
  manualInputDefaultModule: 'finansial' | 'opkom' | 'kinerja' | 'utilisasi' | 'peralatan' | 'fasilitas';
  onCloseManualInput: () => void;
  isBod: boolean;
  isBranchLocked: boolean;
  onReload: () => void;

  comparisonModalOpen: boolean;
  onCloseComparisonModal: () => void;

  passwordModalOpen: boolean;
  passwordChangeRequired: boolean;
  onClosePasswordModal: () => void;
  onPasswordChanged: () => void;
  onSignedOut: () => void;

  idleWarningSeconds: number | null;
  onExtendSession: () => void;
}

export default function DashboardOverlays(props: DashboardOverlaysProps) {
  const {
    currentUser,
    selectedTerminal,
    selectedPeriod,
    drilldownItem,
    onCloseDrilldown,
    authModalOpen,
    authModalMode,
    onCloseAuthModal,
    onLoginSuccess,
    manualInputModalOpen,
    manualInputDefaultModule,
    onCloseManualInput,
    isBod,
    isBranchLocked,
    onReload,
    comparisonModalOpen,
    onCloseComparisonModal,
    passwordModalOpen,
    passwordChangeRequired,
    onClosePasswordModal,
    onPasswordChanged,
    onSignedOut,
    idleWarningSeconds,
    onExtendSession,
  } = props;

  return (
    <>
      {drilldownItem && <DrilldownModal item={drilldownItem} onClose={onCloseDrilldown} />}

      <AuthModal
        isOpen={authModalOpen}
        onClose={onCloseAuthModal}
        currentUser={currentUser}
        initialMode={authModalMode}
        onLoginSuccess={onLoginSuccess}
      />

      {manualInputModalOpen && !isBod && (
        <ManualDataInputModal
          isOpen={manualInputModalOpen}
          onClose={onCloseManualInput}
          defaultModule={manualInputDefaultModule}
          selectedTerminal={selectedTerminal}
          isBranchLocked={isBranchLocked}
          currentUser={currentUser}
          onSuccess={onReload}
        />
      )}

      <ComparisonModal
        isOpen={comparisonModalOpen}
        onClose={onCloseComparisonModal}
        selectedPeriod={selectedPeriod}
        selectedTerminal={selectedTerminal}
      />

      {(passwordModalOpen || passwordChangeRequired) && (
        <PasswordChangeModal
          isOpen
          required={passwordChangeRequired}
          userName={currentUser.name}
          onClose={onClosePasswordModal}
          onSuccess={onPasswordChanged}
          onSignedOut={onSignedOut}
        />
      )}

      {idleWarningSeconds !== null && (
        <IdleWarningBanner secondsRemaining={idleWarningSeconds} onExtend={onExtendSession} />
      )}
    </>
  );
}
