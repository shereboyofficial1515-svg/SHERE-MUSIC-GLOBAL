import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { PayStatus } from '../../components/plus/PaymentUI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { usePlusCheckout } from '../../hooks/usePlusCheckout.js';
import { paymentService } from '../../services/paymentService.js';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

const POLL_MS = 2500;
const MAX_POLLS = 8;

/**
 * Paystack sends the customer back here with ?reference=…. What we show comes
 * from the API (which verifies with Paystack), never from the URL, so opening
 * this page by hand grants nothing.
 */
export default function PaymentReturnPage() {
  useMeta({ title: 'Payment', noindex: true });
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const cancelled = params.get('cancelled') === '1';
  const { refresh } = useAuth();
  const { start: retryPlus, busy: retrying } = usePlusCheckout();
  const [state, setState] = useState({ phase: reference ? 'checking' : 'missing', data: null, error: null });
  const polls = useRef(0);
  const ref = useRef(null);

  const check = useCallback(async () => {
    try {
      const { data } = await paymentService.verify(reference);
      const status = data.transaction.status;
      if (status === 'success') {
        setState({ phase: 'success', data, error: null });
        refresh(); // Plus status / badges
      } else if (status === 'pending' && !cancelled && polls.current < MAX_POLLS) {
        polls.current += 1;
        setState({ phase: 'checking', data, error: null });
        setTimeout(check, POLL_MS);
      } else if (status === 'pending') {
        setState({ phase: cancelled ? 'failed' : 'pending', data, error: null });
      } else {
        setState({ phase: 'failed', data, error: null });
      }
    } catch (error) {
      setState({ phase: 'error', data: null, error });
    }
  }, [reference, cancelled, refresh]);

  useEffect(() => {
    if (reference) check();
  }, [reference, check]);

  useGSAP(
    () => {
      if (!motionOK() || state.phase === 'checking') return;
      gsap.from('.payment-result__icon', { scale: 0.6, autoAlpha: 0, duration: 0.45, ease: 'back.out(2)' });
      gsap.from('.payment-result > *:not(.payment-result__icon)', { autoAlpha: 0, y: 8, stagger: 0.05, delay: 0.1, duration: 0.35 });
    },
    { scope: ref, dependencies: [state.phase] }
  );

  const tx = state.data?.transaction;
  const submission = state.data?.submission;
  const isPlus = tx?.productType === 'plus_subscription';

  if (state.phase === 'missing') {
    return (
      <div className="container page">
        <div className="payment-result">
          <p className="text-muted">No payment to show.</p>
          <Link to="/" className="btn btn--secondary">Go home</Link>
        </div>
      </div>
    );
  }

  const receipt = tx ? (
    <dl className="receipt">
      <div>
        <dt>Reference</dt>
        <dd className="mono">{tx.reference}</dd>
      </div>
      <div>
        <dt>{isPlus ? 'Plan' : 'Item'}</dt>
        <dd>{tx.product}</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>{formatMoney(tx.amount, tx.currency)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          {isPlus ? <PayStatus status={tx.status} /> : submission ? <PayStatus status={submission.reviewStatus === 'not_submitted' ? submission.paymentStatus : submission.reviewStatus} label={submission.reviewStatus === 'pending_review' ? 'Submitted for review' : undefined} /> : <PayStatus status={tx.status} />}
        </dd>
      </div>
      {tx.paidAt ? (
        <div>
          <dt>Date</dt>
          <dd>{formatDateTime(tx.paidAt)}</dd>
        </div>
      ) : null}
    </dl>
  ) : null;

  return (
    <div className="container page" ref={ref}>
      <div className="payment-result" aria-live="polite">
        {state.phase === 'checking' ? (
          <>
            <span className="payment-result__icon payment-result__icon--pending">
              <Spinner size={28} />
            </span>
            <h1 className="page-title">Confirming your payment…</h1>
            <p className="text-muted">We're checking with Paystack. This usually takes a few seconds.</p>
          </>
        ) : null}

        {state.phase === 'success' ? (
          <>
            <span className="payment-result__icon payment-result__icon--success">
              <Icon name="check" size={32} />
            </span>
            <h1 className="page-title">{isPlus ? 'Welcome to SHERE MUSIC Plus' : 'Payment successful'}</h1>
            <p className="text-muted">
              {isPlus
                ? `Your membership is active${state.data.plus?.currentPeriodEnd ? ` until ${formatDate(state.data.plus.currentPeriodEnd)}` : ''}. You can now download music to your device.`
                : `"${submission?.songTitle || 'Your song'}" was sent to the SHERE MUSIC team for review. We'll let you know when it's reviewed.`}
            </p>
            {receipt}
            <div className="row-gap wrap center">
              {isPlus ? (
                <>
                  <Link to="/" className="btn btn--primary">Start listening</Link>
                  <Link to="/settings/billing" className="btn btn--secondary">Billing &amp; Membership</Link>
                </>
              ) : (
                <>
                  <Link to="/studio/payments" className="btn btn--primary">View submission</Link>
                  <Link to="/studio/music" className="btn btn--secondary">My Music</Link>
                </>
              )}
            </div>
          </>
        ) : null}

        {state.phase === 'failed' ? (
          <>
            <span className="payment-result__icon payment-result__icon--error">
              <Icon name="x" size={30} />
            </span>
            <h1 className="page-title">Payment was not completed.</h1>
            <p className="text-muted">
              {isPlus ? 'You have not been charged for Plus.' : 'Your music has not been submitted for review yet. Your draft is safe.'}
            </p>
            {receipt}
            <div className="row-gap wrap center">
              {isPlus ? (
                <button type="button" className="btn btn--primary" onClick={retryPlus} disabled={retrying}>
                  {retrying ? 'Opening checkout…' : 'Try again'}
                </button>
              ) : submission?.songId ? (
                <Link to={`/studio/submit/${submission.songId}`} className="btn btn--primary">Try again</Link>
              ) : null}
              <Link to={isPlus ? '/plus' : '/studio/music'} className="btn btn--secondary">
                {isPlus ? 'Back to Plus' : 'Back to My Music'}
              </Link>
            </div>
          </>
        ) : null}

        {state.phase === 'pending' ? (
          <>
            <span className="payment-result__icon payment-result__icon--pending">
              <Icon name="clock" size={28} />
            </span>
            <h1 className="page-title">We're still confirming your payment</h1>
            <p className="text-muted">If you completed the payment, it will be confirmed automatically in a moment — you don't need to pay again.</p>
            {receipt}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                polls.current = 0;
                setState((s) => ({ ...s, phase: 'checking' }));
                check();
              }}
            >
              <Icon name="refresh" size={16} /> Check again
            </button>
          </>
        ) : null}

        {state.phase === 'error' ? (
          <>
            <span className="payment-result__icon payment-result__icon--error">
              <Icon name="alert-triangle" size={28} />
            </span>
            <h1 className="page-title">We couldn't check this payment</h1>
            <p className="text-muted">{state.error?.message}</p>
            <Link to="/settings/billing" className="btn btn--secondary">Payment history</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
