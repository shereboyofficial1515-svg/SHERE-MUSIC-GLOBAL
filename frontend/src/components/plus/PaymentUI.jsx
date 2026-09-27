import { cx, formatDateTime, formatMoney } from '../../utils/format.js';

export const STATUS_LABELS = {
  pending: 'Pending',
  success: 'Paid',
  failed: 'Failed',
  abandoned: 'Not completed',
  reversed: 'Reversed',
  active: 'Active',
  non_renewing: 'Not renewing',
  attention: 'Payment failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  free: 'Free',
  payment_pending: 'Awaiting payment',
  payment_successful: 'Paid',
  not_submitted: 'Not submitted',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function PayStatus({ status, label }) {
  return <span className={cx('pay-status', `pay-status--${status}`)}>{label || STATUS_LABELS[status] || status}</span>;
}

/** Payment history table. Shows no card details — the API never returns any. */
export function TransactionsTable({ items, showUser = false }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            {showUser ? <th scope="col">User</th> : null}
            <th scope="col">Product</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col">Status</th>
            <th scope="col" className="hide-sm">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <span className="mono">{t.reference}</span>
              </td>
              {showUser ? (
                <td>
                  {t.user?.name ? (
                    <>
                      <span className="table__title">{t.user.name}</span>
                      <span className="text-muted text-sm">{t.user.email}</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              ) : null}
              <td>
                {t.product}
                {t.isRenewal ? <span className="text-muted text-sm"> · renewal</span> : null}
              </td>
              <td className="num">
                {formatMoney(t.amount, t.currency)} <span className="text-muted text-sm">{t.currency}</span>
              </td>
              <td>
                <PayStatus status={t.status} />
              </td>
              <td className="hide-sm text-muted">{formatDateTime(t.paidAt || t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
