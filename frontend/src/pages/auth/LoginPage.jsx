import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Feedback.jsx';
import { PasswordField, TextField } from '../../components/ui/Form.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';

export default function LoginPage() {
  useMeta({ title: 'Sign in', noindex: true });
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [unverified, setUnverified] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = 'Enter your email address.';
    if (!form.password) nextErrors.password = 'Enter your password.';
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);

    setBusy(true);
    setError(null);
    setUnverified(null);
    clearSessionMessage();
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(err.details?.email || form.email.trim());
      else setError(err.message);
      setErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const res = await authService.resendVerification(unverified);
      toast.success(res.meta?.message || 'Verification email sent.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Welcome back</h1>
      <p className="auth-card__subtitle">Sign in to your favourites, playlists and downloads.</p>
      {sessionMessage ? <Alert type="warning">{sessionMessage}</Alert> : null}
      {error ? <Alert type="error">{error}</Alert> : null}
      {unverified ? (
        <Alert type="warning">
          Please verify your email address before signing in.{' '}
          <button type="button" className="link-btn" onClick={resend}>
            Resend verification email
          </button>
        </Alert>
      ) : null}
      <form onSubmit={submit} className="stack" noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required inputMode="email" />
        <PasswordField label="Password" autoComplete="current-password" value={form.password} onChange={set('password')} error={errors.password} required />
        <div className="row-end">
          <Link to="/forgot-password" className="text-sm">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-card__footer">
        New to SHERE MUSIC? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
