'use client';

import { useEffect, useRef } from 'react';

/**
 * Keyboard containment for modal dialogs (`A11Y-04`).
 *
 * `role="dialog"` + `aria-modal="true"` tell a screen reader that the rest of the
 * page is inert, but they do nothing for a sighted keyboard user: Tab still walks
 * out of the dialog and onto the page behind it, which is unreachable by mouse
 * and confusing by keyboard. This traps Tab/Shift+Tab inside the dialog and
 * restores focus to whatever opened it.
 *
 * The list of focusable selectors is exported so the behaviour can be unit tested
 * without a DOM.
 */

/** Elements that can receive focus, in the order Tab reaches them. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusableLike {
  disabled?: boolean;
  /** Present on elements that should be skipped, e.g. `tabindex="-1"`. */
  tabIndex?: number;
  hidden?: boolean;
}

/**
 * Pure helper: given the candidates inside a dialog, which ones are actually
 * reachable by keyboard? Kept separate from the hook so the filtering rules are
 * testable.
 */
export function filterFocusable<T extends FocusableLike>(candidates: T[]): T[] {
  return candidates.filter((el) => {
    if (el.disabled) return false;
    if (el.hidden) return false;
    if (typeof el.tabIndex === 'number' && el.tabIndex < 0) return false;
    return true;
  });
}

/**
 * Where should focus land when Tab is pressed at `currentIndex` inside a list of
 * `total` items, going `forward` or backwards? Wraps around both ends.
 *
 * `currentIndex === -1` means focus is currently outside the list (e.g. on the
 * dialog container itself), in which case forward goes to the first item and
 * backward to the last.
 */
export function nextFocusIndex(
  currentIndex: number,
  total: number,
  forward: boolean
): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return forward ? 0 : total - 1;
  return forward ? (currentIndex + 1) % total : (currentIndex - 1 + total) % total;
}

/**
 * Trap focus inside `containerRef` while `active`, and return focus to the
 * previously focused element when the dialog closes.
 *
 * @param active   Whether the dialog is currently mounted/open.
 * @param onEscape Optional handler for the Escape key. Omit to disable
 *                 Escape-to-close (used where closing would lose user input).
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      filterFocusable(
        Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).map((el) => ({
          el,
          disabled: (el as HTMLButtonElement).disabled,
          tabIndex: el.tabIndex,
          hidden: el.offsetParent === null && el.getClientRects().length === 0,
        }))
      ).map((entry) => entry.el);

    // Move focus into the dialog if it is not already inside: screen readers
    // announce the dialog on focus, so leaving focus on the page behind means the
    // dialog opens silently.
    if (!container.contains(document.activeElement)) {
      const [first] = focusables();
      (first ?? container).focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        // Nothing focusable inside: keep focus on the container instead of
        // letting Tab escape to the page behind.
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const lastIndex = items.length - 1;

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          items[lastIndex].focus();
        }
        return;
      }
      if (currentIndex === -1 || currentIndex === lastIndex) {
        event.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Return focus to the trigger so the user resumes where they left off.
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [active, containerRef, onEscape]);
}
