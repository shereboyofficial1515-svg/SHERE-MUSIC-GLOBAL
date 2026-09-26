import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { PasswordField, TextField } from '../../components/ui/Form.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { userService } from '../../services/userService.js';
import { authService } from '../../services/authService.js';
import { checkFile, IMAGE_ACCEPT } from '../../utils/audio.js';
import { formatDate } from '../../utils/format.js';
import { validatePassword } from '../auth/RegisterPage.jsx';

function ProfileSection() {
  const { user, setUser } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    setBusy('name');
    try {
      const { data } = await userService.updateProfile({ name: name.trim() });
      setUser(data);
      toast.success('Profile updated.');
    } catch (err) {
      setError(err.fieldErrors?.name || err.message);
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
  };

  const removeAvatar = async () => {
    setBusy('avatar');
    try {
      const { data } = await userService.removeAvatar();
      setUser(data);
      toast.success('Profile picture removed.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Profile</h2>
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
      <form onSubmit={saveName} className="stack">
        <TextField label="Name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} error={error} maxLength={80} autoComplete="name" />
        <TextField label="Email" value={user.email} readOnly disabled hint="Your email address is used to sign in and cannot be changed here." />
        <p className="text-muted text-sm">Member since {formatDate(user.createdAt)}</p>
        <div>
          <button type="submit" className="btn btn--primary" disabled={busy === 'name' || name.trim() === user.name}>
            {busy === 'name' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const { setUser } = useAuth();
  const toast = useToast();
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password.';
    const pw = validatePassword(form.newPassword);
    if (pw) next.newPassword = pw;
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { data } = await authService.changePassword(form);
      setUser(data);
      setForm(empty);
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Change password</h2>
      <form onSubmit={submit} className="stack" noValidate>
        <PasswordField label="Current password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
        <PasswordField label="New password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="At least 8 characters with a letter and a number." />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
        <div>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </section>
  );
}

function DangerSection() {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await userService.deleteAccount(password);
      setUser(null);
      toast.success('Your account has been deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.fieldErrors?.password || err.message);
      setBusy(false);
    }
  };

  return (
    <section className="panel panel--danger">
      <h2 className="panel__title">Delete account</h2>
      <p className="text-muted">Permanently delete your account, favorites and playlists. This cannot be undone.</p>
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
              <button type="submit" form="delete-account" className="btn btn--danger" disabled={busy || !password}>
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </>
          }
        >
          <form id="delete-account" onSubmit={remove} className="stack">
            <p className="text-muted">Enter your password to confirm.</p>
            <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} error={error} />
          </form>
        </Dialog>
      ) : null}
    </section>
  );
}

export default function AccountPage() {
  useMeta({ title: 'Account settings', noindex: true });
  return (
    <div className="container page page--narrow">
      <h1 className="page-title">Account settings</h1>
      <div className="stack-lg">
        <ProfileSection />
        <PasswordSection />
        <DangerSection />
      </div>
    </div>
  );
}
