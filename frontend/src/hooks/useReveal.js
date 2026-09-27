import { useEffect } from 'react';
import { gsap, motionOK } from '../utils/motion.js';

/**
 * Reveal the children matching `selector` inside `ref` the first time the
 * section scrolls into view (IntersectionObserver + one GSAP stagger).
 */
export function useReveal(ref, selector, deps = []) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !motionOK() || !('IntersectionObserver' in window)) return undefined;
    const items = root.querySelectorAll(selector);
    if (!items.length) return undefined;
    gsap.set(items, { autoAlpha: 0, y: 18 });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        gsap.to(items, { autoAlpha: 1, y: 0, stagger: 0.045, duration: 0.5, ease: 'power3.out', clearProps: 'transform' });
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      gsap.set(items, { autoAlpha: 1, y: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
