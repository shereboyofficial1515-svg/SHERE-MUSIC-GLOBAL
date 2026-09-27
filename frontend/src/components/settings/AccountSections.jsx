import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Artwork from '../ui/Artwork.jsx';
import Icon from '../ui/Icon.jsx';
import Dialog from '../ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Spinner } from '../ui/Feedback.jsx';
import { PasswordField, TextArea, TextField } from '../ui/Form.jsx';
import { SettingsCard } from './PreferenceSections.jsx';
import FollowButton, { VerifiedBadge } from '../artists/FollowButton.jsx';
import { PROVIDERS } from '../auth/OAuthButtons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { userService } from '../../services/userService.js';
import { authService } from '../../services/authService.js';
import { musicService } from '../../services/musicService.js';
import { oauthConfigured, startOAuth } from '../../services/supabaseClient.js';
import { checkFile, IMAGE_ACCEPT } from '../../utils/audio.js';
import { cx, formatCount, formatDate } from '../../utils/format.js';
import { validatePassword } from '../../pages/auth/RegisterPage.jsx';

const ROLE_LABEL = { user: 'Listener', artist: 'Artist', admin: 'Administrator' };

// ─── Account ───────────────────────────────────────────────────────────────
export function AccountSection() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const changeEmail = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErrors({ email: 'Enter a valid email address.' });
    setBusy(true);
    try {
      const res = await userService.requestEmailChange({ email: email.trim(), password: user.hasPassword ? password : undefined });
      setUser({ ...user, pendingEmail: res.data.pendingEmail });
      setEmail('');
      setPassword('');
      setErrors({});
      toast.success(res.meta?.message || 'Check your new inbox to confirm.');
    } catch (err) {
      setErrors(Object.keys(err.fieldErrors || {}).length ? err.fieldErrors : { email: err.message });
    } finally {
      setBusy(false);
    }
  };

  const cancelChange = async () => {
    try {
      await userService.cancelEmailChange();
      setUser({ ...user, pendingEmail: null });
      toast.success('Email change cancelled.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <SettingsCard title="Account">
        <dl className="kv">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{ROLE_LABEL[user.role] || user.role}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="badge badge--success">
                <Icon name="check-circle" size={12} /> Active
              </span>
            </dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
          </div>
          <div>
            <dt>Sign-in methods</dt>
            <dd>
              {[user.hasPassword && 'Email & password', ...(user.connectedProviders || []).map((p) => (p === 'google' ? 'Google' : 'Facebook'))].filter(Boolean).join(', ') || '—'}
            </dd>
          </div>
        </dl>
      </SettingsCard>

      <SettingsCard title="Change email" description="We'll send a confirmation link to the new address. Your email stays the same until you click it.">
        {user.pendingEmail ? (
          <Alert type="info">
            Waiting for confirmation of <strong>{user.pendingEmail}</strong>.{' '}
            <button type="button" className="link-btn" onClick={cancelChange}>
              Cancel
            </button>
          </Alert>
        ) : null}
        <form className="stack" onSubmit={changeEmail} noValidate>
          <TextField label="New email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          {user.hasPassword ? (
            <PasswordField label="Current password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Required to confirm it's you." />
          ) : null}
          <div>
            <button type="submit" className="btn btn--primary" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send confirmation'}
            </button>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title="Sign out">
        <div className="row-gap wrap">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={async () => {
              await logout();
              toast.success('You have been signed out.');
              navigate('/');
            }}
          >
            <Icon name="log-out" size={16} /> Sign out of this device
          </button>
          <Link to="/settings/security" className="btn btn--ghost">
            Sign out everywhere else
          </Link>
        </div>
      </SettingsCard>

      <DeleteAccountCard />
    </>
  );
}

