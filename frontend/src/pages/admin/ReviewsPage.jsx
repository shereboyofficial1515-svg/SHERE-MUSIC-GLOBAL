import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { TextArea } from '../../components/ui/Form.jsx';
import { AdminHeader } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { timeAgo } from '../../utils/format.js';

function ReasonDialog({ title, onSubmit, onClose, busy, cta = 'Reject', optional = false }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onSubmit(reason.trim())} disabled={busy || (!optional && !reason.trim())}>
            {cta}
          </button>
        </>
      }
    >
      <TextArea label={optional ? 'Note (optional, sent to the artist)' : 'Reason (sent to the artist)'} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} autoFocus />
    </Dialog>
  );
}

/** Everything creators submitted, oldest first, with one-click decisions. */
export default function ReviewsPage() {
  useMeta({ title: 'Reviews · Admin', noindex: true });
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => adminService.reviews('all'), []);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null); // { kind, item }

  const drop = (kind, id) => setData((d) => ({ ...d, [kind]: d[kind].filter((x) => x.id !== id) }));

  const decide = async (kind, item, decision, reason) => {
    setBusy(`${kind}:${item.id}`);
    try {
      const res =
        kind === 'songs'
          ? await adminService.reviewSong(item.id, decision, reason)
          : kind === 'videos'
            ? await adminService.reviewVideo(item.id, decision, reason)
            : kind === 'lyrics'
              ? await adminService.reviewLyrics(item.songId, item.id, decision, reason)
              : await adminService.decideVerification(item.id, decision, reason);
      drop(kind, item.id);
      setRejecting(null);
      toast.success(res.meta?.message || 'Done.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;
  const empty = !data.songs.length && !data.videos.length && !data.lyrics.length && !data.verifications.length;

  const Actions = ({ kind, item, previewTo }) => (
    <div className="table__actions">
      {previewTo ? (
        <Link to={previewTo} className="btn btn--ghost btn--sm">
          Open
        </Link>
      ) : null}
      <button type="button" className="btn btn--primary btn--sm" onClick={() => decide(kind, item, kind === 'verifications' ? 'verify' : 'publish')} disabled={busy === `${kind}:${item.id}`}>
        {kind === 'verifications' ? 'Verify' : 'Approve & publish'}
      </button>
      {kind !== 'verifications' && kind !== 'lyrics' ? (
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => decide(kind, item, 'approve')} disabled={busy === `${kind}:${item.id}`}>
          Approve only
        </button>
      ) : null}
      <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setRejecting({ kind, item })}>
        Reject
      </button>
    </div>
  );

  return (
    <>
      <AdminHeader title="Reviews" description="Creator submissions and verification requests waiting for a decision." actions={<button type="button" className="btn btn--ghost btn--sm" onClick={reload}><Icon name="refresh" size={14} /> Refresh</button>} />
      {empty ? <EmptyState icon="check-circle" title="All caught up" message="Nothing is waiting for review." /> : null}

      {data.songs.length ? (
        <section className="panel stack">
          <h2 className="panel__title">Songs · {data.songs.length}</h2>
          <ul className="review-list">
            {data.songs.map((s) => (
              <li key={s.id} className="review-row">
                <Artwork src={s.artworkUrl} alt="" size={48} />
                <div className="review-row__main">
                  <strong>{s.title}</strong>
                  <span className="text-sm text-muted">
                    {s.artist.name} · submitted {timeAgo(s.submittedAt)}
                  </span>
                </div>
                <Actions kind="songs" item={s} previewTo={`/admin/songs/${s.id}/edit`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.videos.length ? (
        <section className="panel stack">
          <h2 className="panel__title">Music videos · {data.videos.length}</h2>
          <ul className="review-list">
            {data.videos.map((v) => (
              <li key={v.id} className="review-row">
                <span className="table__thumb">{v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <Icon name="film" size={18} />}</span>
                <div className="review-row__main">
                  <strong>{v.title}</strong>
                  <span className="text-sm text-muted">
                    {v.artist.name} · {v.subtitleCount} subtitle tracks · submitted {timeAgo(v.submittedAt)}
                  </span>
                </div>
                <Actions kind="videos" item={v} previewTo={`/admin/videos/${v.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.lyrics.length ? (
        <section className="panel stack">
          <h2 className="panel__title">Lyrics · {data.lyrics.length}</h2>
          <ul className="review-list">
            {data.lyrics.map((l) => (
              <li key={l.id} className="review-row">
                <Icon name="lyrics" size={24} className="text-accent" />
                <div className="review-row__main">
                  <strong>{l.songTitle}</strong>
                  <span className="text-sm text-muted">
                    {l.artistName} · {l.language.toUpperCase()} · {l.isSynced ? 'synced' : 'not synced'} · submitted {timeAgo(l.submittedAt)}
                  </span>
                </div>
                <Actions kind="lyrics" item={l} previewTo={`/admin/lyrics/${l.songId}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.verifications.length ? (
        <section className="panel stack">
          <h2 className="panel__title">Verification requests · {data.verifications.length}</h2>
          <ul className="review-list">
            {data.verifications.map((a) => (
              <li key={a.id} className="review-row">
                <Artwork src={a.imageUrl} alt="" size={48} rounded icon="mic" />
                <div className="review-row__main">
                  <strong>{a.name}</strong>
                  <span className="text-sm text-muted">
                    {a.songCount} songs · {a.followerCount} followers · requested {timeAgo(a.verificationRequestedAt)}
                  </span>
                  {a.verificationMessage ? <p className="text-sm review-row__msg">“{a.verificationMessage}”</p> : null}
                </div>
                <Actions kind="verifications" item={a} previewTo={`/artists/${a.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rejecting ? (
        <ReasonDialog
          title={rejecting.kind === 'verifications' ? 'Decline verification' : 'Request changes'}
          cta={rejecting.kind === 'verifications' ? 'Decline' : 'Reject'}
          optional={rejecting.kind === 'verifications'}
          busy={busy === `${rejecting.kind}:${rejecting.item.id}`}
          onClose={() => setRejecting(null)}
          onSubmit={(reason) => decide(rejecting.kind, rejecting.item, 'reject', reason)}
        />
      ) : null}
    </>
  );
}
