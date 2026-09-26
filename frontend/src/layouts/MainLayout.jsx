import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';
import Player from '../components/music/Player.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function MainLayout() {
  const { current } = usePlayer();
  return (
    <div className={current ? 'app has-player' : 'app'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" className="main" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <Player />
    </div>
  );
}