function DeleteAccountCard() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await userService.deleteAccount(confirmValue);
      setUser(null);
      toast.success('Your account has been deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.fieldErrors?.password || err.message);
      setBusy(false);
    }
  };

  return (
    <section className="settings-card settings-card--danger">
      <h2 className="settings-card__title">Delete account</h2>
      <p className="settings-card__desc">Permanently delete your account, favorites, playlists and history. Artist profiles you own must be removed or handed over first. This cannot be undone.</p>
      <div>
        <button type="button" className="btn btn--danger" onClick={() => setOpen(true)}>
          <Icon name="trash" size={16} /> Delete my account
        </button>
      </div>
      {open ? (
        <Dialog
          title="Delete your account?"
          size="sm"
          onClose={() => setOpen(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" form="delete-account" className="btn btn--danger" disabled={busy || !confirmValue}>
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </>
          }
        >
          <form id="delete-account" onSubmit={remove} className="stack">
            {user.hasPassword ? (
              <PasswordField label="Enter your password to confirm" autoComplete="current-password" value={confirmValue} onChange={(e) => { setConfirmValue(e.target.value); setError(null); }} error={error} />
            ) : (
              <TextField label='Type "DELETE" to confirm' value={confirmValue} onChange={(e) => { setConfirmValue(e.target.value); setError(null); }} error={error} autoComplete="off" />
            )}
          </form>
        </Dialog>
      ) : null}
    </section>
  );
}

