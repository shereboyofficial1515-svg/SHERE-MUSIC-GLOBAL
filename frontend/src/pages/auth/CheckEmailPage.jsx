import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { TextField } from '../../components/ui/Form.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { authService } from '../../services/authService.js';

export default function CheckEmailPage() {
  useMeta({ title: 'Check your email', noindex: true });
  const { state } = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState(state?.email || '');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const resend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await authService.resendVerification(email.trim());
      toast.success(res.meta?.message || 'Verification email sent.');
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60_000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <span className="auth-card__icon">
        <Icon name="mail" size={28} />
      </span>
      <h1 className="auth-card__title">Check your email</h1>
      {state?.emailSent === false ? (
        <Alert type="warning">{state.message}</Alert>
      ) : (
        <p className="auth-card__subtitle">
          We sent a verification link to <strong>{state?.email || 'your email address'}</strong>. Click it to activate your account. The link expires in 24 hours.
        </p>
      )}
      <form onSubmit={resend} className="stack">
        <TextField label="Didn't get it? Resend to" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <button type="submit" className="btn btn--secondary btn--block" disabled={busy || cooldown}>
          {busy ? 'Sending…' : cooldown ? 'Email sent — check your inbox' : 'Resend verification email'}
        </button>
      </form>
      <p className="auth-card__footer">
        Already verified? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
