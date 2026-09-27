import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  AccessibilitySection,
  AppearanceSection,
  DownloadsSection,
  LanguageSection,
  NotificationsSection,
  PlaybackSection,
  PrivacySection,
  SettingsCard,
} from '../../components/settings/PreferenceSections.jsx';
import { AccountSection, ConnectedAccountsSection, FollowersSection, ProfileSection, SecuritySection } from '../../components/settings/AccountSections.jsx';
import { DownloadsTab } from '../user/ProfilePage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMeta } from '../../hooks/useMeta.js';
import { cx } from '../../utils/format.js';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: 'user', auth: true, Component: AccountSection },
  { id: 'profile', label: 'Profile', icon: 'edit', auth: true, Component: ProfileSection },
  { id: 'playback', label: 'Music & Playback', icon: 'headphones', Component: PlaybackSection },
  { id: 'appearance', label: 'Appearance', icon: 'sun', Component: AppearanceSection },
  { id: 'accessibility', label: 'Accessibility', icon: 'accessibility', Component: AccessibilitySection },
  { id: 'privacy', label: 'Privacy', icon: 'shield', auth: true, Component: PrivacySection },
  { id: 'notifications', label: 'Notifications', icon: 'bell', auth: true, Component: NotificationsSection },
  {
    id: 'downloads',
    label: 'Downloads',
    icon: 'download',
    Component: () => (
      <DownloadsSection
        historySlot={
          <SignedIn>
            <SettingsCard title="Download history" description="Songs you've downloaded while signed in.">
              <DownloadsTab />
            </SettingsCard>
          </SignedIn>
        }
      />
    ),
  },
  { id: 'language', label: 'Language', icon: 'globe', Component: LanguageSection },
  { id: 'followers', label: 'Followers', icon: 'users', auth: true, Component: FollowersSection },
  { id: 'security', label: 'Security', icon: 'lock', auth: true, Component: SecuritySection },
  { id: 'connected-accounts', label: 'Connected Accounts', icon: 'plug', auth: true, Component: ConnectedAccountsSection },
];

function SignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

/**
 * Settings, organised by category. Desktop: category rail + content.
 * Mobile: /settings shows the category list, each category is its own page.
 */
export default function SettingsPage() {
  const { section } = useParams();
  const { user } = useAuth();
  const available = SECTIONS.filter((s) => !s.auth || user);
  const active = SECTIONS.find((s) => s.id === section);
  useMeta({ title: active ? `${active.label} settings` : 'Settings', noindex: true });

  if (section && !active) return <Navigate to="/settings" replace />;
  if (active?.auth && !user) return <Navigate to="/login" replace state={{ from: `/settings/${active.id}` }} />;

  const Section = active?.Component;
  return (
    <div className="container page">
      <div className={cx('settings', active ? 'settings--section' : 'settings--index')}>
        <nav className="settings__nav" aria-label="Settings categories">
          <h1 className="page-title">Settings</h1>
          {!user ? <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Log in for account, privacy and notification settings.</p> : null}
          <ul>
            {available.map((s) => (
              <li key={s.id}>
                <NavLink to={`/settings/${s.id}`} className={({ isActive }) => cx('settings__link', isActive && 'settings__link--active')}>
                  <Icon name={s.icon} size={18} />
                  <span>{s.label}</span>
                  <Icon name="chevron-right" size={16} className="settings__chevron" />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <section className="settings__content" aria-labelledby="settings-heading">
          {active ? (
            <>
              <header className="settings__head">
                <Link to="/settings" className="icon-btn settings__back" aria-label="All settings">
                  <Icon name="arrow-left" size={20} />
                </Link>
                <h2 id="settings-heading" className="settings__title">
                  {active.label}
                </h2>
              </header>
              <div className="stack-lg">
                <Section />
              </div>
            </>
          ) : (
            <div className="settings__welcome hide-md">
              <Icon name="settings" size={32} />
              <h2 id="settings-heading">Choose a category</h2>
              <p className="text-muted">Pick a category on the left to manage your SHERE MUSIC experience.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