// ─── Profile ───────────────────────────────────────────────────────────────
const SOCIALS = [
  ['instagram', 'Instagram'],
  ['x', 'X (Twitter)'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['facebook', 'Facebook'],
  ['soundcloud', 'SoundCloud'],
];

export function ProfileSection() {
  const { user, setUser } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const genres = useAsync(() => musicService.genres(), []);
  const [form, setForm] = useState({
    name: user.name,
    username: user.username || '',
    bio: user.bio || '',
    location: user.location || '',
    website: user.website || '',
    socialLinks: { ...(user.socialLinks || {}) },
    favoriteGenreIds: user.favoriteGenreIds || [],
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Enter your name.' });
    setBusy('save');
    try {
      const { data } = await userService.updateProfile({
        ...form,
        name: form.name.trim(),
        socialLinks: Object.fromEntries(Object.entries(form.socialLinks).map(([k, v]) => [k, v.trim()])),
      });
      setUser(data);
      toast.success('Profile saved.');
    } catch (err) {
      const fe = err.fieldErrors || {};
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const uploadAvatar = async (file) => {
    const problem = checkFile(file, 'image', settings.maxImageMb);
    if (problem) return toast.error(problem);
    setBusy('avatar');
    try {
      const { data } = await userService.uploadAvatar(file);
      setUser(data);
      toast.success('Profile picture updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
    return undefined;
  };

  const removeAvatar = async () => {
    setBusy('avatar');
    try {
      const { data } = await userService.removeAvatar();
      setUser(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleGenre = (id) =>
    setForm((f) => ({ ...f, favoriteGenreIds: f.favoriteGenreIds.includes(id) ? f.favoriteGenreIds.filter((g) => g !== id) : [...f.favoriteGenreIds, id].slice(0, 20) }));

  return (
    <form onSubmit={save} className="stack-lg" noValidate>
      <SettingsCard title="Profile picture">
        <div className="avatar-editor">
          <Artwork src={user.avatarUrl} alt="Your profile picture" rounded size={88} icon="user" />
          <div className="stack-sm">
            <div className="row-gap wrap">
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()} disabled={busy === 'avatar'}>
                <Icon name="upload" size={16} /> {busy === 'avatar' ? 'Uploading…' : 'Upload picture'}
              </button>
              {user.avatarUrl ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={removeAvatar} disabled={busy === 'avatar'}>
                  Remove
                </button>
              ) : null}
            </div>
            <p className="field__hint">JPG, PNG or WebP, up to {settings.maxImageMb} MB.</p>
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => e.target.files[0] && uploadAvatar(e.target.files[0])} />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="About you">
        <div className="form-row">
          <TextField label="Display name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} required />
          <TextField label="Username" value={form.username} onChange={set('username')} error={errors.username} maxLength={30} hint={form.username ? `Profile link: /u/${form.username.toLowerCase()}` : '3–30 letters, numbers, dots or underscores.'} autoCapitalize="none" />
        </div>
        <TextArea label="Biography" value={form.bio} onChange={set('bio')} error={errors.bio} maxLength={500} rows={3} />
        <div className="form-row">
          <TextField label="Location" value={form.location} onChange={set('location')} error={errors.location} maxLength={80} />
          <TextField label="Website" type="url" placeholder="https://" value={form.website} onChange={set('website')} error={errors.website} />
        </div>
      </SettingsCard>

      <SettingsCard title="Social links">
        <div className="form-row">
          {SOCIALS.map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              value={form.socialLinks[key] || ''}
              onChange={(e) => setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: e.target.value } }))}
              error={errors[`socialLinks.${key}`]}
              placeholder="https://"
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Favourite genres" description="Used for “Made for you” on your home page.">
        <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
          {(genres.data || []).map((g) => (
            <button key={g.id} type="button" className={cx('chip', form.favoriteGenreIds.includes(g.id) && 'chip--active')} aria-pressed={form.favoriteGenreIds.includes(g.id)} onClick={() => toggleGenre(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Artist status">
        {['artist', 'admin'].includes(user.role) ? (
          <p className="text-muted">
            You're set up as a creator. Manage your artist profiles, music, lyrics and videos in <Link to="/studio">SHERE MUSIC STUDIO</Link>.
          </p>
        ) : (
          <div className="row-gap wrap">
            <p className="text-muted" style={{ flex: 1, minWidth: 220 }}>
              Are you a musician? Create an artist profile to upload music, lyrics and videos.
            </p>
            <Link to="/studio/welcome" className="btn btn--secondary">
              <Icon name="layers" size={16} /> I'm an artist
            </Link>
          </div>
        )}
      </SettingsCard>

      <div className="settings-actions">
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy === 'save'}>
          {busy === 'save' ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

// ─── Security ──────────────────────────────────────────────────────────────
export function SecuritySection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (user.hasPassword && !form.currentPassword) next.currentPassword = 'Enter your current password.';
    const pw = validatePassword(form.newPassword);
    if (pw) next.newPassword = pw;
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy('password');
    try {
      const res = user.hasPassword
        ? await authService.changePassword(form)
        : await userService.setPassword({ newPassword: form.newPassword, confirmPassword: form.confirmPassword });
      setUser(res.data);
      setForm(empty);
      toast.success(user.hasPassword ? 'Password changed. Other devices have been signed out.' : 'Password set. You can now log in with email too.');
    } catch (err) {
      const fe = err.fieldErrors || {};
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const signOutOthers = async () => {
    setBusy('sessions');
    try {
      const res = await userService.signOutOthers();
      toast.success(res.meta?.message || 'Signed out of other devices.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SettingsCard title={user.hasPassword ? 'Change password' : 'Set a password'} description={user.hasPassword ? 'Changing your password signs out every other device.' : 'You sign in with Google or Facebook. Add a password to also log in with your email.'}>
        <form className="stack" onSubmit={submit} noValidate>
          {user.hasPassword ? <PasswordField label="Current password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} /> : null}
          <PasswordField label="New password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="At least 8 characters with a letter and a number." />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
          <div>
            <button type="submit" className="btn btn--primary" disabled={busy === 'password'}>
              {busy === 'password' ? 'Saving…' : user.hasPassword ? 'Update password' : 'Set password'}
            </button>
          </div>
        </form>
      </SettingsCard>
      <SettingsCard title="Sessions" description="Signed in somewhere you don't recognise? Sign out every other browser and device. You'll stay signed in here.">
        <div>
          <button type="button" className="btn btn--secondary" onClick={signOutOthers} disabled={busy === 'sessions'}>
            <Icon name="log-out" size={16} /> {busy === 'sessions' ? 'Signing out…' : 'Sign out of all other devices'}
          </button>
        </div>
      </SettingsCard>
    </>
  );
}

// ─── Connected accounts ────────────────────────────────────────────────────
export function ConnectedAccountsSection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => userService.connectedAccounts(), []);
  const [busy, setBusy] = useState(null);

  const connect = async (provider) => {
    if (!oauthConfigured) return toast.info('Social sign-in has not been set up for this site yet.');
    setBusy(provider);
    try {
      await startOAuth(provider, { intent: 'link', returnTo: '/settings/connected-accounts' });
    } catch (err) {
      toast.error(err.message);
      setBusy(null);
    }
    return undefined;
  };

  const disconnect = async (provider) => {
    setBusy(provider);
    try {
      const res = await userService.disconnect(provider);
      setData(res.data);
      setUser({ ...user, connectedProviders: res.data.providers });
      toast.success(res.meta?.message || 'Disconnected.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <SettingsCard title="Connected accounts" description="Sign in faster with Google or Facebook. We only use them to confirm who you are.">
      {loading ? (
        <Spinner />
      ) : (
        <ul className="connected-list">
          {PROVIDERS.map(({ id, label, Mark }) => {
            const account = data.accounts.find((a) => a.provider === id);
            const isLast = account && !data.hasPassword && data.providers.length === 1;
            return (
              <li key={id} className="connected">
                <Mark />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{label}</strong>
                  <p className="text-sm text-muted">{account ? `Connected${account.email ? ` as ${account.email}` : ''}` : 'Not connected'}</p>
                </div>
                {account ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => disconnect(id)} disabled={Boolean(busy) || isLast} title={isLast ? 'Set a password first so you can still sign in' : undefined}>
                    {busy === id ? 'Working…' : 'Disconnect'}
                  </button>
                ) : (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => connect(id)} disabled={Boolean(busy)}>
                    {busy === id ? 'Opening…' : 'Connect'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && !data.hasPassword && data.providers.length === 1 ? (
        <p className="settings-note">
          <Icon name="info" size={14} /> This is your only way to sign in. <Link to="/settings/security">Set a password</Link> before disconnecting it.
        </p>
      ) : null}
    </SettingsCard>
  );
}

// ─── Followers / following ─────────────────────────────────────────────────
export function FollowersSection() {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => userService.following(), []);
  return (
    <>
      <SettingsCard title="Artists you follow" description="New releases from these artists appear in your Following feed and notifications.">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <Spinner />
        ) : !data.length ? (
          <EmptyState icon="user-plus" title="You're not following anyone yet" message="Follow artists from their pages to get their new music first." action={<Link to="/artists" className="btn btn--secondary">Find artists</Link>} />
        ) : (
          <ul className="follow-list">
            {data.map((a) => (
              <li key={a.id} className="follow-row">
                <Link to={`/artists/${a.id}`} className="follow-row__link">
                  <Artwork src={a.imageUrl} alt="" size={44} rounded icon="mic" />
                  <span>
                    <strong>
                      {a.name} {a.verified ? <VerifiedBadge size={13} /> : null}
                    </strong>
                    <span className="text-sm text-muted" style={{ display: 'block' }}>
                      {formatCount(a.followerCount)} followers
                    </span>
                  </span>
                </Link>
                <FollowButton artist={{ ...a, isFollowing: true }} size="sm" onChange={(r) => !r.following && setData((list) => list.filter((x) => x.id !== a.id))} />
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      {['artist', 'admin'].includes(user.role) ? (
        <SettingsCard title="Your followers" description="See who follows your artist profiles.">
          <Link to="/studio/followers" className="btn btn--secondary">
            <Icon name="users" size={16} /> Open followers in Studio
          </Link>
        </SettingsCard>
      ) : null}
    </>
  );
}
