import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, toFormData } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { cx, formatCount } from '../../utils/format.js';

const SOCIALS = ['instagram', 'x', 'tiktok', 'youtube', 'facebook', 'spotify', 'soundcloud'];

function ArtistDialog({ artist, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({
    name: artist?.name || '',
    bio: artist?.bio || '',
    location: artist?.location || '',
    ownerEmail: artist?.owner?.email || '',
    socialLinks: { ...(artist?.socialLinks || {}) },
  });
  const [image, setImage] = useState(null);
  const [cover, setCover] = useState(null);
  const [removed, setRemoved] = useState({ image: false, cover: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const pick = (key, setter) => (file) => {
    const problem = checkFile(file, 'image', settings.maxImageMb);
    setErrors((er) => ({ ...er, [key]: problem }));
    if (!problem) {
      setter(file);
      setRemoved((r) => ({ ...r, [key]: false }));
    }
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
          ownerEmail: form.ownerEmail.trim() || null,
          socialLinks: Object.fromEntries(Object.entries(form.socialLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
          ...(removed.image && !image ? { removeImage: true } : {}),
          ...(removed.cover && !cover ? { removeCover: true } : {}),
        },
        { image, cover }
      );
      const { data } = await adminService.saveArtist(artist?.id, body);
      toast.success(artist ? 'Artist updated.' : `Artist "${data.name}" created.`);
      onSaved(data);
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { name: err.message });
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Dialog
      title={artist ? 'Edit artist' : 'New artist'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="artist-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save artist'}
          </button>
        </>
      }
    >
      <form id="artist-form" className="stack" onSubmit={submit}>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} required autoFocus />
        <TextArea label="Biography" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} error={errors.bio} rows={4} maxLength={5000} />
        <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={80} />
        <TextField
          label="Owner account (email)"
          type="email"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          error={errors.ownerEmail}
          hint="The creator who manages this artist in Studio. Leave empty for a catalog-only artist. Assigning a listener makes them an artist."
        />
        <ImagePicker label="Artist image" round currentUrl={artist?.imageUrl} file={image} removed={removed.image} onChange={pick('image', setImage)} onRemove={() => { setImage(null); setRemoved((r) => ({ ...r, image: true })); }} error={errors.image} />
        <ImagePicker label="Header cover" currentUrl={artist?.coverUrl} file={cover} removed={removed.cover} onChange={pick('cover', setCover)} onRemove={() => { setCover(null); setRemoved((r) => ({ ...r, cover: true })); }} error={errors.cover} />
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

const VERIFY = { none: ['Not verified', 'muted'], pending: ['Requested', 'warning'], verified: ['Verified', 'success'], rejected: ['Declined', 'danger'] };

export default function ArtistsPage() {
  useMeta({ title: 'Artists · Admin', noindex: true });
  const toast = useToast();
  const [q, setQ] = useState('');
  const [verification, setVerification] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload, setData } = useAsync(
    () => adminService.artists({ q: term || undefined, page, limit: 25, sort: 'name', verification: verification || undefined }),
    [term, page, verification]
  );
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const decide = async (artist, decision) => {
    try {
      const res = await adminService.decideVerification(artist.id, decision);
      setData((list) => list.map((a) => (a.id === artist.id ? { ...a, ...res.data } : a)));
      toast.success(res.meta?.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminService.deleteArtist(toDelete.id);
      toast.success(`"${toDelete.name}" was deleted.`);
      setToDelete(null);
      reload();
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
        description="Artist profiles, their owners and verification."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New artist
          </button>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search artists" />
        <select className="input select select--inline" value={verification} onChange={(e) => { setVerification(e.target.value); setPage(1); }} aria-label="Filter by verification">
          <option value="">Any verification</option>
          <option value="pending">Requested</option>
          <option value="verified">Verified</option>
          <option value="none">Not verified</option>
          <option value="rejected">Declined</option>
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="mic" title={term ? 'No matching artists' : 'No artists yet'} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Artist</th>
                <th scope="col">Verification</th>
                <th scope="col" className="hide-md">Owner</th>
                <th scope="col" className="num hide-sm">Songs</th>
                <th scope="col" className="num hide-sm">Followers</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={a.imageUrl} alt="" size={40} rounded icon="mic" />
                      <div>
                        <Link to={`/artists/${a.id}`} className="table__title">
                          {a.name} {a.verified ? <VerifiedBadge size={13} /> : null}
                        </Link>
                        {a.verificationStatus === 'pending' && a.verificationMessage ? <span className="text-muted text-sm line-clamp-1">“{a.verificationMessage}”</span> : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={cx('badge', `badge--${VERIFY[a.verificationStatus][1]}`)}>{VERIFY[a.verificationStatus][0]}</span>
                  </td>
                  <td className="hide-md text-muted text-sm">{a.owner ? a.owner.email : '—'}</td>
                  <td className="num hide-sm">
                    <Link to={`/admin/songs?artist=${a.id}`}>{a.totalSongCount}</Link>
                  </td>
                  <td className="num hide-sm">{formatCount(a.followerCount)}</td>
                  <td>
                    <div className="table__actions">
                      {a.verificationStatus === 'verified' ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => decide(a, 'revoke')}>
                          Remove badge
                        </button>
                      ) : (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => decide(a, 'verify')}>
                          Verify
                        </button>
                      )}
                      {a.verificationStatus === 'pending' ? (
                        <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => decide(a, 'reject')}>
                          Decline
                        </button>
                      ) : null}
                      <button type="button" className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(a)} aria-label={`Delete ${a.name}`}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />

      {editing ? (
        <ArtistDialog
          artist={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title="Delete artist?"
          message={toDelete.totalSongCount || toDelete.albumCount ? `"${toDelete.name}" still has songs or albums. Delete or reassign them first.` : `"${toDelete.name}" will be permanently deleted.`}
          confirmLabel="Delete artist"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
