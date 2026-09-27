import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { finishOAuth } from '../../services/supabaseClient.js';
import { authService } from '../../services/authService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';

/**
 * Google/Facebook redirect target. Exchanges the provider result for a
 * Supabase access token, then asks our API to sign in (or link) the
 * SHERE MUSIC account.
 */
export default function AuthCallbackPage() {
  useMeta({ title: 'Signing you in', noindex: true });
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [unverified, setUnverified] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // single-use code; guard StrictMode double effects
    started.current = true;
    (async () => {
      try {
        const { provider, intent, returnTo, accessToken } = await finishOAuth();
        const label = provider === 'google' ? 'Google' : 'Facebook';
        if (intent === 'link') {
          const res = await authService.oauthLink(provider, accessToken);
          setUser(res.data);
          toast.success(`${label} connected.`);
          navigate('/settings/connected-accounts', { replace: true });
          return;
        }
        const res = await authService.oauthSignIn(provider, accessToken);
        setUser(res.data);
        toast.success(res.meta?.created ? 'Welcome to SHERE MUSIC!' : `Signed in with ${label}.`);
        navigate(returnTo && returnTo !== '/login' ? returnTo : '/', { replace: true });
      } catch (err) {
        if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(err.details?.email || true);
        setError(err.message || 'Sign-in failed. Please try again.');
      }
    })();
  }, [navigate, setUser, toast]);

  if (!error) {
    return (
      <div className="auth-card center-text">
        <Spinner size={36} label="Signing you in" />
        <h1 className="auth-card__title">Signing you in…</h1>
      </div>
    );
  }
  return (
    <div className="auth-card center-text">
      <span className={`auth-card__icon ${unverified ? '' : 'auth-card__icon--error'}`}>
        <Icon name={unverified ? 'mail' : 'alert-circle'} size={28} />
      </span>
      <h1 className="auth-card__title">{unverified ? 'Check your email' : 'Sign-in didn’t finish'}</h1>
      <p className="auth-card__subtitle">{error}</p>
      <Link to="/login" className="btn btn--primary btn--block">
        Back to log in
      </Link>
    </div>
  );
}
