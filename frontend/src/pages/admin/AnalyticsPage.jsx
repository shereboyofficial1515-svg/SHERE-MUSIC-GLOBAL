import { useState } from 'react';
import { ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { AdminHeader, BarChart, StatCard } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { formatDate, formatNumber } from '../../utils/format.js';

function RankTable({ title, rows, columns, empty }) {
  return (
    <section className="panel">
      <h2 className="panel__title">{title}</h2>
      {rows.length ? (
        <table className="table table--compact">
          <thead>
            <tr>
              <th scope="col">#</th>
              {columns.map((c) => (
                <th key={c.label} scope="col" className={c.num ? 'num' : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="text-muted">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.label} className={c.num ? 'num' : undefined}>
                    {c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">{empty}</p>
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  useMeta({ title: 'Analytics · Admin', noindex: true });
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => adminService.analytics(days), [days]);
  const label = (d) => formatDate(d, { month: 'short', day: 'numeric' });

  return (
    <>
      <AdminHeader
        title="Analytics"
        description="Listening, download, search and registration activity. No IP addresses or device data are collected."
        actions={
          <select className="input select select--inline" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <PageLoader />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Plays" value={data.totals.plays} icon="headphones" />
            <StatCard label="Downloads" value={data.totals.downloads} icon="download" tone="gold" />
            <StatCard label="New users" value={data.totals.registrations} icon="users" />
            <StatCard label="Searches" value={data.totals.searches} icon="search" tone="gold" />
          </div>
          <section className="panel">
            <h2 className="panel__title">Daily plays &amp; downloads</h2>
            <BarChart
              data={data.daily}
              series={[
                { key: 'plays', label: 'Plays', color: 'var(--sky)' },
                { key: 'downloads', label: 'Downloads', color: 'var(--gold)' },
              ]}
              formatLabel={label}
            />
          </section>
          <section className="panel">
            <h2 className="panel__title">Daily registrations</h2>
            <BarChart data={data.daily} series={[{ key: 'registrations', label: 'Registrations', color: 'var(--teal)' }]} height={140} formatLabel={label} />
          </section>
          <div className="admin-grid-2">
            <RankTable
              title="Most played songs"
              rows={data.topPlayed}
              empty="No plays in this period."
              columns={[
                { label: 'Song', value: (r) => <><strong>{r.title}</strong><span className="text-muted text-sm"> · {r.artist_name}</span></> },
                { label: 'Plays', num: true, value: (r) => formatNumber(r.total) },
              ]}
            />
            <RankTable
              title="Most downloaded songs"
              rows={data.topDownloaded}
              empty="No downloads in this period."
              columns={[
                { label: 'Song', value: (r) => <><strong>{r.title}</strong><span className="text-muted text-sm"> · {r.artist_name}</span></> },
                { label: 'Downloads', num: true, value: (r) => formatNumber(r.total) },
              ]}
            />
            <RankTable
              title="Popular artists"
              rows={data.topArtists}
              empty="No artist activity in this period."
              columns={[
                { label: 'Artist', value: (r) => r.name },
                { label: 'Plays', num: true, value: (r) => formatNumber(r.plays) },
                { label: 'Downloads', num: true, value: (r) => formatNumber(r.downloads) },
              ]}
            />
            <RankTable
              title="Top searches"
              rows={data.topSearches}
              empty="No searches in this period."
              columns={[
                { label: 'Query', value: (r) => r.query },
                { label: 'Searches', num: true, value: (r) => formatNumber(r.searches) },
                { label: 'Avg. results', num: true, value: (r) => (Number(r.avg_results) === 0 ? <span className="text-danger">0</span> : r.avg_results) },
              ]}
            />
          </div>
        </>
      )}
    </>
  );
}
