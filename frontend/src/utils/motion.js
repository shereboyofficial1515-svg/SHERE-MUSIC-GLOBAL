import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);
gsap.defaults({ ease: 'power3.out', duration: 0.45 });

/**
 * Motion is allowed unless the listener (Settings → Accessibility) or their
 * OS asked for reduced motion. PreferencesContext mirrors that decision onto
 * <html class="reduce-motion">, so this check is cheap and always current.
 */
export const motionOK = () => typeof document !== 'undefined' && !document.documentElement.classList.contains('reduce-motion');

/** Fade/slide children of `scope` into view once (hero sections, grids). */
export function revealChildren(targets, { y = 16, stagger = 0.05, delay = 0 } = {}) {
  if (!targets || (Array.isArray(targets) && !targets.length)) return null;
  if (!motionOK()) {
    gsap.set(targets, { autoAlpha: 1, y: 0 });
    return null;
  }
  return gsap.fromTo(targets, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, stagger, delay, duration: 0.5, clearProps: 'transform' });
}

export { gsap, useGSAP };
