import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea } from '../../components/ui/Form.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { PayStatus, TransactionsTable } from '../../components/plus/PaymentUI.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { formatDate, formatDateTime, formatDuration, formatMoney } from '../../utils/format.js';

function Preview({ songId }) {
  const [src, setSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = async () => {
    setBusy(true);
    try {
      const { data } = await adminService.songPreview(songId);
      setSrc(data.url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  if (src) return <audio controls autoPlay src={src} style={{ width: '100%' }} />;
  return (
    <button type="button" className="btn btn--secondary" onClick={load} disabled={busy}>
      <Icon name="play" size={16} /> {busy ? 'Loading…' : 'Play song'}
    </button>
  );
}

function ReviewDialog({ id, onClose, onReviewed }) {
  const toast = useToast();
  const { data: s, loading, error, reload } = useAsync(() => adminService.submission(id), [id]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    if (decision === 'reject' && !reason.trim()) return toast.error('Give the artist a reason for the rejection.');
    setBusy(true);
    try {
      const res = await adminService.reviewSubmission(id, { decision, ...(decision === 'reject' ? { reason: reason.trim() } : {}) });
      toast.success(res.meta?.message || 'Saved.');
      onReviewed(res.data);
      onClose();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const canReview = s?.reviewStatus === 'pending_review' && s?.song?.status === 'pending';
  const lyrics = s?.lyrics?.[0];

  return (
    <Dialog
      title="Review submission"
      onClose={onClose}
      size="lg"
      busy={busy}
      footer={
        canReview ? (
          rejecting ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setRejecting(false)} disabled={busy}>
                Back
              </button>
              <button type="button" className="btn btn--danger" onClick={() => decide('reject')} disabled={busy || !reason.trim()}>
                {busy ? 'Saving…' : 'Reject submission'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost text-danger" onClick={() => setRejecting(true)} disabled={busy}>
                Reject
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => decide('approve')} disabled={busy}>
                Approve
              </button>
              <button type="button" className="btn btn--primary" onClick={() => decide('publish')} disabled={busy}>
                Approve &amp; publish
              </button>
            </>
          )
        ) : null
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Spinner size={24} />
      ) : (
        <div className="review-detail">
          {!s.song ? <Alert type="warning">The song for this submission was deleted.</Alert> : null}
          <div className="review-detail__head">
            <Artwork src={s.song?.artworkUrl} alt={`${s.songTitle} artwork`} size={112} />
            <div className="stack-sm">
              <strong style={{ fontSize: 'var(--fs-lg)' }}>{s.songTitle}</strong>
              <span className="text-muted">
                {s.artistName} {s.artist?.verified ? <VerifiedBadge size={14} /> : null}
              </span>
              <div className="row-gap wrap">
                <PayStatus status={s.paymentStatus} />
                <PayStatus status={s.reviewStatus} />
              </div>
              {s.song ? <Preview songId={s.song.id} /> : null}
            </div>
          </div>

          {s.song ? (
            <>
              <h3 className="panel__title">Metadata</h3>
              <dl>
                <dt>Genre</dt>
                <dd>{s.song.genre?.name || '—'}</dd>
                <dt>Album</dt>
                <dd>{s.song.album?.title || 'Single'}</dd>
                <dt>Release date</dt>
                <dd>{s.song.releaseDate ? formatDate(s.song.releaseDate) : '—'}</dd>
                <dt>Duration</dt>
                <dd>{formatDuration(s.song.duration)}</dd>
                <dt>Audio file</dt>
                <dd>
                  {s.song.audio?.mime || '—'} · {s.song.audio?.size ? `${(s.song.audio.size / 1048576).toFixed(1)} MB` : '—'}
                </dd>
                <dt>Description</dt>
                <dd>{s.song.description || '—'}</dd>
              </dl>
              <div className="row-gap wrap">
                <Link to={`/admin/songs/${s.song.id}/edit`} className="btn btn--ghost btn--sm">
                  <Icon name="edit" size={14} /> Open in song editor
                </Link>
                <Link to={`/admin/lyrics/${s.song.id}`} className="btn btn--ghost btn--sm">
                  <Icon name="lyrics" size={14} /> Lyrics editor
                </Link>
              </div>
            </>
          ) : null}

          <h3 className="panel__title">Lyrics</h3>
          {lyrics ? (
            <>
              <p className="text-sm text-muted">
                {lyrics.language.toUpperCase()} · {lyrics.isSynced ? 'synced' : 'plain'} · {lyrics.status}
              </p>
              <div className="review-lyrics">{lyrics.content || '(no text)'}</div>
            </>
          ) : (
            <p className="text-muted">No lyrics were added.</p>
          )}

          <h3 className="panel__title">Artist</h3>
          {s.artist ? (
            <dl>
              <dt>Name</dt>
              <dd>
                {s.artist.name} {s.artist.verified ? <VerifiedBadge size={14} /> : <span className="text-muted text-sm">(not verified)</span>}
              </dd>
              <dt>Submitted by</dt>
              <dd>{s.user ? `${s.user.name} · ${s.user.email}` : '—'}</dd>
              <dt>Bio</dt>
              <dd>{s.artist.bio || '—'}</dd>
            </dl>
          ) : (
            <p className="text-muted">Artist profile deleted.</p>
          )}

          <h3 className="panel__title">Payment</h3>
          <p className="text-sm">
            Fee {formatMoney(s.fee, s.currency)} · submitted {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
          </p>
          {s.payments.length ? <TransactionsTable items={s.payments} /> : null}

          {s.reviewStatus === 'rejected' && s.rejectionReason ? (
            <Alert type="error">
              <strong>Rejected:</strong> {s.rejectionReason}
            </Alert>
          ) : null}
          {rejecting ? (
            <TextArea label="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required hint="The artist sees this and can fix the song before submitting again." autoFocus />
          ) : null}
          {!canReview && s.reviewStatus === 'pending_review' ? <Alert type="info">This song is no longer waiting for review.</Alert> : null}
        </div>
      )}
    </Dialog>
  );
}

/** Admin → Artist submissions: paid song submissions and their review. */
export default function SubmissionsPage() {
  useMeta({ title: 'Artist submissions · Admin', noindex: true });
  const [q, setQ] = useState('');
  const [review, setReview] = useState('pending_review');
  const [payment, setPayment] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload, setData } = useAsync(
    () => adminService.submissions({ q: term || undefined, review, payment, page, limit: 25 }),
    [term, review, payment, page]
  );

  return (
    <>
      <AdminHeader title="Artist submissions" description="Songs artists paid to submit. Payment makes a song eligible for review — it is never published automatically." />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Song or artist" />
        <select className="input select select--inline" value={review} onChange={(e) => { setReview(e.target.value); setPage(1); }} aria-label="Filter by review status">
          <option value="all">All review statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="not_submitted">Not submitted (unpaid)</option>
        </select>
        <select className="input select select--inline" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }} aria-label="Filter by payment status">
          <option value="all">All payments</option>
          <option value="payment_successful">Paid</option>
          <option value="payment_pending">Awaiting payment</option>
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="send" title="No submissions" message={review === 'pending_review' ? 'Nothing is waiting for review.' : undefined} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col" className="hide-sm">Artist</th>
                <th scope="col" className="num hide-sm">Amount</th>
                <th scope="col">Payment</th>
                <th scope="col">Review</th>
                <th scope="col" className="hide-md">Date</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="table__title">{s.songTitle}</span>
                    <span className="text-muted text-sm">{s.user?.email}</span>
                  </td>
                  <td className="hide-sm">{s.artistName || '—'}</td>
                  <td className="num hide-sm">{formatMoney(s.fee, s.currency)}</td>
                  <td>
                    <PayStatus status={s.paymentStatus} />
                  </td>
                  <td>
                    <PayStatus status={s.reviewStatus} />
                  </td>
                  <td className="hide-md text-muted">{formatDateTime(s.submittedAt || s.createdAt)}</td>
                  <td>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(s.id)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {open ? (
        <ReviewDialog
          id={open}
          onClose={() => setOpen(null)}
          onReviewed={(updated) => setData((list) => list.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))}
        />
      ) : null}
    </>
  );
}
