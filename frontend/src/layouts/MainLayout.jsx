import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import Sidebar, { TabBar } from '../components/layout/Sidebar.jsx';
import Footer from '../components/layout/Footer.jsx';
import Player from '../components/player/Player.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { gsap, motionOK } from '../utils/motion.js';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Pages glide in on navigation (opacity/transform only, so it stays GPU-cheap). */
function PageTransition({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!ref.current || !motionOK()) return undefined;
    const tween = gsap.fromTo(ref.current, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    return () => tween.kill();
  }, [pathname]);
  return <div ref={ref}>{children}</div>;
}

export default function MainLayout() {
  const { current, miniHidden } = usePlayer();
  return (
    <div className={current && !miniHidden ? 'shell has-player' : 'shell'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar />
      <Header />
      <main id="main" className="main" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>
      <Footer />
      <TabBar />
      <Player />
    </div>
  );
}
