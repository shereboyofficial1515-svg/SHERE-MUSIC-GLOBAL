import { useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { TransactionsTable } from '../../components/plus/PaymentUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';

/** Every payment attempt and renewal (read-only: statuses only change through verified Paystack data). */
export default function PaymentsPage() {
  useMeta({ title: 'Payments · Admin', noindex: true });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [product, setProduct] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(
    () => adminService.payments({ q: term || undefined, status, product: product || undefined, page, limit: 25 }),
    [term, status, product, page]
  );

  return (
    <>
      <AdminHeader title="Payments" description="Paystack payments for Plus and artist submissions. Statuses are set only by verified Paystack data." />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Reference, name or email" />
        <select className="input select select--inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="success">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Not completed</option>
          <option value="reversed">Reversed</option>
        </select>
        <select className="input select select--inline" value={product} onChange={(e) => { setProduct(e.target.value); setPage(1); }} aria-label="Filter by product">
          <option value="">All products</option>
          <option value="plus_subscription">Plus</option>
          <option value="artist_submission">Artist submissions</option>
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="receipt" title="No payments found" />
      ) : (
        <TransactionsTable items={data} showUser />
      )}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}
