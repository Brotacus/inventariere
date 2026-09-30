import { useLayoutEffect, useRef } from "react";

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let scrollLockCount = 0;
let savedBodyStyles;

function lockPageScroll() {
  if (scrollLockCount === 0) {
    const { style } = document.body;
    savedBodyStyles = { overflow: style.overflow, paddingRight: style.paddingRight };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const padding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      style.paddingRight = `${padding + scrollbarWidth}px`;
    }
    style.overflow = "hidden";
  }
  scrollLockCount += 1;
  return () => {
    scrollLockCount -= 1;
    if (scrollLockCount === 0 && savedBodyStyles) {
      Object.assign(document.body.style, savedBodyStyles);
      savedBodyStyles = undefined;
    }
  };
}

function focusableElements(container) {
  return [...container.querySelectorAll(focusableSelector)].filter((element) => (
    element.tabIndex >= 0 && !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0
  ));
}

/** Contain keyboard focus and scrolling while a modal dialog is open. */
export default function useDialogFocus({ active, dialogRef, initialFocusRef, onClose }) {
  const closeRef = useRef(onClose);
  const focusVersion = useRef(0);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!active || !dialogRef.current) return undefined;
    focusVersion.current += 1;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const unlockScroll = lockPageScroll();
    const focusFirst = () => {
      const elements = focusableElements(dialog);
      const preferred = initialFocusRef?.current;
      const target = elements.includes(preferred) ? preferred : elements[0] || dialog;
      target.focus({ preventScroll: true });
    };
    focusFirst();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements(dialog);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const focused = document.activeElement;
      if (!first) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (event.shiftKey && (focused === first || !dialog.contains(focused))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (focused === last || !dialog.contains(focused))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    function keepFocusInside(event) {
      if (!dialog.contains(event.target)) focusFirst();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", keepFocusInside);
      unlockScroll();
      const restoreVersion = ++focusVersion.current;
      // Sibling content may still be inert during React's layout cleanup.
      // Restore after this commit; a reopened dialog invalidates this callback.
      queueMicrotask(() => {
        if (focusVersion.current !== restoreVersion || !(previousFocus instanceof HTMLElement)) return;
        if (!previousFocus.isConnected || previousFocus.closest('[inert], [aria-hidden="true"]')) return;
        if (previousFocus.matches(":disabled") || !previousFocus.getClientRects().length) return;
        const focused = document.activeElement;
        // Preserve focus claimed by another dialog or a new user interaction.
        if (focused !== document.body && focused !== previousFocus && focused?.isConnected && !dialog.contains(focused)) return;
        previousFocus.focus({ preventScroll: true });
      });
    };
  }, [active, dialogRef, initialFocusRef]);
}
