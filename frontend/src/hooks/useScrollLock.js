import { useEffect } from 'react';

// Shared across every overlay so overlapping locks (e.g. a dialog opened from
// the full-screen player) don't release each other early.
let activeLocks = 0;

/**
 * Prevent the page behind an overlay from scrolling while `active` is true.
 * The lock is always released on unmount, so navigating away while an overlay
 * is open (e.g. following a link in the mobile menu) can never leave the page
 * stuck without a scrollbar.
 */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    activeLocks += 1;
    document.body.classList.add('no-scroll');
    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) document.body.classList.remove('no-scroll');
    };
  }, [active]);
}
