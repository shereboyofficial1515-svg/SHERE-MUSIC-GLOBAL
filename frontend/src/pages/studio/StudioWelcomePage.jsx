import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Logo from '../../components/ui/Logo.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField } from '../../components/ui/Form.jsx';
import { ImagePicker } from '../../components/admin/AdminUI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { toFormData } from '../../services/contentService.js';
import { checkFile } from '../../utils/audio.js';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

const PERKS = [
  ['upload', 'Upload songs', 'MP3, WAV, M4A or AAC with artwork.'],
  ['lyrics', 'Live lyrics', 'Write lyrics and sync them line by line.'],
  ['film', 'Music videos', 'Publish videos with subtitles in many languages.'],
  ['bar-chart', 'Analytics', 'Plays, downloads, views and followers.'],
];

/** Become an artist: create the first artist profile. */
export default function StudioWelcomePage() {
  useMeta({ title: 'Become an artist', noindex: true });
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const status = useAsync(() => studioService.status(), []);
  const [form, setForm] = useState({ name: '', bio: '', location: '' });
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useGSAP(
    () => {
      if (motionOK()) gsap.from('.welcome > *', { y: 20, autoAlpha: 0, stagger: 0.07, duration: 0.6 });
    },
    { scope: ref, dependencies: [status.loading] }
  );

  if (!user) return <Navigate to="/login" replace state={{ from: '/studio/welcome' }} />;
  if (status.error) return <div className="container page"><ErrorState error={status.error} onRetry={status.reload} /></div>;
  if (status.loading) return <PageLoader />;
  if (status.data.isCreator) return <Navigate to="/studio" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Enter your artist name.' });
    setBusy(true);
    try {
      const res = await studioService.createArtist(toFormData({ name: form.name.trim(), bio: form.bio.trim() || null, location: form.location.trim() || null }, { image }));
      setUser(res.data.user);
      toast.success(`Welcome to SHERE MUSIC STUDIO, ${res.data.artist.name}!`);
      navigate('/studio', { replace: true });
    } catch (err) {
      setErrors(Object.keys(err.fieldErrors || {}).length ? err.fieldErrors : { name: err.message });
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="container page page--narrow" ref={ref}>
      <div className="welcome stack-lg">
        <div className="studio-hero">
          <Logo to="/" />
          <p className="eyebrow" style={{ color: '#5ef0a6' }}>SHERE MUSIC STUDIO</p>
          <h1 className="hero__title" style={{ color: '#fff' }}>Put your music in front of listeners.</h1>
          <p style={{ color: 'rgba(255,255,255,.85)' }}>Create your artist profile to upload songs, lyrics and music videos, and follow how they perform.</p>
        </div>
        <ul className="perk-grid">
          {PERKS.map(([icon, title, text]) => (
            <li key={title} className="perk">
              <Icon name={icon} size={22} className="text-accent" />
              <strong>{title}</strong>
              <span className="text-sm text-muted">{text}</span>
            </li>
          ))}
        </ul>
        {!status.data.canCreateArtist ? (
          <Alert type="warning">Artist sign-ups are currently closed. Please check back later.</Alert>
        ) : (
          <form className="panel stack" onSubmit={submit} noValidate>
            <h2 className="panel__title">Create your artist profile</h2>
            <TextField label="Artist name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} required autoFocus />
            <TextArea label="Biography" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} maxLength={5000} />
            <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={80} placeholder="Lagos, Nigeria" />
            <ImagePicker
              label="Artist photo"
              round
              file={image}
              onChange={(f) => {
                const problem = checkFile(f, 'image', settings.maxImageMb);
                if (problem) return toast.error(problem);
                setImage(f);
                return undefined;
              }}
              onRemove={() => setImage(null)}
            />
            <p className="field__hint">
              {settings.artistAutoPublish ? 'Your uploads go live as soon as you publish them.' : 'Every upload is reviewed by the SHERE MUSIC team before it goes live.'} You can request a verified badge later.
            </p>
            <div className="row-end">
              <Link to="/" className="btn btn--ghost">
                Not now
              </Link>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                <Icon name="layers" size={18} /> {busy ? 'Creating…' : 'Create artist profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
