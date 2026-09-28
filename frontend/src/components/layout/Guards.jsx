import { Link, Navigate, useLocation } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageLoader } from '../ui/Feedback.jsx';
import NotFoundPage from '../../pages/public/NotFoundPage.jsx';

/**
 * UX-level route guards. They only decide what to render — every protected
 * endpoint is independently authorised by the backend.
 */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export function RequireAdmin({ children, deny = 'not-found' }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  // Non-admins get a plain 404 rather than confirmation that the area exists,
  // except where a clear "403" is expected (the Admin Guide).
  if (!isAdmin) return deny === 'forbidden' ? <ForbiddenPage /> : <NotFoundPage />;
  return children;
}

function ForbiddenPage() {
  return (
    <div className="container page">
      <div className="payment-result">
        <span className="payment-result__icon payment-result__icon--error">
          <Icon name="lock" size={28} />
        </span>
        <p className="text-muted text-sm">403 · Forbidden</p>
        <h1 className="page-title">This page is for SHERE MUSIC administrators</h1>
        <p className="text-muted">Your account doesn't have access. If you need help using SHERE MUSIC, visit the Help Center.</p>
        <div className="row-gap wrap center">
          <Link to="/help" className="btn btn--primary">Help Center</Link>
          <Link to="/" className="btn btn--secondary">Home</Link>
        </div>
      </div>
    </div>
  );
}

/** Studio pages beyond onboarding need the artist (or admin) role. */
export function RequireCreator({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!['artist', 'admin'].includes(user.role)) return <Navigate to="/studio/welcome" replace />;
  return children;
}

export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={location.state?.from || '/'} replace />;
  return children;
}
