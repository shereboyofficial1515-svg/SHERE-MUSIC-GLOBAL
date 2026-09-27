import { Suspense, useRef } from 'react';
import { Link, Outlet } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';
import Icon from '../components/ui/Icon.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { ThemeToggle } from '../components/layout/Header.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { gsap, motionOK, useGSAP } from '../utils/motion.js';

export default function AuthLayout() {
  const { settings } = useSettings();
  const artRef = useRef(null);
  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.from('.auth-layout__art > *', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.7 });
      gsap.to('.auth-layout__rings', { rotate: 360, duration: 90, repeat: -1, ease: 'none' });
    },
    { scope: artRef }
  );
  return (
    <div className="auth-layout">
      <aside className="auth-layout__art" ref={artRef} aria-hidden="true">
        <Logo />
        <div className="stack">
          <h2>Discover. Stream. Download.</h2>
          <p>{settings.siteDescription}</p>
        </div>
        <p className="text-sm">Live lyrics · Music videos · Artist Studio</p>
        <span className="auth-layout__rings" />
      </aside>
      <div className="auth-layout__side">
        <header className="auth-layout__header">
          <Link to="/" className="btn btn--ghost btn--sm">
            <Icon name="arrow-left" size={16} /> Back to music
          </Link>
          <ThemeToggle />
        </header>
        <main id="main" className="auth-layout__main">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
