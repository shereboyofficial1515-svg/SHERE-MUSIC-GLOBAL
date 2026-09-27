import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Dialog from '../ui/Dialog.jsx';
import { Alert, ErrorState, PageLoader, ProgressBar } from '../ui/Feedback.jsx';
import { Select, TextArea, TextField, Toggle } from '../ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../admin/AdminUI.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { toFormData } from '../../services/contentService.js';
import { adminService } from '../../services/adminService.js';
import { studioService } from '../../services/studioService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { AUDIO_ACCEPT, checkFile, readAudioDuration } from '../../utils/audio.js';
import { looksLikeLrc, parseLrc, parsePlainLyrics } from '../../utils/lyricsEngine.js';
import { formatBytes, formatDuration, formatMoney } from '../../utils/format.js';

const EMPTY = {
  title: '',
  artistId: '',
  albumId: '',
  genreId: '',
  description: '',
  releaseDate: '',
  trackNumber: '',
  isFeatured: false,
  status: 'draft',
};

function QuickArtistDialog({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the artist name.');
    setBusy(true);
    try {
      const { data } = await adminService.saveArtist(null, toFormData({ name: name.trim() }));
      toast.success(`Artist "${data.name}" created.`);
      onCreated(data);
    } catch (err) {
      setError(err.fieldErrors?.name || err.message);
      setBusy(false);
    }
    return undefined;
  };
  return (
    <Dialog
      title="New artist"
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="quick-artist" className="btn btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create artist'}
          </button>
        </>
      }
    >
      <form id="quick-artist" onSubmit={submit}>
        <TextField label="Artist name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} error={error} maxLength={120} autoFocus />
      </form>
    </Dialog>
  );
}

