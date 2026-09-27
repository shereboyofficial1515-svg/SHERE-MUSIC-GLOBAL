import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { PasswordField, Select, TextArea, TextField, Toggle } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { cx } from '../../utils/format.js';

const SOCIALS = [
  ['instagram', 'Instagram'],
  ['x', 'X (Twitter)'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['spotify', 'Spotify'],
];

const TABS = [
  ['general', 'General', 'settings'],
  ['branding', 'Branding', 'image'],
  ['lyrics', 'Lyrics', 'lyrics'],
  ['videos', 'Music video', 'film'],
  ['studio', 'Studio', 'layers'],
  ['uploads', 'Uploads', 'upload'],
  ['access', 'Access', 'lock'],
  ['appearance', 'Appearance', 'sun'],
  ['notifications', 'Notifications', 'bell'],
];

function BrandingField({ kind, label, currentUrl, hint, onUpdated }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    const isIco = kind === 'favicon' && file.name.toLowerCase().endsWith('.ico');
    const problem = isIco ? null : checkFile(file, 'image', settings.maxImageMb);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const res = await adminService.uploadBranding(kind, file);
      onUpdated(res.data);
      toast.success(`${label} updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await adminService.uploadBranding(kind, null);
      onUpdated(res.data);
      toast.success(`${label} removed. The default is used again.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <ImagePicker label={busy ? `${label} (saving…)` : label} currentUrl={currentUrl} onChange={upload} onRemove={remove} error={error} hint={hint} />;
}

function SubtitleLanguagesEditor({ value, onChange }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const add = () => {
    const c = code.trim().toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(c) || !label.trim() || value.some((l) => l.code === c)) return;
    onChange([...value, { code: c, label: label.trim() }]);
    setCode('');
    setLabel('');
  };
  return (
    <div className="stack-sm">
      <span className="field__label">Subtitle languages</span>
      <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
        {value.map((l) => (
          <span key={l.code} className="chip">
            {l.label} <span className="text-muted text-sm">({l.code})</span>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => onChange(value.filter((x) => x.code !== l.code))} aria-label={`Remove ${l.label}`}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="row-gap wrap">
        <input className="input" style={{ width: 110 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. ha)" aria-label="Language code" maxLength={12} />
        <input className="input" style={{ width: 180 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Hausa)" aria-label="Language label" maxLength={40} />
        <button type="button" className="btn btn--secondary btn--sm" onClick={add}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      <p className="field__hint">Creators can upload subtitle files in these languages. Codes follow ISO 639 (en, fr, yo, ig, pcm…).</p>
    </div>
  );
}

export default function SettingsPage() {
  useMeta({ title: 'Settings · Admin', noindex: true });
  const toast = useToast();
  const { refresh } = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'general';
  const { data, loading, error, reload, setData } = useAsync(() => adminService.settings(), []);
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      siteName: data.siteName,
      siteDescription: data.siteDescription,
      contactEmail: data.contactEmail || '',
      socialLinks: Object.fromEntries(SOCIALS.map(([k]) => [k, data.socialLinks?.[k] || ''])),
      maxAudioMb: data.maxAudioMb,
      maxImageMb: data.maxImageMb,
      maxVideoMb: data.maxVideoMb,
      allowRegistration: data.allowRegistration,
      maintenanceMode: data.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage || '',
      featuredLimit: data.featuredLimit,
      lyricsEnabled: data.lyricsEnabled,
      videosEnabled: data.videosEnabled,
      allowArtistSignup: data.allowArtistSignup,
      artistAutoPublish: data.artistAutoPublish,
      emailNewReleases: data.emailNewReleases,
      defaultTheme: data.defaultTheme,
      subtitleLanguages: data.subtitleLanguages || [],
      lyricsProvider: {
        mode: data.lyricsProvider.mode,
        name: data.lyricsProvider.name || '',
        apiUrl: data.lyricsProvider.apiUrl || '',
        attribution: data.lyricsProvider.attribution || '',
      },
    });
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !form) return <PageLoader />;

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const setProvider = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, lyricsProvider: { ...f.lyricsProvider, [key]: value } }));
  };

  const save = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await adminService.saveSettings({
        ...form,
        maxAudioMb: Number(form.maxAudioMb),
        maxImageMb: Number(form.maxImageMb),
        maxVideoMb: Number(form.maxVideoMb),
        featuredLimit: Number(form.featuredLimit),
        maintenanceMessage: form.maintenanceMessage.trim() || null,
        lyricsProvider: {
          mode: form.lyricsProvider.mode,
          name: form.lyricsProvider.name.trim() || null,
          ...(data.lyricsProvider.configuredViaEnv ? {} : { apiUrl: form.lyricsProvider.apiUrl.trim() || null }),
          attribution: form.lyricsProvider.attribution.trim() || null,
          ...(apiKey ? { apiKey } : {}),
        },
      });
      setData(res.data);
      setApiKey('');
      await refresh();
      toast.success('Settings saved.');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    try {
      const res = await adminService.saveSettings({ lyricsProvider: { apiKey: null } });
      setData(res.data);
      toast.success('API key removed.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onBrandingUpdated = async (next) => {
    setData(next);
    await refresh();
  };

  return (
    <>
      <AdminHeader title="Settings" description="Platform-wide configuration. Changes apply immediately." />
      {form.maintenanceMode ? <Alert type="warning">Maintenance mode is on. Visitors see the maintenance page; administrators can still use the site.</Alert> : null}
      <div className="tabs" role="tablist" style={{ margin: 0 }}>
        {TABS.map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx('tab', tab === id && 'tab--active')} onClick={() => setParams({ tab: id }, { replace: true })}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={save} className="stack" noValidate>
        {tab === 'general' ? (
          <section className="panel stack">
            <TextField label="Website name" value={form.siteName} onChange={set('siteName')} error={errors.siteName} maxLength={60} required />
            <TextArea label="Site description" value={form.siteDescription} onChange={set('siteDescription')} error={errors.siteDescription} maxLength={300} rows={3} />
            <TextField label="Contact email" type="email" value={form.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} />
            <TextField label="Songs in the Spotlight row" type="number" min={1} max={50} value={form.featuredLimit} onChange={set('featuredLimit')} error={errors.featuredLimit} />
            <h3 className="panel__title">Social media</h3>
            <div className="form-row">
              {SOCIALS.map(([key, label]) => (
                <TextField key={key} label={label} type="url" placeholder="https://" value={form.socialLinks[key]} onChange={(e) => setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: e.target.value } }))} error={errors[`socialLinks.${key}`]} />
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'branding' ? (
          <section className="panel stack">
            <BrandingField kind="logo" label="Logo" currentUrl={data.logoUrl} hint="Square PNG or WebP. Replaces the built-in mark." onUpdated={onBrandingUpdated} />
            <BrandingField kind="favicon" label="Favicon" currentUrl={data.faviconUrl} hint="PNG or ICO, 64×64 or larger." onUpdated={onBrandingUpdated} />
          </section>
        ) : null}

        {tab === 'lyrics' ? (
          <section className="panel stack">
            <Toggle label="Show lyrics to listeners" description="Turn off to hide all lyrics across the site (they are kept, not deleted)." checked={form.lyricsEnabled} onChange={set('lyricsEnabled')} />
            <Select label="Lyrics source" value={form.lyricsProvider.mode} onChange={setProvider('mode')} hint="Manual lyrics are written or imported by artists and admins. External lyrics are fetched live from a provider and never stored.">
              <option value="manual">Manual only</option>
              <option value="external">External provider only</option>
              <option value="both">Manual + external (manual first)</option>
            </Select>
            {form.lyricsProvider.mode !== 'manual' ? (
              <>
                {data.lyricsProvider.configuredViaEnv ? <Alert type="info">The provider URL and key are set by the server (LYRICS_API_URL / LYRICS_API_KEY) and override these fields.</Alert> : null}
                <TextField label="Provider name" value={form.lyricsProvider.name} onChange={setProvider('name')} maxLength={60} />
                <TextField
                  label="API URL"
                  type="url"
                  value={form.lyricsProvider.apiUrl}
                  onChange={setProvider('apiUrl')}
                  disabled={data.lyricsProvider.configuredViaEnv}
                  hint="May contain {artist}, {title}, {album} and {duration}. The response must be JSON with syncedLyrics / plainLyrics (or lyrics)."
                  error={errors['lyricsProvider.apiUrl']}
                />
                <PasswordField
                  label="API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  hint={data.lyricsProvider.hasApiKey ? 'A key is saved. It is never shown again — type a new one to replace it.' : 'Optional. Sent as a Bearer token from the server only.'}
                />
                {data.lyricsProvider.hasApiKey && !data.lyricsProvider.configuredViaEnv ? (
                  <div>
                    <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={clearKey}>
                      Remove saved key
                    </button>
                  </div>
                ) : null}
                <TextField label="Attribution" value={form.lyricsProvider.attribution} onChange={setProvider('attribution')} maxLength={300} hint="Shown under provider lyrics, e.g. “Lyrics licensed by …”." />
                <p className="settings-note">
                  <Icon name="shield" size={14} /> Only use providers whose terms allow displaying their lyrics. Never configure scraped sources.
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        {tab === 'videos' ? (
          <section className="panel stack">
            <Toggle label="SHERE MUSIC VIDEO" description="Turn the music video section on or off for listeners." checked={form.videosEnabled} onChange={set('videosEnabled')} />
            <TextField label="Maximum video size (MB)" type="number" min={1} max={data.ceilings.maxVideoMb} value={form.maxVideoMb} onChange={set('maxVideoMb')} error={errors.maxVideoMb} hint={`Server limit: ${data.ceilings.maxVideoMb} MB (MAX_VIDEO_MB). Your Supabase plan's storage limit also applies.`} />
            <SubtitleLanguagesEditor value={form.subtitleLanguages} onChange={set('subtitleLanguages')} />
          </section>
        ) : null}

        {tab === 'studio' ? (
          <section className="panel stack">
            <Toggle label="Allow artist sign-ups" description="Listeners can create an artist profile in Studio." checked={form.allowArtistSignup} onChange={set('allowArtistSignup')} />
            <Toggle label="Publish without review" description="When on, artists' submissions go live immediately. When off (recommended), an admin approves each song, lyric and video." checked={form.artistAutoPublish} onChange={set('artistAutoPublish')} />
          </section>
        ) : null}

        {tab === 'uploads' ? (
          <section className="panel stack">
            <TextField label="Maximum audio size (MB)" type="number" min={1} max={data.ceilings.maxAudioMb} value={form.maxAudioMb} onChange={set('maxAudioMb')} error={errors.maxAudioMb} hint={`Server limit: ${data.ceilings.maxAudioMb} MB (MAX_AUDIO_MB).`} />
            <TextField label="Maximum image size (MB)" type="number" min={1} max={data.ceilings.maxImageMb} value={form.maxImageMb} onChange={set('maxImageMb')} error={errors.maxImageMb} hint={`Server limit: ${data.ceilings.maxImageMb} MB (MAX_IMAGE_MB).`} />
          </section>
        ) : null}

        {tab === 'access' ? (
          <section className="panel stack">
            <Toggle label="Allow new registrations" description="Applies to email and Google/Facebook sign-ups." checked={form.allowRegistration} onChange={set('allowRegistration')} />
            <Toggle label="Maintenance mode" description="Temporarily hide the site from visitors." checked={form.maintenanceMode} onChange={set('maintenanceMode')} />
            <TextArea label="Maintenance message" value={form.maintenanceMessage} onChange={set('maintenanceMessage')} rows={2} maxLength={300} />
          </section>
        ) : null}

        {tab === 'appearance' ? (
          <section className="panel stack">
            <Select label="Default theme" value={form.defaultTheme} onChange={set('defaultTheme')} hint="What new visitors see before they choose a theme themselves.">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Follow the visitor's device</option>
            </Select>
          </section>
        ) : null}

        {tab === 'notifications' ? (
          <section className="panel stack">
            <Toggle label="Release emails" description="Email followers when an artist they follow publishes a song or video (each listener can still opt out)." checked={form.emailNewReleases} onChange={set('emailNewReleases')} />
            <p className="settings-note">
              <Icon name="info" size={14} /> In-app notifications are always on; listeners choose what they receive in Settings → Notifications.
            </p>
          </section>
        ) : null}

        {tab !== 'branding' ? (
          <div className="settings-grid__actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}
