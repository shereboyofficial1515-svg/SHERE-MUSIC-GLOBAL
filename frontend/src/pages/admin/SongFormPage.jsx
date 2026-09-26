import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { Alert, ErrorState, PageLoader, ProgressBar } from '../../components/ui/Feedback.jsx';
import { Select, TextArea, TextField, Toggle } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker, StatusBadge } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, toFormData } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { AUDIO_ACCEPT, checkFile, readAudioDuration } from '../../utils/audio.js';
import { formatBytes, formatDuration } from '../../utils/format.js';

const EMPTY = {
  title: '',
  artistId: '',
  albumId: '',
  genreId: '',
  description: '',
  releaseDate: '',
  trackNumber: '',
  isFeatured: false,
  isPublished: false,
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
        <p className="field__hint">You can add a photo and biography later from the Artists page.</p>
      </form>
    </Dialog>
  );
}

function AudioPicker({ file, onChange, error, existing, songId, maxMb }) {
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
      const { data } = await adminService.songPreview(songId);
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
        <Icon name="music" size={28} className="text-sky" />
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
        <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} hidden onChange={(e) => { onChange(e.target.files[0] || null); e.target.value = ''; }} />
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

/** Upload a new song or edit an existing one (metadata, audio and artwork). */
export default function SongFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  useMeta({ title: isEdit ? 'Edit song · Admin' : 'Upload music · Admin', noindex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();

  const artists = useAsync(() => adminService.artistOptions(), []);
  const albums = useAsync(() => adminService.albumOptions(), []);
  const genres = useAsync(() => adminService.genres(), []);
  const existing = useAsync(() => adminService.song(id), [id], { enabled: isEdit });

  const [form, setForm] = useState(EMPTY);
  const [audio, setAudio] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [removeArtwork, setRemoveArtwork] = useState(false);
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
      isPublished: s.isPublished,
    });
  }, [existing.data]);

  // Abort an in-flight upload if the admin leaves the page.
  useEffect(() => () => uploadRef.current?.abort(), []);

  const artistAlbums = useMemo(() => (albums.data || []).filter((a) => a.artist_id === form.artistId), [albums.data, form.artistId]);

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

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const duration = audio ? await readAudioDuration(audio) : undefined;
    const fields = {
      ...form,
      title: form.title.trim(),
      albumId: form.albumId || null,
      genreId: form.genreId || null,
      description: form.description.trim() || null,
      releaseDate: form.releaseDate || null,
      trackNumber: form.trackNumber === '' ? null : form.trackNumber,
      ...(duration ? { duration } : {}),
      ...(removeArtwork && !artwork ? { removeArtwork: true } : {}),
    };
    const body = toFormData(fields, { audio, artwork });

    setProgress(0);
    const handle = isEdit ? adminService.updateSong(id, body, setProgress) : adminService.createSong(body, setProgress);
    uploadRef.current = handle;
    try {
      const res = await handle.promise;
      toast.success(isEdit ? 'Song updated.' : res.data.isPublished ? 'Upload complete. The song is live.' : 'Upload complete. The song is saved as a draft.');
      navigate(isEdit ? '/admin/songs' : `/admin/songs/${res.data.id}/edit`, { replace: !isEdit });
      if (isEdit) return;
    } catch (err) {
      if (err.code === 'ABORTED') {
        toast.info('Upload cancelled.');
      } else {
        const fieldErrors = err.fieldErrors || {};
        setErrors(fieldErrors);
        setFormError(err.message);
        toast.error(err.message);
      }
    } finally {
      uploadRef.current = null;
      setProgress(null);
    }
  };

  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if (isEdit && existing.loading) return <PageLoader />;

  const uploading = progress !== null;
  const song = existing.data;

  return (
    <>
      <AdminHeader
        title={isEdit ? 'Edit song' : 'Upload music'}
        description={isEdit ? song.title : 'Add a new song to SHERE MUSIC. It stays a draft until you publish it.'}
        actions={
          <>
            {isEdit ? <StatusBadge published={song.isPublished} /> : null}
            {isEdit && song.isPublished ? (
              <Link to={`/song/${id}`} className="btn btn--ghost btn--sm">
                <Icon name="external-link" size={16} /> View on site
              </Link>
            ) : null}
            <Link to="/admin/songs" className="btn btn--ghost btn--sm">
              <Icon name="arrow-left" size={16} /> All music
            </Link>
          </>
        }
      />

      {formError ? <Alert type="error">{formError}</Alert> : null}

      <form className="song-form" onSubmit={submit} noValidate>
        <div className="panel stack">
          <h2 className="panel__title">Song information</h2>
          <TextField label="Title" value={form.title} onChange={set('title')} error={errors.title} maxLength={160} required />
          <div className="form-row">
            <div className="field-with-action">
              <Select label="Artist" value={form.artistId} onChange={set('artistId')} error={errors.artistId} required>
                <option value="">{artists.loading ? 'Loading artists…' : 'Choose an artist'}</option>
                {(artists.data || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuickArtist(true)}>
                <Icon name="plus" size={14} /> New artist
              </button>
            </div>
            <Select label="Album" value={form.albumId} onChange={set('albumId')} error={errors.albumId} hint={form.artistId && !artistAlbums.length ? 'This artist has no albums yet.' : undefined} disabled={!form.artistId}>
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
              {(genres.data || []).map((g) => (
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
          <TextArea label="Description" value={form.description} onChange={set('description')} error={errors.description} rows={4} maxLength={5000} hint="Shown on the song page and used for search engine descriptions." />
        </div>

        <div className="stack">
          <div className="panel stack">
            <h2 className="panel__title">Files</h2>
            <AudioPicker file={audio} onChange={chooseAudio} error={errors.audio} existing={song?.audio} songId={id} maxMb={settings.maxAudioMb} />
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
              hint={`Square JPG, PNG or WebP, up to ${settings.maxImageMb} MB. Falls back to the album cover.`}
            />
          </div>
          <div className="panel stack">
            <h2 className="panel__title">Visibility</h2>
            <Toggle label="Published" description="Published songs are immediately visible, playable and downloadable." checked={form.isPublished} onChange={set('isPublished')} />
            <Toggle label="Featured" description="Show on the home page's Featured music row." checked={form.isFeatured} onChange={set('isFeatured')} />
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
            artists.setData((list) => [...(list || []), { id: artist.id, name: artist.name }].sort((a, b) => a.name.localeCompare(b.name)));
            setForm((f) => ({ ...f, artistId: artist.id, albumId: '' }));
            setQuickArtist(false);
          }}
        />
      ) : null}
    </>
  );
}
