import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Feedback.jsx';
import { PasswordField } from '../../components/ui/Form.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';
import { validatePassword } from './RegisterPage.jsx';

export default function ResetPasswordPage() {
  useMeta({ title: 'Choose a new password', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="auth-card">
        <h1 className="auth-card__title">Link not valid</h1>
        <p className="auth-card__subtitle">This reset link is incomplete. Request a new one.</p>
        <Link to="/forgot-password" className="btn btn--primary btn--block">
          Request a new link
        </Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    const pw = validatePassword(form.password);
    if (pw) next.password = pw;
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setError(null);
    try {
      const res = await authService.resetPassword({ token, ...form });
      setUser(null); // all sessions were signed out
      toast.success(res.meta?.message || 'Password updated.');
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Choose a new password</h1>
      <p className="auth-card__subtitle">For your security, all other devices will be signed out.</p>
      {error ? (
        <Alert type="error">
          {error} <Link to="/forgot-password">Request a new link</Link>
        </Alert>
      ) : null}
      <form onSubmit={submit} className="stack" noValidate>
        <PasswordField label="New password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="At least 8 characters with a letter and a number." required />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={errors.confirmPassword} required />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
