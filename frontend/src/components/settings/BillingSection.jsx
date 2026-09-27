import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Spinner } from '../ui/Feedback.jsx';
import { Pagination } from '../admin/AdminUI.jsx';
import { SettingsCard } from './PreferenceSections.jsx';
import { PlusBadge } from '../plus/PlusBadge.jsx';
import { PayStatus, TransactionsTable } from '../plus/PaymentUI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePlus } from '../../context/PlusContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { usePlusCheckout } from '../../hooks/usePlusCheckout.js';
import { paymentService } from '../../services/paymentService.js';
import { formatDate, formatMoney } from '../../utils/format.js';

function CurrentPlan() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { plus, currency, plusEnabled } = usePlus();
  const { start, busy: starting } = usePlusCheckout();
  const { data, loading, error, reload, setData } = useAsync(() => paymentService.plusStatus(), []);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <Spinner size={24} />;

  const price = formatMoney(data.plan?.amount ?? plus?.price ?? 60000, data.plan?.currency || currency);

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await paymentService.cancelPlus();
      setData((d) => ({ ...d, ...res.data }));
      toast.success(res.meta?.message || 'Your membership will not renew.');
      setConfirm(false);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    try {
      const { data: link } = await paymentService.manageLink();
      window.open(link.url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!data.active) {
    return (
      <div className="plan-card">
        <div className="plan-card__head">
          <span className="plan-card__name">Free Plan</span>
          <PayStatus status="free" label="Current plan" />
        </div>
        <p className="text-muted">Stream music, read lyrics, make playlists and follow artists. Downloads to your device need Plus.</p>
        {data.status === 'expired' && data.currentPeriodEnd ? <p className="text-sm text-muted">Your Plus membership ended on {formatDate(data.currentPeriodEnd)}.</p> : null}
        {plusEnabled ? (
          <div>
            <button type="button" className="btn btn--primary" onClick={start} disabled={starting || !data.paymentsAvailable}>
              <Icon name="sparkles" size={16} /> {starting ? 'Opening checkout…' : `Upgrade to Plus — ${formatMoney(plus?.price ?? 60000, currency)}/month`}
            </button>
            {!data.paymentsAvailable ? <p className="field__hint">Payments are not available yet.</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  const renewing = ['active', 'attention'].includes(data.status);
  return (
    <div className="plan-card plan-card--plus">
      <div className="plan-card__head">
        <span className="plan-card__name">
          SHERE MUSIC Plus <PlusBadge />
        </span>
        <PayStatus status={data.status} />
      </div>
      <p>
        <strong>{price}</strong>
        <span className="text-muted"> / month</span>
      </p>
      {data.status === 'attention' ? (
        <Alert type="warning">Your last renewal payment failed. Update your card with “Manage subscription” to keep Plus.</Alert>
      ) : null}
      <p className="text-muted text-sm">
        {renewing && data.nextBillingDate
          ? `Next billing date: ${formatDate(data.nextBillingDate)}`
          : `Your membership does not renew. Plus benefits end on ${formatDate(data.currentPeriodEnd)}.`}
      </p>
      <div className="row-gap wrap">
        {data.canManage ? (
          <button type="button" className="btn btn--secondary" onClick={manage}>
            <Icon name="credit-card" size={16} /> Manage subscription
          </button>
        ) : null}
        {data.canCancel ? (
          <button type="button" className="btn btn--ghost text-danger" onClick={() => setConfirm(true)}>
            Cancel subscription
          </button>
        ) : null}
      </div>
      {confirm ? (
        <ConfirmDialog
          title="Cancel SHERE MUSIC Plus?"
          message={`Your membership won't renew. You keep Plus until ${formatDate(data.currentPeriodEnd)}, then your account returns to the Free plan.`}
          confirmLabel="Cancel subscription"
          danger
          busy={busy}
          onConfirm={cancel}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useAsync(() => paymentService.history({ page, limit: 10 }), [page]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner size={24} />;
  if (!data.length) return <EmptyState icon="receipt" title="No payments yet" message="Your payments will appear here." />;
  return (
    <>
      <TransactionsTable items={data} />
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

export function BillingSection() {
  return (
    <>
      <SettingsCard title="Current plan">
        <CurrentPlan />
      </SettingsCard>
      <SettingsCard title="Payment history" description="Receipts for Plus and music submissions. Card details are never stored or shown by SHERE MUSIC.">
        <History />
      </SettingsCard>
      <p className="settings-note">
        <Icon name="info" size={14} /> See what Plus includes on the <Link to="/plus">SHERE MUSIC Plus</Link> page.
      </p>
    </>
  );
}
