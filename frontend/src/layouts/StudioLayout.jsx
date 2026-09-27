import DashboardLayout from './DashboardLayout.jsx';

/** SHERE MUSIC STUDIO — visually related to Admin, but a separate creator space. */
const NAV = [
  {
    links: [{ to: '/studio', label: 'Overview', icon: 'grid', end: true }],
  },
  {
    label: 'Content',
    links: [
      { to: '/studio/music', label: 'My Music', icon: 'music', end: true },
      { to: '/studio/music/new', label: 'Upload Music', icon: 'upload' },
      { to: '/studio/lyrics', label: 'Lyrics', icon: 'lyrics' },
      { to: '/studio/albums', label: 'Albums', icon: 'disc' },
      { to: '/studio/videos', label: 'Music Videos', icon: 'film' },
      { to: '/studio/playlists', label: 'Playlists', icon: 'list-music' },
    ],
  },
  {
    label: 'Audience',
    links: [
      { to: '/studio/analytics', label: 'Analytics', icon: 'bar-chart' },
      { to: '/studio/followers', label: 'Followers', icon: 'users' },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/studio/artists', label: 'Artists', icon: 'mic' },
      { to: '/studio/profile', label: 'Profile', icon: 'user' },
      { to: '/studio/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

export default function StudioLayout() {
  return <DashboardLayout nav={NAV} badge="Studio" badgeTone="success" homeTo="/studio" variant="studio" />;
}
