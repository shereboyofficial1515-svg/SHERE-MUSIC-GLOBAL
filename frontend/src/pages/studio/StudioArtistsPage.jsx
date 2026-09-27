import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../../components/admin/AdminUI.jsx';
import { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { toFormData } from '../../services/contentService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { formatCount } from '../../utils/format.js';

const SOCIALS = ['instagram', 'x', 'tiktok', 'youtube', 'facebook', 'spotify', 'soundcloud'];

/** Create or edit one of the creator's artist profiles. */
export function ArtistProfileDialog({ artist, onClose, onSaved, create = false }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({ name: artist?.name || '', bio: artist?.bio || '', location: artist?.location || '', socialLinks: { ...(artist?.socialLinks || {}) } });
  const [image, setImage] = useState(null);
  const [cover, setCover] = useState(null);
  const [removed, setRemoved] = useState({ image: false, cover: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const pick = (key, setter) => (f) => {
    const problem = checkFile(f, 'image', settings.maxImageMb);
    if (problem) return toast.error(problem);
    setter(f);
    setRemoved((r) => ({ ...r, [key]: false }));
    return undefined;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Enter the artist name.' });
    setBusy(true);
    try {
      const body = toFormData(
        {
          name: form.name.trim(),
          bio: form.bio.trim() || null,
          location: form.location.trim() || null,
          socialLinks: Object.fromEntries(Object.entries(form.socialLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
          ...(removed.image && !image ? { removeImage: true } : {}),
          ...(removed.cover && !cover ? { removeCover: true } : {}),
        },
        { image, cover }
      );
      const res = create ? await studioService.createArtist(body) : await studioService.updateArtist(artist.id, body);
      toast.success(res.meta?.message || (create ? 'Artist profile created.' : 'Saved.'));
      onSaved(res.data);
    } catch (err) {
      setErrors(Object.keys(err.fieldErrors || {}).length ? err.fieldErrors : { name: err.message });
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Dialog
      title={create ? 'New artist profile' : `Edit ${artist.name}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="artist-profile" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="artist-profile" className="stack" onSubmit={submit}>
        <TextField label="Artist name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} required autoFocus hint={artist?.verified ? 'Renaming removes the verified badge until an admin re-verifies.' : undefined} />
        <TextArea label="Biography" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} maxLength={5000} />
        <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={80} />
        <ImagePicker label="Artist photo" round currentUrl={artist?.imageUrl} file={image} removed={removed.image} onChange={pick('image', setImage)} onRemove={() => { setImage(null); setRemoved((r) => ({ ...r, image: true })); }} />
        <ImagePicker label="Header cover (wide)" currentUrl={artist?.coverUrl} file={cover} removed={removed.cover} onChange={pick('cover', setCover)} onRemove={() => { setCover(null); setRemoved((r) => ({ ...r, cover: true })); }} hint="Shown behind your name on your artist page." />
        <fieldset className="field">
          <legend className="field__label">Social links</legend>
          <div className="form-row">
            {SOCIALS.map((k) => (
              <TextField key={k} label={k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1)} value={form.socialLinks[k] || ''} onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, [k]: e.target.value } })} placeholder="https://" />
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function VerificationDialog({ artist, onClose, onDone }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await studioService.requestVerification(artist.id, message.trim());
      toast.success(res.meta?.message || 'Verification requested.');
      onDone(res.data);
    } catch (err) {
      setError(err.fieldErrors?.message || err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Request verification"
      size="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="verify-form" className="btn btn--primary" disabled={busy || message.trim().length < 10}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </>
      }
    >
      <form id="verify-form" className="stack" onSubmit={submit}>
        <p className="text-muted text-sm">Verified artists get a badge on their page and releases. Tell the team who you are and share links that confirm it (official socials, press, label).</p>
        <TextArea label="About you" value={message} onChange={(e) => { setMessage(e.target.value); setError(null); }} error={error} rows={5} maxLength={1000} autoFocus />
      </form>
    </Dialog>
  );
}

const VERIFY_TEXT = {
  none: 'Not verified',
  pending: 'Verification requested — under review',
  verified: 'Verified',
  rejected: 'Verification not approved',
};

export default function StudioArtistsPage() {
  useMeta({ title: 'Artists · Studio', noindex: true });
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => studioService.artists(), []);
  const [editing, setEditing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const replace = (a) => setData((list) => list.map((x) => (x.id === a.id ? a : x)));

  const remove = async () => {
    setBusy(true);
    try {
      await studioService.deleteArtist(toDelete.id);
      setData((list) => list.filter((a) => a.id !== toDelete.id));
      setToDelete(null);
      toast.success('Artist profile deleted.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Artists"
        description="Your artist profiles. You can manage more than one (for example a band and a solo project)."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New artist profile
          </button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="mic" title="No artist profiles" action={<button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>Create one</button>} />
      ) : (
        <div className="stack">
          {data.map((a) => (
            <section key={a.id} className="panel artist-panel">
              <Artwork src={a.imageUrl} alt="" size={96} rounded icon="mic" />
              <div className="artist-panel__info">
                <h2 className="panel__title">
                  {a.name} {a.verified ? <VerifiedBadge size={18} /> : null}
                </h2>
                <p className="text-muted text-sm">
                  {formatCount(a.followerCount)} followers · {a.totalSongCount} songs · {a.albumCount} albums · {a.videoCount} videos
                </p>
                <p className="text-sm">
                  <Icon name="badge-check" size={14} /> {VERIFY_TEXT[a.verificationStatus]}
                </p>
                {a.verificationStatus === 'rejected' && a.verificationNote ? <Alert type="warning">{a.verificationNote}</Alert> : null}
                <div className="row-gap wrap">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(a)}>
                    <Icon name="edit" size={14} /> Edit profile
                  </button>
                  <Link to={`/artists/${a.id}`} className="btn btn--ghost btn--sm">
                    <Icon name="external-link" size={14} /> View page
                  </Link>
                  {['none', 'rejected'].includes(a.verificationStatus) ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setVerifying(a)}>
                      <Icon name="badge-check" size={14} /> Request verification
                    </button>
                  ) : null}
                  <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setToDelete(a)}>
                    Delete
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
      {editing ? (
        <ArtistProfileDialog
          create={editing === 'new'}
          artist={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(res) => {
            setEditing(null);
            if (editing === 'new') reload();
            else replace(res);
          }}
        />
      ) : null}
      {verifying ? <VerificationDialog artist={verifying} onClose={() => setVerifying(null)} onDone={(a) => { replace(a); setVerifying(null); }} /> : null}
      {toDelete ? <ConfirmDialog title="Delete artist profile?" message={`"${toDelete.name}" can only be deleted once it has no songs, albums or videos.`} confirmLabel="Delete" danger busy={busy} onConfirm={remove} onClose={() => setToDelete(null)} /> : null}
    </>
  );
}
