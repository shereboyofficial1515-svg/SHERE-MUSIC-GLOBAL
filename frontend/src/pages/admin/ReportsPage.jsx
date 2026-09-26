import { useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader } from '../../components/admin/AdminUI.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';

const REPORTS = [
  { type: 'songs', title: 'Song catalog', description: 'Every song with status, plays, downloads and metadata.', icon: 'music' },
  { type: 'artists', title: 'Artists', description: 'Artists with published song counts, albums and total plays.', icon: 'mic' },
  { type: 'downloads', title: 'Download log', description: 'Each download in the selected period with song and artist.', icon: 'download', usesDays: true },
  { type: 'daily-activity', title: 'Daily activity', description: 'Plays, downloads, registrations and searches per day.', icon: 'bar-chart', usesDays: true },
  { type: 'users', title: 'Users', description: 'Accounts with role, status, verification and last sign-in.', icon: 'users' },
];

export default function ReportsPage() {
  useMeta({ title: 'Reports · Admin', noindex: true });
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(null);

  // Fetch with credentials so the session cookie is sent, then save the CSV.
  const download = async (type) => {
    setBusy(type);
    try {
      const res = await fetch(adminService.reportUrl(type, days), { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Report failed (${res.status}).`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `shere-music-${type}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Report downloaded.');
    } catch (err) {
      toast.error(err.message === 'Failed to fetch' ? 'Network error. Try again.' : err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminHeader
        title="Reports"
        description="Export data as CSV for spreadsheets."
        actions={
          <select className="input select select--inline" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period for time-based reports">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        }
      />
      <div className="report-grid">
        {REPORTS.map((r) => (
          <section key={r.type} className="panel report-card">
            <span className="stat-card__icon">
              <Icon name={r.icon} size={20} />
            </span>
            <h2 className="panel__title">{r.title}</h2>
            <p className="text-muted text-sm">
              {r.description}
              {r.usesDays ? ` Period: last ${days} days.` : ''}
            </p>
            <button type="button" className="btn btn--secondary" onClick={() => download(r.type)} disabled={busy === r.type}>
              {busy === r.type ? <Spinner size={16} /> : <Icon name="download" size={16} />} Download CSV
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
