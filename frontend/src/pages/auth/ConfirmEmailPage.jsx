import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { authService } from '../../services/authService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';

/** Confirms an email-address change (link sent to the new address). */
export default function ConfirmEmailPage() {
  useMeta({ title: 'Confirm new email', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, setUser } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'error');
  const [message, setMessage] = useState('This confirmation link is incomplete.');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .confirmEmail(token)
      .then(({ data }) => {
        if (user?.id === data.id) setUser(data);
        setState('done');
        setMessage(`Your email address is now ${data.email}.`);
      })
      .catch((err) => {
        setState('error');
        setMessage(err.message);
      });
  }, [token, user, setUser]);

  return (
    <div className="auth-card center-text">
      {state === 'working' ? (
        <>
          <Spinner size={36} label="Confirming" />
          <h1 className="auth-card__title">Confirming your new email…</h1>
        </>
      ) : (
        <>
          <span className={`auth-card__icon ${state === 'done' ? 'auth-card__icon--success' : 'auth-card__icon--error'}`}>
            <Icon name={state === 'done' ? 'check-circle' : 'alert-circle'} size={30} />
          </span>
          <h1 className="auth-card__title">{state === 'done' ? 'Email updated' : 'Link not valid'}</h1>
          <p className="auth-card__subtitle">{message}</p>
          <Link to={user ? '/settings/account' : '/login'} className="btn btn--primary btn--block">
            {user ? 'Back to settings' : 'Log in'}
          </Link>
        </>
      )}
    </div>
  );
}
