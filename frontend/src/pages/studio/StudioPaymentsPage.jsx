import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination } from '../../components/admin/AdminUI.jsx';
import { PayStatus } from '../../components/plus/PaymentUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { paymentService } from '../../services/paymentService.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

/** Studio → Payments: the creator's submission fees and where each submission stands. */
export default function StudioPaymentsPage() {
  useMeta({ title: 'Payments · Studio', noindex: true });
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useAsync(() => paymentService.mySubmissions({ page, limit: 20 }), [page]);

  return (
    <>
      <AdminHeader title="Payments" description="Your music submission payments and their review status." />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="receipt" title="No payments yet" message="When you pay a submission fee, the receipt appears here." action={<Link to="/studio/music" className="btn btn--primary">My Music</Link>} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Submission</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col">Payment</th>
                <th scope="col">Review</th>
                <th scope="col" className="hide-sm">Reference</th>
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
                    {s.songId ? (
                      <Link to={`/studio/music/${s.songId}`} className="table__title">
                        {s.songTitle}
                      </Link>
                    ) : (
                      <span className="table__title">{s.songTitle}</span>
                    )}
                    <span className="text-muted text-sm">{s.artistName}</span>
                    {s.reviewStatus === 'rejected' && s.rejectionReason ? <span className="text-sm text-danger">Reason: {s.rejectionReason}</span> : null}
                  </td>
                  <td className="num">{formatMoney(s.fee, s.currency)}</td>
                  <td>
                    <PayStatus status={s.paymentStatus} />
                  </td>
                  <td>
                    <PayStatus status={s.reviewStatus} />
                  </td>
                  <td className="hide-sm">{s.transaction ? <span className="mono">{s.transaction.reference}</span> : <span className="text-muted">—</span>}</td>
                  <td className="hide-md text-muted">{formatDateTime(s.transaction?.paidAt || s.submittedAt || s.createdAt)}</td>
                  <td>
                    {s.paymentStatus === 'payment_pending' && s.songId ? (
                      <Link to={`/studio/submit/${s.songId}`} className="btn btn--primary btn--sm">
                        Pay now
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}
