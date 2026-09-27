import { useState } from 'react';
import Dialog from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { PayStatus, TransactionsTable } from '../../components/plus/PaymentUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { formatDate, formatMoney } from '../../utils/format.js';

function MemberDialog({ id, onClose }) {
  const { data, loading, error, reload } = useAsync(() => adminService.plusMember(id), [id]);
  return (
    <Dialog title="Plus subscription" onClose={onClose} size="lg">
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Spinner size={24} />
      ) : (
        <div className="review-detail">
          <dl>
            <dt>Member</dt>
            <dd>
              {data.user?.name} · {data.user?.email}
            </dd>
            <dt>Status</dt>
            <dd>
              <PayStatus status={data.status} /> {data.active ? '(has Plus now)' : '(no Plus access)'}
            </dd>
            <dt>Plan</dt>
            <dd>
              {formatMoney(data.plan.amount, data.plan.currency)} / {data.plan.interval}
            </dd>
            <dt>Started</dt>
            <dd>{formatDate(data.startedAt)}</dd>
            <dt>Current period</dt>
            <dd>
              {formatDate(data.currentPeriodStart)} – {formatDate(data.currentPeriodEnd)}
            </dd>
            <dt>Next payment</dt>
            <dd>{data.nextPaymentDate ? formatDate(data.nextPaymentDate) : '—'}</dd>
            <dt>Cancelled</dt>
            <dd>{data.cancelledAt ? formatDate(data.cancelledAt) : '—'}</dd>
            <dt>Paystack subscription</dt>
            <dd className="mono">{data.subscriptionCode || '—'}</dd>
            <dt>Paystack customer</dt>
            <dd className="mono">{data.customerCode || '—'}</dd>
          </dl>
          <h3 className="panel__title">Payments</h3>
          {data.payments.length ? <TransactionsTable items={data.payments} /> : <p className="text-muted">No payments.</p>}
          <p className="text-sm text-muted">Membership changes only through Paystack (checkout, renewal, cancellation). There is no manual "mark as paid" action.</p>
        </div>
      )}
    </Dialog>
  );
}

export default function PlusMembersPage() {
  useMeta({ title: 'Plus members · Admin', noindex: true });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.plusMembers({ q: term || undefined, status, page, limit: 25 }), [term, status, page]);

  return (
    <>
      <AdminHeader title="Plus members" description="SHERE MUSIC Plus subscriptions and their billing periods." />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name or email" />
        <select className="input select select--inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter members">
          <option value="active">With Plus now</option>
          <option value="all">All subscriptions (history)</option>
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="users" title="No Plus members yet" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col" className="hide-sm">Started</th>
                <th scope="col" className="hide-md">Current billing period</th>
                <th scope="col" className="hide-sm">Last payment</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="table__title">{m.user?.name || 'Deleted user'}</span>
                    <span className="text-muted text-sm">{m.user?.email}</span>
                  </td>
                  <td>
                    Plus · {formatMoney(m.plan.amount, m.plan.currency)}/mo
                  </td>
                  <td>
                    <PayStatus status={m.active ? m.status : 'expired'} />
                  </td>
                  <td className="hide-sm text-muted">{formatDate(m.startedAt)}</td>
                  <td className="hide-md text-muted">
                    {formatDate(m.currentPeriodStart)} – {formatDate(m.currentPeriodEnd)}
                  </td>
                  <td className="hide-sm">{m.lastPayment ? <PayStatus status={m.lastPayment.status} /> : '—'}</td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(m.id)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
      {open ? <MemberDialog id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
