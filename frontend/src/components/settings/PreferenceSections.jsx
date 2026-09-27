import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Select, Toggle } from '../ui/Form.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { cx } from '../../utils/format.js';

/** Save a preference and surface failures (successes are silent; changes apply instantly). */
export function usePrefUpdate() {
  const { update } = usePreferences();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = useCallback(
    async (patch) => {
      setSaving(true);
      try {
        await update(patch);
      } catch (err) {
        toast.error(`Couldn't save that setting: ${err.message}`);
      } finally {
        setSaving(false);
      }
    },
    [update, toast]
  );
  return { save, saving };
}

export function SettingsCard({ title, description, children }) {
  return (
    <section className="settings-card">
      {title ? <h2 className="settings-card__title">{title}</h2> : null}
      {description ? <p className="settings-card__desc">{description}</p> : null}
      <div className="settings-card__body">{children}</div>
    </section>
  );
}

function GuestNote() {
  const { user } = useAuth();
  if (user) return null;
  return (
    <Alert type="info">
      These settings are saved on this device. <Link to="/login">Log in</Link> to keep them across devices.
    </Alert>
  );
}

// ─── Appearance ────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'light', label: 'Light', icon: 'sun', hint: 'Bright surfaces, dark text' },
  { id: 'dark', label: 'Dark', icon: 'moon', hint: 'Easy on the eyes at night' },
  { id: 'system', label: 'System default', icon: 'monitor', hint: 'Follows your device setting' },
];

