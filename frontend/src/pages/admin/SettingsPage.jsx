import { useEffect, useState } from 'react';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField, Toggle } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';

const SOCIALS = [
  ['instagram', 'Instagram'],
  ['x', 'X (Twitter)'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['spotify', 'Spotify'],
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

export default function SettingsPage() {
  useMeta({ title: 'Settings · Admin', noindex: true });
  const toast = useToast();
  const { refresh } = useSettings();
  const { data, loading, error, reload, setData } = useAsync(() => adminService.settings(), []);
  const [form, setForm] = useState(null);
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
      allowRegistration: data.allowRegistration,
      maintenanceMode: data.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage || '',
      featuredLimit: data.featuredLimit,
    });
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !form) return <PageLoader />;

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminService.saveSettings({
        ...form,
        maxAudioMb: Number(form.maxAudioMb),
        maxImageMb: Number(form.maxImageMb),
        featuredLimit: Number(form.featuredLimit),
        maintenanceMessage: form.maintenanceMessage.trim() || null,
      });
      setData(res.data);
      await refresh();
      toast.success('Settings saved.');
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(fieldErrors);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onBrandingUpdated = async (next) => {
    setData(next);
    await refresh();
  };

  return (
    <>
      <AdminHeader title="Settings" description="Site-wide configuration. Changes apply immediately." />
      {form.maintenanceMode ? <Alert type="warning">Maintenance mode is on. Visitors see the maintenance page; administrators can still use the site.</Alert> : null}

      <form onSubmit={save} className="settings-grid" noValidate>
        <section className="panel stack">
          <h2 className="panel__title">General</h2>
          <TextField label="Website name" value={form.siteName} onChange={set('siteName')} error={errors.siteName} maxLength={60} required />
          <TextArea label="Site description" value={form.siteDescription} onChange={set('siteDescription')} error={errors.siteDescription} maxLength={300} rows={3} hint="Used in the footer, home page and search engine descriptions." />
          <TextField label="Contact email" type="email" value={form.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} />
        </section>

        <section className="panel stack">
          <h2 className="panel__title">Branding</h2>
          <BrandingField kind="logo" label="Logo" currentUrl={data.logoUrl} hint="Square PNG or WebP works best. Replaces the built-in mark in the header." onUpdated={onBrandingUpdated} />
          <BrandingField kind="favicon" label="Favicon" currentUrl={data.faviconUrl} hint="PNG or ICO, ideally 64×64 or larger." onUpdated={onBrandingUpdated} />
        </section>

        <section className="panel stack">
          <h2 className="panel__title">Social media</h2>
          {SOCIALS.map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              type="url"
              placeholder="https://"
              value={form.socialLinks[key]}
              onChange={(e) => setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: e.target.value } }))}
              error={errors[`socialLinks.${key}`]}
            />
          ))}
        </section>

        <section className="panel stack">
          <h2 className="panel__title">Uploads</h2>
          <TextField label="Maximum audio size (MB)" type="number" min={1} max={data.ceilings.maxAudioMb} value={form.maxAudioMb} onChange={set('maxAudioMb')} error={errors.maxAudioMb} hint={`Server limit: ${data.ceilings.maxAudioMb} MB (MAX_AUDIO_MB).`} />
          <TextField label="Maximum image size (MB)" type="number" min={1} max={data.ceilings.maxImageMb} value={form.maxImageMb} onChange={set('maxImageMb')} error={errors.maxImageMb} hint={`Server limit: ${data.ceilings.maxImageMb} MB (MAX_IMAGE_MB).`} />
        </section>

        <section className="panel stack">
          <h2 className="panel__title">Access</h2>
          <Toggle label="Allow new registrations" description="When off, the sign-up page is closed. Existing users can still sign in." checked={form.allowRegistration} onChange={set('allowRegistration')} />
          <Toggle label="Maintenance mode" description="Temporarily hide the site from visitors." checked={form.maintenanceMode} onChange={set('maintenanceMode')} />
          <TextArea label="Maintenance message" value={form.maintenanceMessage} onChange={set('maintenanceMessage')} error={errors.maintenanceMessage} rows={2} maxLength={300} />
        </section>

        <section className="panel stack">
          <h2 className="panel__title">Featured music</h2>
          <TextField label="Songs in the Featured row" type="number" min={1} max={50} value={form.featuredLimit} onChange={set('featuredLimit')} error={errors.featuredLimit} hint="Mark songs as featured from the Music page." />
        </section>

        <div className="settings-grid__actions">
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </>
  );
}
