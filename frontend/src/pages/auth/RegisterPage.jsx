import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Feedback.jsx';
import { PasswordField, TextField } from '../../components/ui/Form.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';

export function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}

export default function RegisterPage() {
  useMeta({ title: 'Create account', description: 'Create a free SHERE MUSIC account to save favourites, build playlists and track your downloads.' });
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined });
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    const pw = validatePassword(form.password);
    if (pw) next.password = pw;
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.register({ ...form, name: form.name.trim(), email: form.email.trim() });
      toast.success('Account created. Check your email to verify it.');
      navigate('/check-email', { state: { email: res.data.email, emailSent: res.data.emailSent, message: res.meta?.message } });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings.allowRegistration) {
    return (
      <div className="auth-card">
        <h1 className="auth-card__title">Registration is closed</h1>
        <p className="auth-card__subtitle">New sign-ups are temporarily paused. You can still listen and download without an account.</p>
        <Link to="/" className="btn btn--primary btn--block">
          Browse music
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Create your account</h1>
      <p className="auth-card__subtitle">Save favourites, build playlists and keep track of your downloads.</p>
      {error ? <Alert type="error">{error}</Alert> : null}
      <form onSubmit={submit} className="stack" noValidate>
        <TextField label="Name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} required />
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} required />
        <PasswordField label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a letter and a number." required />
        <PasswordField label="Confirm password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required />
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-card__footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