export function AppearanceSection() {
  const { prefs, resolvedTheme } = usePreferences();
  const { save } = usePrefUpdate();
  return (
    <>
      <GuestNote />
      <SettingsCard title="Theme" description={`Currently showing the ${resolvedTheme} theme.`}>
        <div className="choice-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} className={cx('choice', prefs.theme === t.id && 'choice--on')} onClick={() => save({ theme: t.id })}>
              <span className={`choice__preview choice__preview--${t.id}`} aria-hidden="true">
                <span />
                <span />
              </span>
              <span className="choice__label">
                <Icon name={t.icon} size={16} /> {t.label}
              </span>
              <span className="choice__hint">{t.hint}</span>
            </button>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}

// ─── Music & playback ──────────────────────────────────────────────────────
export function PlaybackSection() {
  const { prefs } = usePreferences();
  const { save } = usePrefUpdate();
  return (
    <>
      <GuestNote />
      <SettingsCard title="Playback">
        <Toggle label="Autoplay" description="When your queue ends, keep playing similar music." checked={prefs.autoplay} onChange={(v) => save({ autoplay: v })} />
        <Toggle
          label="Remember playback position"
          description="Pick up where you left off — song, queue and position — when you come back on this device."
          checked={prefs.rememberPosition}
          onChange={(v) => save({ rememberPosition: v })}
        />
        <Toggle label="Open lyrics automatically" description="The expanded player opens on the lyrics tab for songs that have lyrics." checked={prefs.lyricsAutoOpen} onChange={(v) => save({ lyricsAutoOpen: v })} />
        <p className="settings-note">
          <Icon name="info" size={14} /> Music keeps playing while you browse, and continues in the background on phones with lock-screen controls.
        </p>
      </SettingsCard>
      <SettingsCard title="Audio quality" description="Every song streams and downloads in the original quality the artist uploaded (MP3, WAV, M4A or AAC). There are no reduced-quality versions, so there is nothing to choose here.">
        <p className="settings-note">
          <Icon name="info" size={14} /> Crossfade and gapless playback aren&apos;t available yet.
        </p>
      </SettingsCard>
    </>
  );
}

// ─── Accessibility ─────────────────────────────────────────────────────────
export function AccessibilitySection() {
  const { prefs } = usePreferences();
  const { settings } = useSettings();
  const { save } = usePrefUpdate();
  return (
    <>
      <GuestNote />
      <SettingsCard title="Motion">
        <Select label="Reduce motion" value={prefs.reducedMotion} onChange={(e) => save({ reducedMotion: e.target.value })} hint="Turns off page transitions, lyric animations and the player visualiser.">
          <option value="system">Match my device setting</option>
          <option value="on">Always reduce motion</option>
          <option value="off">Allow animations</option>
        </Select>
      </SettingsCard>
      <SettingsCard title="Display">
        <Toggle label="Larger text" description="Increase the size of all text." checked={prefs.largeText} onChange={(v) => save({ largeText: v })} />
        <Toggle label="High contrast" description="Stronger text and borders, no translucent surfaces." checked={prefs.highContrast} onChange={(v) => save({ highContrast: v })} />
        <Toggle label="Larger controls" description="Bigger buttons and touch targets." checked={prefs.largerControls} onChange={(v) => save({ largerControls: v })} />
      </SettingsCard>
      <SettingsCard title="Captions & lyrics">
        <Toggle label="Show captions by default" description="Turn on subtitles automatically when a music video has them." checked={prefs.captionsEnabled} onChange={(v) => save({ captionsEnabled: v })} />
        <Select label="Preferred caption language" value={prefs.subtitleLanguage || ''} onChange={(e) => save({ subtitleLanguage: e.target.value || null })}>
          <option value="">Video default</option>
          {(settings.subtitleLanguages || []).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </Select>
        <Toggle label="Persistent lyrics" description="Keep the lyrics tab open in the player for every song." checked={prefs.lyricsAutoOpen} onChange={(v) => save({ lyricsAutoOpen: v })} />
      </SettingsCard>
      <SettingsCard title="Keyboard & screen readers">
        <ul className="shortcut-list">
          <li>
            <kbd>Tab</kbd> moves between controls; every button has a label for screen readers.
          </li>
          <li>
            Video player: <kbd>Space</kbd> play/pause, <kbd>F</kbd> fullscreen, <kbd>C</kbd> captions, <kbd>M</kbd> mute, <kbd>←</kbd>/<kbd>→</kbd> seek.
          </li>
          <li>
            Lyrics sync editor: <kbd>Space</kbd> play/pause, <kbd>Enter</kbd> stamp line, <kbd>↑</kbd>/<kbd>↓</kbd> move between lines.
          </li>
          <li>
            <kbd>Esc</kbd> closes the full player, lyrics mode, menus and dialogs.
          </li>
        </ul>
      </SettingsCard>
    </>
  );
}

// ─── Privacy ───────────────────────────────────────────────────────────────
export function PrivacySection() {
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const { save } = usePrefUpdate();
  const p = prefs.privacy;
  const set = (key) => (v) => save({ privacy: { [key]: v } });
  if (!user) return <LoginRequired what="privacy settings" />;
  return (
    <>
      <SettingsCard title="Profile" description={<>Your public profile lives at <Link to={`/u/${user.username || user.id}`}>/u/{user.username || user.id}</Link>.</>}>
        <Toggle label="Public profile" description="Anyone can see your name, picture, bio and public playlists. When off, your profile page is hidden and you appear anonymously in artists' follower lists." checked={p.publicProfile} onChange={set('publicProfile')} />
        <Toggle label="Show listening activity" description="Show your recently played songs on your public profile." checked={p.showListeningActivity} onChange={set('showListeningActivity')} />
        <Toggle label="Show who you follow" description="List the artists you follow on your public profile." checked={p.showFollowing} onChange={set('showFollowing')} />
        {['artist', 'admin'].includes(user.role) ? (
          <Toggle label="Show your followers" description="Let visitors see the list of people following your artist profiles (the count is always shown)." checked={p.showFollowers} onChange={set('showFollowers')} />
        ) : null}
      </SettingsCard>
      <SettingsCard title="Personalisation & data">
        <Toggle label="Personalised recommendations" description='Use your listening history and favourites for "Made for you" and "Because you listened".' checked={p.personalizedRecommendations} onChange={set('personalizedRecommendations')} />
        <Toggle
          label="Usage analytics"
          description="Count your plays and views against your account. When off, they're counted anonymously — your recently played list stops updating."
          checked={p.usageAnalytics}
          onChange={set('usageAnalytics')}
        />
        <p className="settings-note">
          <Icon name="shield" size={14} /> SHERE MUSIC never stores your IP address or device details with your activity.
        </p>
      </SettingsCard>
    </>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────
export function NotificationsSection() {
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const { save } = usePrefUpdate();
  const n = prefs.notifications;
  const set = (key) => (v) => save({ notifications: { [key]: v } });
  if (!user) return <LoginRequired what="notification settings" />;
  return (
    <>
      <SettingsCard title="What to notify me about">
        <Toggle label="New music" description="When an artist you follow releases a song." checked={n.newMusic} onChange={set('newMusic')} />
        <Toggle label="New music videos" description="When an artist you follow releases a video." checked={n.newVideos} onChange={set('newVideos')} />
        <Toggle label="Artist updates" description="News from artists you follow." checked={n.artistUpdates} onChange={set('artistUpdates')} />
        <Toggle label="Followers" description="When someone follows your artist profile." checked={n.followers} onChange={set('followers')} />
        <Toggle label="Account & reviews" description="Review decisions on your uploads, verification and account changes." checked={n.account} onChange={set('account')} />
      </SettingsCard>
      <SettingsCard title="Email">
        <Toggle label="Email notifications" description="Also send the notifications above to your inbox. Security emails (password changes, sign-ins) are always sent." checked={n.email} onChange={set('email')} />
      </SettingsCard>
    </>
  );
}

// ─── Downloads ─────────────────────────────────────────────────────────────
export function DownloadsSection({ historySlot }) {
  const { prefs } = usePreferences();
  const { save } = usePrefUpdate();
  const supported = typeof navigator !== 'undefined' && 'connection' in navigator;
  return (
    <>
      <GuestNote />
      <SettingsCard title="Download behaviour" description="Downloads are always the original file, saved by your browser to its downloads folder.">
        <Toggle label="Download notifications" description="Show a notice when a download starts and finishes." checked={prefs.downloadNotifications} onChange={(v) => save({ downloadNotifications: v })} />
        <Toggle
          label="Only download on Wi-Fi"
          description={supported ? 'Block downloads while you are on mobile data.' : "Your browser doesn't report the connection type, so this can't be enforced here."}
          checked={prefs.wifiOnlyDownloads}
          onChange={(v) => save({ wifiOnlyDownloads: v })}
          disabled={!supported}
        />
        <p className="settings-note">
          <Icon name="info" size={14} /> Where downloads are stored is controlled by your browser or phone, not SHERE MUSIC.
        </p>
      </SettingsCard>
      {historySlot}
    </>
  );
}

// ─── Language ──────────────────────────────────────────────────────────────
const LYRIC_LANGUAGES = [
  ['en', 'English'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['pcm', 'Pidgin'],
  ['yo', 'Yoruba'],
  ['ig', 'Igbo'],
  ['ha', 'Hausa'],
  ['sw', 'Swahili'],
];

export function LanguageSection() {
  const { prefs } = usePreferences();
  const { settings } = useSettings();
  const { save } = usePrefUpdate();
  return (
    <>
      <GuestNote />
      <SettingsCard title="Content language" description="SHERE MUSIC's interface is in English. These choices decide which lyrics and subtitles you see first when several languages are available.">
        <Select label="Preferred lyrics language" value={prefs.language} onChange={(e) => save({ language: e.target.value })}>
          {LYRIC_LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        <Select label="Preferred subtitle language" value={prefs.subtitleLanguage || ''} onChange={(e) => save({ subtitleLanguage: e.target.value || null })}>
          <option value="">Video default</option>
          {(settings.subtitleLanguages || []).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </Select>
      </SettingsCard>
    </>
  );
}

export function LoginRequired({ what }) {
  return (
    <SettingsCard title="Log in required" description={`Log in to manage your ${what}.`}>
      <div>
        <Link to="/login" className="btn btn--primary">
          Log in
        </Link>
      </div>
    </SettingsCard>
  );
}
