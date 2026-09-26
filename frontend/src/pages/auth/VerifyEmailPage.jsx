import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';

export default function VerifyEmailPage() {
  useMeta({ title: 'Verify email', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token');
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState(token ? 'verifying' : 'invalid');
  const [message, setMessage] = useState('This verification link is missing its token.');
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use, so guard against StrictMode's double effect run.
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail(token)
      .then(({ data }) => {
        setUser(data);
        setState('success');
        toast.success('Email verified. Welcome to SHERE MUSIC!');
        setTimeout(() => navigate('/', { replace: true }), 2500);
      })
      .catch((err) => {
        setMessage(err.message);
        setState('invalid');
      });
  }, [token, setUser, toast, navigate]);

  return (
    <div className="auth-card center-text">
      {state === 'verifying' ? (
        <>
          <Spinner size={36} label="Verifying" />
          <h1 className="auth-card__title">Verifying your email…</h1>
        </>
      ) : state === 'success' ? (
        <>
          <span className="auth-card__icon auth-card__icon--success">
            <Icon name="check-circle" size={32} />
          </span>
          <h1 className="auth-card__title">Email verified</h1>
          <p className="auth-card__subtitle">Your account is active and you are signed in. Taking you to the music…</p>
          <Link to="/" className="btn btn--primary btn--block">
            Start listening
          </Link>
        </>
      ) : (
        <>
          <span className="auth-card__icon auth-card__icon--error">
            <Icon name="alert-circle" size={32} />
          </span>
          <h1 className="auth-card__title">Link not valid</h1>
          <p className="auth-card__subtitle">{message}</p>
          <Link to="/check-email" className="btn btn--primary btn--block">
            Request a new link
          </Link>
        </>
      )}
    </div>
  );
}
