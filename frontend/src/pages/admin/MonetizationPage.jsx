import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, BarChart, StatCard } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { cx, formatDate, formatMoney } from '../../utils/format.js';

const RANGES = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['month', 'This month'],
  ['custom', 'Custom'],
];

const iso = (d) => d.toISOString().slice(0, 10);

/** Admin → Monetization: revenue and membership numbers for a date range. */
export default function MonetizationPage() {
  useMeta({ title: 'Monetization · Admin', noindex: true });
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(new Date()) });
  const [applied, setApplied] = useState(custom);
  const query = range === 'custom' ? { range, ...applied } : { range };
  const { data, loading, error, reload } = useAsync(() => adminService.monetizationSummary(query), [range, applied.from, applied.to]);
  const settings = useAsync(() => adminService.monetizationSettings(), []);

  const currency = settings.data?.currency || data?.revenue?.[0]?.currency || 'NGN';
  const revenue = data?.revenue?.find((r) => r.currency === currency) || { total: 0, plus: 0, submissions: 0 };
  const otherCurrencies = (data?.revenue || []).filter((r) => r.currency !== currency);
  const chart = useMemo(() => (data?.daily || []).map((d) => ({ day: d.day, plus: (Number(d.plus) || 0) / 100, submissions: (Number(d.submissions) || 0) / 100 })), [data]);

  return (
    <>
      <AdminHeader
        title="Monetization"
        description="Revenue from SHERE MUSIC Plus and artist submission fees."
        actions={
          <Link to="/admin/settings?tab=monetization" className="btn btn--secondary btn--sm">
            Prices &amp; settings
          </Link>
        }
      />
      {settings.data && !settings.data.paystack.configured ? (
        <Alert type="warning">Paystack is not configured on the server yet (PAYSTACK_SECRET_KEY). Checkout is unavailable until it is.</Alert>
      ) : null}
      {settings.data?.paystack.configured ? (
        <p className="text-sm text-muted">
          Paystack mode: <strong>{settings.data.paystack.mode === 'live' ? 'Live' : 'Test'}</strong>
        </p>
      ) : null}

      <div className="range-bar" role="group" aria-label="Date range">
        {RANGES.map(([id, label]) => (
          <button key={id} type="button" className={cx('chip', range === id && 'chip--active')} aria-pressed={range === id} onClick={() => setRange(id)}>
            {label}
          </button>
        ))}
        {range === 'custom' ? (
          <>
            <TextField label="From" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <TextField label="To" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setApplied(custom)} disabled={!custom.from || !custom.to || custom.from > custom.to}>
              Apply
            </button>
          </>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {formatDate(data.from)} – {formatDate(new Date(Date.parse(data.to) - 1000).toISOString())}
          </p>
          <div className="stat-grid" aria-busy={loading}>
            <StatCard label="Total revenue" value={formatMoney(revenue.total, currency)} icon="bar-chart" />
            <StatCard label="Plus revenue" value={formatMoney(revenue.plus, currency)} icon="sparkles" tone="gold" />
            <StatCard label="Submission revenue" value={formatMoney(revenue.submissions, currency)} icon="upload" />
            <StatCard label="Successful payments" value={data.successfulPayments} icon="check-circle" tone="gold" />
            <StatCard label="Failed payments" value={data.failedPayments} icon="x-circle" hint="Failed or not completed" />
            <StatCard label="Active Plus members" value={data.activePlusMembers} icon="users" tone="gold" hint="Right now" />
            <StatCard label="New Plus members" value={data.newPlusMembers} icon="user-plus" />
            <StatCard label="Artist submissions paid" value={data.submissionsPaid} icon="send" tone="gold" />
            <StatCard label="Pending artist reviews" value={data.pendingArtistReviews} icon="clock" hint="Right now" />
          </div>
          {otherCurrencies.length ? (
            <p className="text-sm text-muted">
              Also received: {otherCurrencies.map((r) => formatMoney(r.total, r.currency)).join(', ')}
            </p>
          ) : null}

          <section className="panel">
            <h2 className="panel__title">Revenue by day ({currency})</h2>
            {chart.length ? (
              <BarChart
                data={chart}
                series={[
                  { key: 'plus', label: 'Plus', color: 'var(--accent)' },
                  { key: 'submissions', label: 'Submissions', color: 'var(--text-subtle)' },
                ]}
                formatLabel={(d) => formatDate(d, { month: 'short', day: 'numeric' })}
              />
            ) : (
              <p className="text-muted">No payments in this period.</p>
            )}
          </section>

          <div className="row-gap wrap">
            <Link to="/admin/payments" className="btn btn--secondary">Payments</Link>
            <Link to="/admin/plus-members" className="btn btn--secondary">Plus members</Link>
            <Link to="/admin/submissions" className="btn btn--secondary">Artist submissions</Link>
            <Link to="/admin/offers" className="btn btn--secondary">Plus offers</Link>
          </div>
        </>
      )}
    </>
  );
}
