import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { TextField } from '../../components/ui/Form.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';

export default function ForgotPasswordPage() {
  useMeta({ title: 'Forgot password', noindex: true });
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      const res = await authService.forgotPassword(email.trim());
      setSent(res.meta?.message || 'If an account exists for that email, a reset link is on its way.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <span className="auth-card__icon">
        <Icon name="lock" size={28} />
      </span>
      <h1 className="auth-card__title">Reset your password</h1>
      {sent ? (
        <>
          <Alert type="success">{sent}</Alert>
          <p className="auth-card__subtitle">The link expires in 1 hour. Check your spam folder if you don&apos;t see it.</p>
        </>
      ) : (
        <>
          <p className="auth-card__subtitle">Enter the email you signed up with and we&apos;ll send you a link to choose a new password.</p>
          <form onSubmit={submit} className="stack" noValidate>
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <p className="auth-card__footer">
        Remembered it? <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
