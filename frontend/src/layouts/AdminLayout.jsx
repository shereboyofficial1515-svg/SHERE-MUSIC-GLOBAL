import DashboardLayout from './DashboardLayout.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { adminService } from '../services/adminService.js';

export default function AdminLayout() {
  // Pending counts power the badge on Reviews.
  const { data } = useAsync(() => adminService.overview(), []);
  const pending = (data?.totals?.pendingReviews || 0) + (data?.totals?.pendingVerifications || 0);

  const nav = [
    {
      links: [
        { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
        { to: '/admin/reviews', label: 'Reviews', icon: 'check-circle', count: pending || null },
      ],
    },
    {
      label: 'Music',
      links: [
        { to: '/admin/songs', label: 'Music', icon: 'music', end: true },
        { to: '/admin/songs/new', label: 'Upload Music', icon: 'upload' },
        { to: '/admin/lyrics', label: 'Lyrics', icon: 'lyrics' },
        { to: '/admin/artists', label: 'Artists', icon: 'mic' },
        { to: '/admin/albums', label: 'Albums', icon: 'disc' },
        { to: '/admin/genres', label: 'Categories', icon: 'tag' },
        { to: '/admin/playlists', label: 'Playlists', icon: 'list-music' },
      ],
    },
    {
      label: 'Video',
      links: [
        { to: '/admin/videos', label: 'Music Videos', icon: 'film', end: true },
        { to: '/admin/subtitles', label: 'Subtitles', icon: 'captions' },
      ],
    },
    {
      label: 'Monetization',
      links: [
        { to: '/admin/monetization', label: 'Revenue', icon: 'bar-chart' },
        { to: '/admin/payments', label: 'Payments', icon: 'receipt' },
        { to: '/admin/plus-members', label: 'Plus Members', icon: 'sparkles' },
        { to: '/admin/submissions', label: 'Artist Submissions', icon: 'send' },
        { to: '/admin/offers', label: 'Plus Offers', icon: 'gift' },
      ],
    },
    {
      label: 'Platform',
      links: [
        { to: '/admin/users', label: 'Users', icon: 'users' },
        { to: '/admin/downloads', label: 'Downloads', icon: 'download' },
        { to: '/admin/analytics', label: 'Analytics', icon: 'bar-chart' },
        { to: '/admin/reports', label: 'Reports', icon: 'file-text' },
        { to: '/admin/settings', label: 'Settings', icon: 'settings' },
        { to: '/admin/docs', label: 'Admin Guide', icon: 'file-text' },
      ],
    },
  ];
  return <DashboardLayout nav={nav} badge="Admin" homeTo="/admin" />;
}
