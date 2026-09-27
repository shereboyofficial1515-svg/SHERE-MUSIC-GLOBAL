import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Dialog, { ConfirmDialog } from '../ui/Dialog.jsx';
import { Alert, ErrorState, PageLoader, ProgressBar, Spinner } from '../ui/Feedback.jsx';
import { Select, TextArea, TextField, Toggle } from '../ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../admin/AdminUI.jsx';
import StatusBadge from '../content/StatusBadge.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { toFormData } from '../../services/contentService.js';
import { adminService } from '../../services/adminService.js';
import { studioService } from '../../services/studioService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { formatBytes } from '../../utils/format.js';

const VIDEO_ACCEPT = '.mp4,.m4v,.webm,.mov,video/mp4,video/webm,video/quicktime';
const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'mov'];

function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

/** Upload / replace the video file straight to storage, with progress and cancel. */
function VideoUploader({ service, video, maxMb, onUploaded }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const handleRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => () => handleRef.current?.abort(), []);

  const choose = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!VIDEO_EXT.includes(ext)) return setError('Choose an MP4, WebM or MOV video.');
    if (f.size > maxMb * 1024 * 1024) return setError(`Videos must be ${maxMb} MB or smaller.`);
    setError(null);
    setFile(f);
    return undefined;
  };

  const upload = async () => {
    setProgress(0);
    setError(null);
    const duration = await readVideoDuration(file);
    const handle = service.uploadVideoFile(video.id, file, { onProgress: setProgress, duration });
    handleRef.current = handle;
    try {
      const res = await handle.promise;
      toast.success('Video uploaded.');
      setFile(null);
      onUploaded(res.data);
    } catch (err) {
      if (err.code === 'ABORTED') toast.info('Upload cancelled.');
      else setError(err.message || 'Video upload failed. Please try again.');
    } finally {
      handleRef.current = null;
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <div className="stack">
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          choose(e.dataTransfer.files[0]);
        }}
      >
        <Icon name="film" size={30} className="text-accent" />
        {file ? (
          <div>
            <strong>{file.name}</strong>
            <p className="text-muted text-sm">{formatBytes(file.size)}</p>
          </div>
        ) : video.hasVideo ? (
          <div>
            <strong>Video file uploaded</strong>
            <p className="text-muted text-sm">
              {video.video?.mime} · {formatBytes(video.video?.size)}
            </p>
          </div>
        ) : (
          <div>
            <strong>Drag your video here</strong>
            <p className="text-muted text-sm">MP4, WebM or MOV · up to {maxMb} MB</p>
          </div>
        )}
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Icon name="upload" size={16} /> {video.hasVideo || file ? 'Choose another file' : 'Choose video'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          hidden
          onChange={(e) => {
            choose(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error ? <Alert type="error">{error}</Alert> : null}
      {uploading ? (
        <div className="stack-sm" aria-live="polite">
          <strong>{progress < 100 ? `Uploading… ${progress}%` : 'Verifying the video…'}</strong>
          <ProgressBar value={progress < 100 ? progress : -1} label="Video upload progress" />
        </div>
      ) : null}
      {file ? (
        <div className="row-end">
          {uploading ? (
            <button type="button" className="btn btn--ghost" onClick={() => handleRef.current?.abort()}>
              Cancel upload
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => setFile(null)}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={upload} disabled={uploading}>
            <Icon name="upload" size={16} /> {video.hasVideo ? 'Replace video' : 'Upload video'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SubtitlesManager({ service, video, languages, onChange }) {
  const toast = useToast();
  const [list, setList] = useState(video.subtitles || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ language: '', label: '', isDefault: false });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const free = languages.filter((l) => !list.some((s) => s.language === l.code));

  const add = async (e) => {
    e.preventDefault();
    if (!form.language || !file) return setError('Choose a language and a .vtt or .srt file.');
    setBusy(true);
    setError(null);
    try {
      const { data } = await service.addSubtitle(video.id, form, file);
      const next = [...list.filter((s) => s.language !== data.language).map((s) => (data.isDefault ? { ...s, isDefault: false } : s)), data];
      setList(next);
      onChange(next);
      setAdding(false);
      setForm({ language: '', label: '', isDefault: false });
      setFile(null);
      toast.success(`${data.label} subtitles added.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const remove = async (sub) => {
    try {
      await service.deleteSubtitle(video.id, sub.id);
      const next = list.filter((s) => s.id !== sub.id);
      setList(next);
      onChange(next);
      toast.success(`${sub.label} subtitles removed.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="stack">
      {list.length ? (
        <ul className="sub-list">
          {list.map((s) => (
            <li key={s.id} className="sub-row">
              <Icon name="captions" size={18} />
              <span style={{ flex: 1 }}>
                <strong>{s.label}</strong> <span className="text-muted text-sm">({s.language})</span>
                {s.isDefault ? <span className="badge" style={{ marginLeft: 8 }}>Default</span> : null}
              </span>
              <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(s)} aria-label={`Delete ${s.label} subtitles`}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">No subtitles yet. Add WebVTT (.vtt) or SubRip (.srt) files — SRT is converted automatically.</p>
      )}
      <div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAdding(true)} disabled={!free.length}>
          <Icon name="plus" size={14} /> Add subtitles
        </button>
      </div>
      {adding ? (
        <Dialog
          title="Add subtitles"
          size="sm"
          busy={busy}
          onClose={() => setAdding(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" form="sub-form" className="btn btn--primary" disabled={busy}>
                {busy ? 'Uploading…' : 'Add'}
              </button>
            </>
          }
        >
          <form id="sub-form" className="stack" onSubmit={add}>
            {error ? <Alert type="error">{error}</Alert> : null}
            <Select
              label="Language"
              value={form.language}
              onChange={(e) => {
                const lang = free.find((l) => l.code === e.target.value);
                setForm((f) => ({ ...f, language: e.target.value, label: lang?.label || f.label }));
              }}
              required
            >
              <option value="">Choose a language</option>
              {free.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <TextField label="Label shown to viewers" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} maxLength={40} required />
            <div className="field">
              <span className="field__label">Subtitle file</span>
              <div className="row-gap wrap">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => inputRef.current?.click()}>
                  <Icon name="upload" size={14} /> {file ? 'Change file' : 'Choose .vtt or .srt'}
                </button>
                {file ? <span className="text-sm text-muted">{file.name}</span> : null}
              </div>
              <input ref={inputRef} type="file" accept=".vtt,.srt,text/vtt" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
            </div>
            <Toggle label="Default track" description="Shown first when viewers turn captions on." checked={form.isDefault} onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * Create/edit a music video. scope 'studio': own artists only, review workflow.
 * scope 'admin': any artist, direct status control and featuring.
 */
export default function VideoEditor({ scope, id }) {
  const isAdmin = scope === 'admin';
  const service = isAdmin ? adminService : studioService;
  const base = isAdmin ? '/admin/videos' : '/studio/videos';
  const isEdit = Boolean(id);
  const toast = useToast();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const options = useAsync(async () => {
    if (!isAdmin) return studioService.options();
    const [artists, genres, songs, site] = await Promise.all([adminService.artistOptions(), adminService.genres(), adminService.songs({ limit: 100, sort: 'title' }), adminService.settings()]);
    return {
      data: {
        artists: artists.data,
        genres: genres.data,
        songs: songs.data.map((s) => ({ id: s.id, title: s.title, artist_id: s.artist.id })),
        subtitleLanguages: site.data.subtitleLanguages,
        limits: { videoMb: site.data.maxVideoMb, imageMb: site.data.maxImageMb },
      },
    };
  }, []);
  const existing = useAsync(() => service.video(id), [id], { enabled: isEdit });

  const [form, setForm] = useState({ title: '', artistId: '', songId: '', genreId: '', description: '', releaseDate: '', status: 'draft', isFeatured: false });
  const [thumb, setThumb] = useState(null);
  const [removeThumb, setRemoveThumb] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const v = existing.data;
    if (!v) return;
    setForm({
      title: v.title,
      artistId: v.artist.id,
      songId: v.song?.id || '',
      genreId: v.genre?.id || '',
      description: v.description || '',
      releaseDate: v.releaseDate || '',
      status: v.status,
      isFeatured: v.isFeatured,
    });
  }, [existing.data]);

  useEffect(() => {
    const artists = options.data?.artists || [];
    if (!isEdit && !form.artistId && artists.length === 1) setForm((f) => ({ ...f, artistId: artists[0].id }));
  }, [options.data, isEdit, form.artistId]);

  const artistSongs = useMemo(() => (options.data?.songs || []).filter((s) => s.artist_id === form.artistId), [options.data, form.artistId]);
  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value, ...(key === 'artistId' ? { songId: '' } : {}) }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const save = async (e) => {
    e?.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Enter the video title.';
    if (!form.artistId) next.artistId = 'Choose an artist.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy('save');
    try {
      const body = toFormData(
        {
          title: form.title.trim(),
          artistId: form.artistId,
          songId: form.songId || null,
          genreId: form.genreId || null,
          description: form.description.trim() || null,
          releaseDate: form.releaseDate || null,
          ...(isAdmin ? { isFeatured: form.isFeatured, status: form.status } : {}),
          ...(removeThumb && !thumb ? { removeThumbnail: true } : {}),
        },
        { thumbnail: thumb }
      );
      const res = isEdit ? await service.updateVideo(id, body) : await service.createVideo(body);
      toast.success(res.meta?.message || (isEdit ? 'Video saved.' : 'Video created. Now upload the video file.'));
      setThumb(null);
      setRemoveThumb(false);
      if (isEdit) existing.setData((v) => ({ ...v, ...res.data }));
      else navigate(`${base}/${res.data.id}`, { replace: true });
    } catch (err) {
      const fe = err.fieldErrors || {};
      setErrors(fe);
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const act = async (action) => {
    setBusy(action);
    try {
      const res =
        action === 'submit'
          ? await studioService.submitVideo(id)
          : action === 'publish'
            ? await studioService.publishVideo(id, true)
            : action === 'unpublish'
              ? await studioService.publishVideo(id, false)
              : await adminService.reviewVideo(id, action, action === 'reject' ? reason : undefined);
      existing.setData((v) => ({ ...v, ...res.data }));
      setForm((f) => ({ ...f, status: res.data.status }));
      setRejecting(false);
      toast.success(res.meta?.message || 'Updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await service.deleteVideo(id);
      toast.success('Video deleted.');
      navigate(base, { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy(null);
    }
  };

  if (options.error) return <ErrorState error={options.error} onRetry={options.reload} />;
  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if (options.loading || (isEdit && existing.loading)) return <PageLoader />;

  const video = existing.data;
  const limits = options.data.limits || {};
  const maxVideoMb = limits.videoMb || settings.maxVideoMb;

  if (!isAdmin && !options.data.artists.length) {
    return (
      <>
        <AdminHeader title="New music video" />
        <Alert type="info">
          Create an artist profile first. <Link to="/studio/artists">Go to Artists</Link>
        </Alert>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title={isEdit ? 'Edit music video' : 'New music video'}
        description={isEdit ? video.title : 'Step 1: add the details. Step 2: upload the video. Step 3: add subtitles and submit.'}
        actions={
          <>
            {isEdit ? <StatusBadge status={video.status} /> : null}
            {isEdit && video.status === 'published' ? (
              <Link to={`/videos/${id}`} className="btn btn--ghost btn--sm">
                <Icon name="external-link" size={16} /> View
              </Link>
            ) : null}
            <Link to={base} className="btn btn--ghost btn--sm">
              <Icon name="arrow-left" size={16} /> All videos
            </Link>
          </>
        }
      />
      {isEdit && video.status === 'rejected' && video.rejectionReason ? (
        <Alert type="error">
          <strong>Changes requested:</strong> {video.rejectionReason}
        </Alert>
      ) : null}

      <div className="song-form">
        <form className="panel stack" onSubmit={save} noValidate>
          <h2 className="panel__title">Details</h2>
          <TextField label="Title" value={form.title} onChange={set('title')} error={errors.title} maxLength={160} required />
          <div className="form-row">
            <Select label="Artist" value={form.artistId} onChange={set('artistId')} error={errors.artistId} required>
              <option value="">Choose an artist</option>
              {options.data.artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select label="Linked song (optional)" value={form.songId} onChange={set('songId')} disabled={!form.artistId}>
              <option value="">None</option>
              {artistSongs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-row">
            <Select label="Category" value={form.genreId} onChange={set('genreId')}>
              <option value="">No category</option>
              {(options.data.genres || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <TextField label="Release date" type="date" value={form.releaseDate} onChange={set('releaseDate')} />
          </div>
          <TextArea label="Description" value={form.description} onChange={set('description')} rows={4} maxLength={5000} />
          <ImagePicker
            label="Thumbnail"
            currentUrl={video?.thumbnailUrl}
            file={thumb}
            removed={removeThumb}
            onChange={(f) => {
              const problem = checkFile(f, 'image', settings.maxImageMb);
              if (problem) return toast.error(problem);
              setThumb(f);
              setRemoveThumb(false);
              return undefined;
            }}
            onRemove={() => {
              setThumb(null);
              setRemoveThumb(true);
            }}
            hint="16:9 JPG, PNG or WebP."
          />
          {isAdmin ? (
            <>
              <Select label="Status" value={form.status} onChange={set('status')}>
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved (not live)</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
              </Select>
              <Toggle label="Featured" description="Show in the SHERE MUSIC VIDEO hero." checked={form.isFeatured} onChange={set('isFeatured')} />
            </>
          ) : null}
          <div className="row-end">
            <button type="submit" className="btn btn--primary" disabled={busy === 'save'}>
              <Icon name="check" size={16} /> {busy === 'save' ? 'Saving…' : isEdit ? 'Save details' : 'Create & continue'}
            </button>
          </div>
        </form>

        <div className="stack">
          {isEdit ? (
            <>
              <section className="panel stack">
                <h2 className="panel__title">Video file</h2>
                <VideoUploader service={service} video={video} maxMb={maxVideoMb} onUploaded={(v) => existing.setData((cur) => ({ ...cur, ...v }))} />
                {video.hasVideo && video.processingStatus === 'ready' ? (
                  <VideoPlayer key={`${video.video?.size}-${(video.subtitles || []).length}`} video={{ ...video, subtitles: video.subtitles || [] }} fetchStream={() => service.videoPreview(video.id)} fetchSubtitle={(sub) => service.subtitleBlobUrl(video.id, sub.id)} />
                ) : video.processingStatus === 'processing' ? (
                  <p className="text-muted">
                    <Spinner size={14} /> Processing…
                  </p>
                ) : null}
              </section>
              <section className="panel stack">
                <h2 className="panel__title">Subtitles</h2>
                <SubtitlesManager service={service} video={video} languages={options.data.subtitleLanguages || settings.subtitleLanguages || []} onChange={(subs) => existing.setData((v) => ({ ...v, subtitles: subs }))} />
              </section>
              <section className="panel stack">
                <h2 className="panel__title">{isAdmin ? 'Review' : 'Publishing'}</h2>
                {isAdmin ? (
                  video.status === 'pending' ? (
                    <div className="row-gap wrap">
                      <button type="button" className="btn btn--primary" onClick={() => act('publish')} disabled={Boolean(busy)}>
                        Approve & publish
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={() => act('approve')} disabled={Boolean(busy)}>
                        Approve only
                      </button>
                      <button type="button" className="btn btn--ghost text-danger" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted text-sm">Use the Status field to publish, unpublish or change this video’s state.</p>
                  )
                ) : (
                  <>
                    <p className="text-muted">
                      {{
                        draft: video.hasVideo ? 'Ready when you are — submit it for review.' : 'Upload the video file, then submit it for review.',
                        pending: 'Submitted — waiting for an admin to review it.',
                        approved: 'Approved! Publish it whenever you’re ready.',
                        published: 'Live on SHERE MUSIC VIDEO.',
                        rejected: 'Changes requested. Update the video, then submit again.',
                      }[video.status]}
                    </p>
                    <div className="row-gap wrap">
                      {['draft', 'rejected'].includes(video.status) ? (
                        <button type="button" className="btn btn--primary" onClick={() => act('submit')} disabled={Boolean(busy) || video.processingStatus !== 'ready'}>
                          <Icon name="send" size={16} /> {settings.artistAutoPublish ? 'Publish' : 'Submit for review'}
                        </button>
                      ) : null}
                      {video.status === 'approved' ? (
                        <button type="button" className="btn btn--primary" onClick={() => act('publish')} disabled={Boolean(busy)}>
                          Publish now
                        </button>
                      ) : null}
                      {video.status === 'published' ? (
                        <button type="button" className="btn btn--secondary" onClick={() => act('unpublish')} disabled={Boolean(busy)}>
                          Unpublish
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
                <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setConfirmDelete(true)} style={{ justifySelf: 'start' }}>
                  <Icon name="trash" size={14} /> Delete video
                </button>
              </section>
            </>
          ) : (
            <section className="panel stack">
              <h2 className="panel__title">Next steps</h2>
              <ol className="steps">
                <li>Save the details.</li>
                <li>Upload the video file (MP4, WebM or MOV, up to {maxVideoMb} MB).</li>
                <li>Add subtitles in as many languages as you like.</li>
                <li>{isAdmin ? 'Publish it.' : settings.artistAutoPublish ? 'Publish it.' : 'Submit it for review — an admin approves it before it goes live.'}</li>
              </ol>
            </section>
          )}
        </div>
      </div>

      {rejecting ? (
        <Dialog
          title="Request changes"
          size="sm"
          onClose={() => setRejecting(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => act('reject')} disabled={!reason.trim() || busy === 'reject'}>
                Reject
              </button>
            </>
          }
        >
          <TextArea label="Reason (sent to the artist)" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} autoFocus />
        </Dialog>
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog title="Delete this video?" message="The video file, thumbnail and subtitles will be permanently deleted." confirmLabel="Delete video" danger busy={busy === 'delete'} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
      ) : null}
    </>
  );
}
