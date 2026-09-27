import { useState } from 'react';
import { Spinner } from '../ui/Feedback.jsx';
import { oauthConfigured, startOAuth } from '../../services/supabaseClient.js';
import { useToast } from '../../context/ToastContext.jsx';

/* Official brand marks, as required by the providers' sign-in button guidelines. */
const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
const FacebookMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.23 2.68.23v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    <path fill="#fff" d="M16.67 15.56l.53-3.49h-3.33V9.8c0-.95.47-1.88 1.96-1.88h1.51V4.95s-1.37-.23-2.68-.23c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.2 12.2 0 0 0 3.74 0v-8.44z" />
  </svg>
);

export const PROVIDERS = [
  { id: 'google', label: 'Google', Mark: GoogleMark },
  { id: 'facebook', label: 'Facebook', Mark: FacebookMark },
];

/**
 * "Continue with Google / Facebook". Runs through Supabase Auth; when the
 * project hasn't configured it yet the buttons explain that instead of
 * failing silently.
 */
export default function OAuthButtons({ intent = 'login', returnTo = '/', verb = 'Continue' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const go = async (provider) => {
    if (!oauthConfigured) {
      toast.info('Social sign-in has not been set up for this site yet. Please use email for now.');
      return;
    }
    setBusy(provider);
    try {
      await startOAuth(provider, { intent, returnTo });
      // The browser now redirects to the provider.
    } catch (err) {
      toast.error(err.message || 'Could not start sign-in. Please try again.');
      setBusy(null);
    }
  };

  return (
    <div className="stack-sm">
      {PROVIDERS.map(({ id, label, Mark }) => (
        <button key={id} type="button" className="oauth-btn" onClick={() => go(id)} disabled={Boolean(busy)}>
          {busy === id ? <Spinner size={18} label={`Connecting to ${label}`} /> : <Mark />}
          {verb} with {label}
        </button>
      ))}
    </div>
  );
}
