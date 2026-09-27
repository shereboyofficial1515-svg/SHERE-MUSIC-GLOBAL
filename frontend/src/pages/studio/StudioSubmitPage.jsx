import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { AdminHeader } from '../../components/admin/AdminUI.jsx';
import StatusBadge from '../../components/content/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { goToCheckout, paymentService } from '../../services/paymentService.js';
import { studioService } from '../../services/studioService.js';
import { formatMoney } from '../../utils/format.js';

/**
 * "Submit Your Music": the fee comes from the server, the payment goes through
 * Paystack, and the song moves to review only after the API verifies it.
 */
export default function StudioSubmitPage() {
  const { songId } = useParams();
  useMeta({ title: 'Submit your music · Studio', noindex: true });
  const toast = useToast();
  const navigate = useNavigate();
  const { data: quote, loading, error, reload } = useAsync(() => paymentService.submissionQuote(songId), [songId]);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;

  const fee = formatMoney(quote.fee, quote.currency);

  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await paymentService.startSubmission(songId);
      goToCheckout(data);
    } catch (err) {
      setBusy(false);
      toast.error(err.message);
      if (err.code === 'ALREADY_SUBMITTED') reload();
    }
  };

  // Fees switched off (or admin account): submit directly.
  const submitFree = async () => {
    setBusy(true);
    try {
      const res = await studioService.submitSong(songId);
      toast.success(res.meta?.message || 'Submitted for review.');
      navigate(`/studio/music/${songId}`);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Submit your music"
        description="Send your song to the SHERE MUSIC team for review."
        actions={
          <Link to={`/studio/music/${songId}`} className="btn btn--ghost btn--sm">
            <Icon name="arrow-left" size={16} /> Back to song
          </Link>
        }
      />
      <div className="panel submit-pay">
        <div className="submit-pay__song">
          <span className="plus-dialog__icon" aria-hidden="true">
            <Icon name="music" size={22} />
          </span>
          <div className="stack-sm">
            <strong>{quote.song.title}</strong>
            <span className="text-muted text-sm">{quote.artist.name}</span>
          </div>
          <span style={{ marginLeft: 'auto' }}>
            <StatusBadge status={quote.song.status} />
          </span>
        </div>

        {quote.alreadySubmitted ? (
          <Alert type="info">This song is already waiting for review. You'll be notified when the team has reviewed it.</Alert>
        ) : !quote.song.hasAudio ? (
          <Alert type="warning">Upload the audio file before submitting.</Alert>
        ) : !quote.canSubmit ? (
          <Alert type="info">Only drafts, or songs that need changes, can be submitted for review.</Alert>
        ) : quote.required ? (
          <>
            <div className="submit-pay__fee">
              <span>Music submission fee</span>
              <strong>{fee}</strong>
            </div>
            <p className="text-muted">
              After successful payment, your submission will be sent to the SHERE MUSIC admin team for review. Paying the fee does not guarantee approval, and it is
              not artist verification.
            </p>
            <ul className="plus-benefits text-sm">
              <li>
                <Icon name="check" size={16} /> One-time payment for this submission
              </li>
              <li>
                <Icon name="check" size={16} /> If the payment fails, your draft stays safe and you can try again
              </li>
              <li>
                <Icon name="check" size={16} /> Receipts are in Studio → Payments
              </li>
            </ul>
            <button type="button" className="btn btn--primary btn--lg" onClick={pay} disabled={busy}>
              <Icon name="lock" size={16} /> {busy ? 'Opening secure checkout…' : `Pay ${fee} & Submit`}
            </button>
            <p className="plus-note">
              <Icon name="shield" size={14} /> Secure payment by Paystack. SHERE MUSIC never sees your card details.
            </p>
          </>
        ) : (
          <>
            <p className="text-muted">No submission fee is needed right now.</p>
            <button type="button" className="btn btn--primary btn--lg" onClick={submitFree} disabled={busy}>
              <Icon name="send" size={16} /> Submit for review
            </button>
          </>
        )}
      </div>
    </>
  );
}
