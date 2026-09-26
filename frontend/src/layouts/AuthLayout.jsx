import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import Logo from '../components/ui/Logo.jsx';
import Icon from '../components/ui/Icon.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__glow" aria-hidden="true" />
      <header className="auth-layout__header">
        <Logo />
        <Link to="/" className="btn btn--ghost btn--sm">
          <Icon name="arrow-left" size={16} /> Back to music
        </Link>
      </header>
      <main id="main" className="auth-layout__main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