function AudioPicker({ file, onChange, error, existing, onPreview, maxMb }) {
  const inputRef = useRef(null);
  const [duration, setDuration] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    if (!file) {
      setDuration(null);
      return undefined;
    }
    let cancelled = false;
    readAudioDuration(file).then((d) => !cancelled && setDuration(d));
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const loadExistingPreview = async () => {
    setPreviewError(null);
    try {
      const { data } = await onPreview();
      setPreviewUrl(data.url);
    } catch (err) {
      setPreviewError(err.message);
    }
  };

  return (
    <div className={`field ${error ? 'field--invalid' : ''}`}>
      <span className="field__label">
        Audio file{!existing ? <span className="field__required"> *</span> : null}
      </span>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) onChange(e.dataTransfer.files[0]);
        }}
      >
        <Icon name="music" size={28} className="text-accent" />
        {file ? (
          <div>
            <strong>{file.name}</strong>
            <p className="text-muted text-sm">
              {formatBytes(file.size)}
              {duration ? ` · ${formatDuration(duration)}` : ''}
            </p>
          </div>
        ) : existing ? (
          <div>
            <strong>Current audio</strong>
            <p className="text-muted text-sm">
              {existing.mime} · {formatBytes(existing.size)}
            </p>
          </div>
        ) : (
          <div>
            <strong>Drag an audio file here</strong>
            <p className="text-muted text-sm">MP3, WAV, M4A or AAC · up to {maxMb} MB</p>
          </div>
        )}
        <div className="row-gap wrap">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => inputRef.current?.click()}>
            <Icon name="upload" size={16} /> {file || existing ? 'Replace audio' : 'Choose file'}
          </button>
          {existing && !file && !previewUrl ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadExistingPreview}>
              <Icon name="play" size={14} /> Preview
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AUDIO_ACCEPT}
          hidden
          onChange={(e) => {
            onChange(e.target.files[0] || null);
            e.target.value = '';
          }}
        />
      </div>
      {previewUrl ? <audio className="audio-preview" controls src={previewUrl} preload="metadata" /> : null}
      {previewError ? <p className="field__error">{previewError}</p> : null}
      {error ? (
        <p className="field__error">
          <Icon name="alert-circle" size={14} /> {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Upload a new song or edit an existing one.
 * scope 'admin': any artist, direct status control, featuring.
 * scope 'studio': only the creator's artists; save as draft or submit for review.
 */
export default function SongEditor({ scope, id }) {
  const isAdmin = scope === 'admin';
  const service = isAdmin ? adminService : studioService;
  const base = isAdmin ? '/admin/songs' : '/studio/music';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const { user } = useAuth();
  // Paid submissions: creators (not admins) pay the submission fee to send a song for review.
  const submissionFee = settings.monetization?.artistSubmission;
  const feeRequired = !isAdmin && user?.role !== 'admin' && Boolean(submissionFee?.enabled);
  const feeLabel = feeRequired ? formatMoney(submissionFee.fee, settings.monetization.currency) : null;

  const options = useAsync(async () => {
    if (!isAdmin) return studioService.options();
    const [artists, albums, genres] = await Promise.all([adminService.artistOptions(), adminService.albumOptions(), adminService.genres()]);
    return { data: { artists: artists.data, albums: albums.data, genres: genres.data } };
  }, []);
  const existing = useAsync(() => service.song(id), [id], { enabled: isEdit });

  const [form, setForm] = useState(EMPTY);
  const [audio, setAudio] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [removeArtwork, setRemoveArtwork] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [submitForReview, setSubmitForReview] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [quickArtist, setQuickArtist] = useState(false);
  const uploadRef = useRef(null);

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    setForm({
      title: s.title,
      artistId: s.artist.id,
      albumId: s.album?.id || '',
      genreId: s.genre?.id || '',
      description: s.description || '',
      releaseDate: s.releaseDate || '',
      trackNumber: s.trackNumber ?? '',
      isFeatured: s.isFeatured,
      status: s.status,
    });
  }, [existing.data]);

  // A creator with one artist profile doesn't need to pick it.
  useEffect(() => {
    const artists = options.data?.artists || [];
    if (!isEdit && !form.artistId && artists.length === 1) setForm((f) => ({ ...f, artistId: artists[0].id }));
  }, [options.data, isEdit, form.artistId]);

  useEffect(() => () => uploadRef.current?.abort(), []);

  const artistAlbums = useMemo(() => (options.data?.albums || []).filter((a) => a.artist_id === form.artistId), [options.data, form.artistId]);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value, ...(key === 'artistId' ? { albumId: '' } : {}) }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const chooseAudio = (file) => {
    const problem = checkFile(file, 'audio', settings.maxAudioMb);
    setErrors((er) => ({ ...er, audio: problem }));
    setAudio(problem ? null : file);
    if (!problem && file && !form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').slice(0, 160) }));
  };

  const chooseArtwork = (file) => {
    const problem = checkFile(file, 'image', settings.maxImageMb);
    setErrors((er) => ({ ...er, artwork: problem }));
    setArtwork(problem ? null : file);
    if (!problem) setRemoveArtwork(false);
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Enter the song title.';
    if (!form.artistId) next.artistId = 'Choose an artist.';
    if (!isEdit && !audio) next.audio = 'Choose an audio file.';
    if (form.trackNumber && !(Number(form.trackNumber) > 0)) next.trackNumber = 'Track number must be a positive number.';
    setErrors(next);
    return !Object.keys(next).length;
  };

  /** Optional lyrics typed on the upload form: LRC becomes synced lyrics, plain text unsynced. */
  const saveInitialLyrics = async (songId) => {
    const text = lyricsText.trim();
    if (!text) return;
    const synced = looksLikeLrc(text);
    const lines = synced ? parseLrc(text) : parsePlainLyrics(text);
    try {
      await service.saveLyrics(songId, null, { language: 'en', isSynced: synced, lines, source: 'manual', submit: !isAdmin && submitForReview, publish: isAdmin && form.status === 'published' });
    } catch (err) {
      toast.warning(`The song was saved, but the lyrics weren't: ${err.message}`);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const duration = audio ? await readAudioDuration(audio) : undefined;
    const fields = {
      title: form.title.trim(),
      artistId: form.artistId,
      albumId: form.albumId || null,
      genreId: form.genreId || null,
      description: form.description.trim() || null,
      releaseDate: form.releaseDate || null,
      trackNumber: form.trackNumber === '' ? null : form.trackNumber,
      ...(isAdmin ? { isFeatured: form.isFeatured, status: form.status } : {}),
      ...(!isAdmin && !isEdit && submitForReview ? { submit: true } : {}),
      ...(duration ? { duration } : {}),
      ...(removeArtwork && !artwork ? { removeArtwork: true } : {}),
    };
    const body = toFormData(fields, { audio, artwork });

    setProgress(0);
    const handle = isEdit ? service.updateSong(id, body, setProgress) : service.createSong(body, setProgress);
    uploadRef.current = handle;
    try {
      const res = await handle.promise;
      if (!isEdit) await saveInitialLyrics(res.data.id);
      const status = res.data.status;
      toast.success(
        isEdit
          ? res.meta?.message || 'Song saved.'
          : status === 'published'
            ? 'Upload complete. The song is live.'
            : status === 'pending'
              ? 'Upload complete and submitted for review.'
              : 'Upload complete. Saved as a draft.'
      );
      if (isEdit) existing.setData(res.data);
      else if (feeRequired && submitForReview) navigate(`/studio/submit/${res.data.id}`, { replace: true });
      else navigate(`${base}/${res.data.id}${isAdmin ? '/edit' : ''}`, { replace: true });
    } catch (err) {
      if (err.code === 'ABORTED') toast.info('Upload cancelled.');
      else {
        setErrors(err.fieldErrors || {});
        setFormError(err.message);
        toast.error(err.message);
      }
    } finally {
      uploadRef.current = null;
      setProgress(null);
    }
  };

  const workflow = async (action) => {
    try {
      const res =
        action === 'submit'
          ? await studioService.submitSong(id)
          : action === 'publish'
            ? await studioService.publishSong(id, true)
            : await studioService.publishSong(id, false);
      existing.setData(res.data);
      setForm((f) => ({ ...f, status: res.data.status }));
      toast.success(res.meta?.message || 'Updated.');
    } catch (err) {
      if (err.code === 'SUBMISSION_FEE_REQUIRED') navigate(`/studio/submit/${id}`);
      else toast.error(err.message);
    }
  };

  if (options.error) return <ErrorState error={options.error} onRetry={options.reload} />;
  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if ((isEdit && existing.loading) || options.loading) return <PageLoader />;

  const song = existing.data;
  const uploading = progress !== null;
  const artists = options.data.artists || [];

  if (!isAdmin && !artists.length) {
    return (
      <>
        <AdminHeader title="Upload music" />
        <Alert type="info">
          Create an artist profile first. <Link to="/studio/artists">Go to Artists</Link>
        </Alert>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title={isEdit ? 'Edit song' : 'Upload music'}
        description={isEdit ? song.title : isAdmin ? 'Add a new song. It stays a draft until you publish it.' : 'Upload your song. Save it as a draft, then submit it for review when it’s ready.'}
        actions={
          <>
            {isEdit ? <StatusBadge status={song.status} /> : null}
            {isEdit ? (
              <Link to={`${isAdmin ? '/admin' : '/studio'}/lyrics/${id}`} className="btn btn--secondary btn--sm">
                <Icon name="lyrics" size={16} /> Lyrics
              </Link>
            ) : null}
            {isEdit && song.status === 'published' ? (
              <Link to={`/song/${id}`} className="btn btn--ghost btn--sm">
                <Icon name="external-link" size={16} /> View on site
              </Link>
            ) : null}
            <Link to={base} className="btn btn--ghost btn--sm">
              <Icon name="arrow-left" size={16} /> All music
            </Link>
          </>
        }
      />

      {isEdit && song.status === 'rejected' && song.rejectionReason ? (
        <Alert type="error">
          <strong>Changes requested:</strong> {song.rejectionReason}
        </Alert>
      ) : null}
      {formError ? <Alert type="error">{formError}</Alert> : null}

      <form className="song-form" onSubmit={submit} noValidate>
        <div className="panel stack">
          <h2 className="panel__title">Song information</h2>
          <TextField label="Song title" value={form.title} onChange={set('title')} error={errors.title} maxLength={160} required />
          <div className="form-row">
            <div className="field-with-action">
              <Select label="Artist" value={form.artistId} onChange={set('artistId')} error={errors.artistId} required>
                <option value="">Choose an artist</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              {isAdmin ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuickArtist(true)}>
                  <Icon name="plus" size={14} /> New artist
                </button>
              ) : null}
            </div>
            <Select label="Album" value={form.albumId} onChange={set('albumId')} error={errors.albumId} hint={form.artistId && !artistAlbums.length ? 'No albums yet for this artist.' : undefined} disabled={!form.artistId}>
              <option value="">No album (single)</option>
              {artistAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-row">
            <Select label="Genre" value={form.genreId} onChange={set('genreId')} error={errors.genreId}>
              <option value="">No genre</option>
              {(options.data.genres || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <TextField label="Release date" type="date" value={form.releaseDate} onChange={set('releaseDate')} error={errors.releaseDate} />
          </div>
          <div className="form-row">
            <TextField label="Track number" type="number" min={1} max={999} inputMode="numeric" value={form.trackNumber} onChange={set('trackNumber')} error={errors.trackNumber} hint="Position on the album (optional)." />
            <div />
          </div>
          <TextArea label="Description" value={form.description} onChange={set('description')} error={errors.description} rows={4} maxLength={5000} />
          {!isEdit ? (
            <TextArea
              label="Lyrics (optional)"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              rows={6}
              hint="Paste plain lyrics, or LRC ([00:12.50]Line) for synced lyrics. You can sync them line by line later in the lyrics editor."
            />
          ) : null}
        </div>

        <div className="stack">
          <div className="panel stack">
            <h2 className="panel__title">Files</h2>
            <AudioPicker file={audio} onChange={chooseAudio} error={errors.audio} existing={song?.audio} onPreview={() => service.songPreview(id)} maxMb={settings.maxAudioMb} />
            <ImagePicker
              label="Artwork"
              currentUrl={song?.hasOwnArtwork ? song.artworkUrl : null}
              file={artwork}
              removed={removeArtwork}
              onChange={chooseArtwork}
              onRemove={() => {
                setArtwork(null);
                setRemoveArtwork(true);
              }}
              error={errors.artwork}
              hint={`Square JPG, PNG or WebP, up to ${settings.maxImageMb} MB.`}
            />
          </div>

          <div className="panel stack">
            <h2 className="panel__title">{isAdmin ? 'Status & visibility' : 'Publishing'}</h2>
            {isAdmin ? (
              <>
                <Select label="Status" value={form.status} onChange={set('status')} hint="Published songs are immediately visible, playable and downloadable.">
                  <option value="draft">Draft</option>
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved (not live)</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                </Select>
                <Toggle label="Spotlight" description="Feature on the home page." checked={form.isFeatured} onChange={set('isFeatured')} />
              </>
            ) : isEdit ? (
              <StudioWorkflow song={song} onAction={workflow} autoPublish={settings.artistAutoPublish} feeLabel={feeLabel} />
            ) : feeRequired ? (
              <Toggle
                label={`Continue to submit after upload (${feeLabel} fee)`}
                description={`Music submission fee: ${feeLabel}. After uploading you'll review the submission and pay; the song is then sent to the SHERE MUSIC team for review. Leave off to keep it as a private draft.`}
                checked={submitForReview}
                onChange={setSubmitForReview}
              />
            ) : (
              <Toggle
                label={settings.artistAutoPublish ? 'Publish when uploaded' : 'Submit for review after upload'}
                description={settings.artistAutoPublish ? 'Your song goes live straight away.' : 'An admin reviews every new song before it goes live. Leave off to keep it as a private draft.'}
                checked={submitForReview}
                onChange={setSubmitForReview}
              />
            )}
          </div>

          {uploading ? (
            <div className="panel stack-sm" aria-live="polite">
              <strong>{progress < 100 ? `Uploading… ${progress}%` : 'Processing on the server…'}</strong>
              <ProgressBar value={progress < 100 ? progress : -1} label="Upload progress" />
            </div>
          ) : null}
          <div className="row-end">
            {uploading ? (
              <button type="button" className="btn btn--ghost" onClick={() => uploadRef.current?.abort()}>
                Cancel upload
              </button>
            ) : null}
            <button type="submit" className="btn btn--primary btn--lg" disabled={uploading}>
              <Icon name={isEdit ? 'check' : 'upload'} size={18} />
              {uploading ? 'Saving…' : isEdit ? 'Save changes' : 'Upload song'}
            </button>
          </div>
        </div>
      </form>

      {quickArtist ? (
        <QuickArtistDialog
          onClose={() => setQuickArtist(false)}
          onCreated={(artist) => {
            options.setData((d) => ({ ...d, artists: [...d.artists, { id: artist.id, name: artist.name }].sort((a, b) => a.name.localeCompare(b.name)) }));
            setForm((f) => ({ ...f, artistId: artist.id, albumId: '' }));
            setQuickArtist(false);
          }}
        />
      ) : null}
    </>
  );
}

function StudioWorkflow({ song, onAction, autoPublish, feeLabel }) {
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    setBusy(true);
    await onAction(action);
    setBusy(false);
  };
  const text = {
    draft: 'This song is a private draft.',
    pending: 'Submitted — waiting for an admin to review it.',
    approved: 'Approved! Publish it whenever you’re ready.',
    published: 'Live on SHERE MUSIC.',
    rejected: 'Changes requested. Edit the song, then submit it again.',
  }[song.status];
  return (
    <div className="stack-sm">
      <p className="text-muted">{text}</p>
      <p className="field__hint">
        {feeLabel
          ? `Music submission fee: ${feeLabel}. Paid submissions are reviewed by the SHERE MUSIC team before going live.`
          : autoPublish
            ? 'Submitting publishes immediately.'
            : 'Editing an approved or published song sends it back for review.'}
      </p>
      <div className="row-gap wrap">
        {['draft', 'rejected'].includes(song.status) && feeLabel ? (
          <Link to={`/studio/submit/${song.id}`} className="btn btn--primary">
            <Icon name="send" size={16} /> Submit for review — {feeLabel}
          </Link>
        ) : null}
        {['draft', 'rejected'].includes(song.status) && !feeLabel ? (
          <button type="button" className="btn btn--primary" onClick={() => run('submit')} disabled={busy}>
            <Icon name="send" size={16} /> {autoPublish ? 'Publish' : 'Submit for review'}
          </button>
        ) : null}
        {song.status === 'approved' ? (
          <button type="button" className="btn btn--primary" onClick={() => run('publish')} disabled={busy}>
            <Icon name="check" size={16} /> Publish now
          </button>
        ) : null}
        {song.status === 'published' ? (
          <button type="button" className="btn btn--secondary" onClick={() => run('unpublish')} disabled={busy}>
            <Icon name="eye-off" size={16} /> Unpublish
          </button>
        ) : null}
      </div>
    </div>
  );
}
