import { Navigate, useLocation } from 'react-router-dom';
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

export function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Non-admins get a plain 404 rather than confirmation that the area exists.
  if (!isAdmin) return <NotFoundPage />;
  return children;
}

export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={location.state?.from || '/'} replace />;
  return children;
}
