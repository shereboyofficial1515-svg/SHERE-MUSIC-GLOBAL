import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';

const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '');

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Per-page SEO: title, description, canonical URL and Open Graph / Twitter tags. */
export function useMeta({ title, description, image, type = 'website', noindex = false } = {}) {
  const { settings } = useSettings();
  const siteName = settings?.siteName || 'SHERE MUSIC';
  const desc = description || settings?.siteDescription || 'Discover music. Stream music. Download music.';

  useEffect(() => {
    const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — Discover, stream and download music`;
    document.title = fullTitle;
    const url = `${SITE_URL}${window.location.pathname}`;
    const img = image || `${SITE_URL}/og-image.svg`;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:site_name', siteName);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);
    setCanonical(url);
  }, [title, desc, image, type, noindex, siteName]);
}
