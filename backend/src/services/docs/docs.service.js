import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { getSettings, uploadLimits } from '../settings.service.js';

/**
 * Documentation content lives in the repository (docs/public, docs/admin) —
 * never in the frontend's static files. Each collection is loaded into its
 * own in-memory index, so the public search can only ever see public
 * articles. The admin collection is only reachable through /api/admin/docs,
 * which sits behind requireAdmin.
 *
 * Section file format (docs/<collection>/<section>/index.md):
 *
 *   ---
 *   title: Getting Started
 *   description: …
 *   icon: compass
 *   order: 1
 *   ---
 *   @article creating-an-account
 *   title: Creating an account
 *   summary: One-line description.
 *   keywords: sign up, register
 *
 *   Markdown body…
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const DOCS_ROOT = process.env.DOCS_DIR ? path.resolve(process.env.DOCS_DIR) : path.resolve(here, '../../../../docs');
export const COLLECTIONS = { public: 'public', admin: 'admin' };

// Anything that looks like a credential blocks the article from being served.
const SECRET_PATTERNS = [
  [/sk_(live|test)_[A-Za-z0-9]{8,}/, 'Paystack secret key'],
  [/pk_(live|test)_[A-Za-z0-9]{8,}/, 'Paystack public key'],
  [/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/, 'Resend API key'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT / Supabase key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/i, 'database connection string with password'],
  [/GOCSPX-[A-Za-z0-9_-]{10,}/, 'Google OAuth client secret'],
];

function envSecrets() {
  return [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.JWT_SECRET,
    process.env.RESEND_API_KEY,
    process.env.PAYSTACK_SECRET_KEY,
    process.env.PAYSTACK_PUBLIC_KEY,
    process.env.LYRICS_API_KEY,
    process.env.ADMIN_PASSWORD,
  ].filter((v) => v && v.length >= 12);
}

export function findSecrets(text) {
  const hits = SECRET_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
  if (envSecrets().some((v) => text.includes(v))) hits.push('a value from the server environment');
  return hits;
}

function parseMeta(block) {
  const meta = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

function parseSection(file, slug) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = fm ? parseMeta(fm[1]) : {};
  const rest = fm ? raw.slice(fm[0].length) : raw;
  const articles = [];
  for (const chunk of rest.split(/^@article\s+/m).slice(1)) {
    const nl = chunk.indexOf('\n');
    const articleSlug = chunk.slice(0, nl).trim();
    const afterSlug = chunk.slice(nl + 1);
    const blank = afterSlug.search(/\n\s*\n/);
    const head = blank === -1 ? afterSlug : afterSlug.slice(0, blank);
    const body = (blank === -1 ? '' : afterSlug.slice(blank)).trim();
    const am = parseMeta(head);
    articles.push({
      slug: articleSlug,
      title: am.title || articleSlug,
      summary: am.summary || '',
      keywords: (am.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      body,
    });
  }
  return { slug, title: meta.title || slug, description: meta.description || '', icon: meta.icon || 'file-text', order: Number(meta.order) || 99, articles };
}

function loadCollection(name) {
  const dir = path.join(DOCS_ROOT, name);
  if (!fs.existsSync(dir)) return { meta: {}, sections: [], blocked: [] };
  const metaFile = path.join(dir, 'guide.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const blocked = [];
  const sections = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'index.md')))
    .map((d) => parseSection(path.join(dir, d.name, 'index.md'), d.name))
    .map((s) => ({
      ...s,
      articles: s.articles.filter((a) => {
        const hits = findSecrets(`${a.title}\n${a.summary}\n${a.body}`);
        if (hits.length) {
          blocked.push(`${name}/${s.slug}/${a.slug}`);
          console.error(`[docs] NOT serving ${name}/${s.slug}/${a.slug}: it looks like it contains ${hits.join(', ')}. Remove it from the documentation.`);
          return false;
        }
        return true;
      }),
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return { meta, sections, blocked };
}

// Cached per collection; in development the files are re-read when they change.
const cache = new Map();
function signature(name) {
  const dir = path.join(DOCS_ROOT, name);
  if (!fs.existsSync(dir)) return 'missing';
  let sig = '';
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = d.isDirectory() ? path.join(dir, d.name, 'index.md') : path.join(dir, d.name);
    if (fs.existsSync(f)) sig += `${f}:${fs.statSync(f).mtimeMs};`;
  }
  return sig;
}

export function getCollection(name) {
  const hit = cache.get(name);
  if (hit && (env.isProduction || Date.now() - hit.checkedAt < 3000)) return hit.data;
  const sig = env.isProduction ? 'prod' : signature(name);
  if (hit && hit.sig === sig) {
    hit.checkedAt = Date.now();
    return hit.data;
  }
  const data = loadCollection(name);
  cache.set(name, { data, sig, checkedAt: Date.now() });
  return data;
}

// ─── Placeholders ──────────────────────────────────────────────────────────
function money(minor, currency) {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(minor) / 100);
  } catch {
    return `${currency} ${Number(minor) / 100}`;
  }
}

/** Values the docs may mention, always read from current (public) settings. */
async function placeholders() {
  const s = await getSettings();
  const limits = uploadLimits(s);
  return {
    siteName: s.site_name,
    plusPrice: money(s.plus_price, s.payment_currency),
    submissionFee: money(s.artist_submission_fee, s.payment_currency),
    currency: s.payment_currency,
    contactEmail: s.contact_email || 'the contact address in the site footer',
    maxAudioMb: String(limits.audioMb),
    maxImageMb: String(limits.imageMb),
    maxVideoMb: String(limits.videoMb),
  };
}

const fill = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));

// ─── Read API ──────────────────────────────────────────────────────────────
export async function navigation(name) {
  const { meta, sections } = getCollection(name);
  const values = await placeholders();
  return {
    meta,
    sections: sections.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: fill(s.description, values),
      icon: s.icon,
      articles: s.articles.map((a) => ({ slug: a.slug, title: fill(a.title, values), summary: fill(a.summary, values) })),
    })),
  };
}

export async function article(name, sectionSlug, articleSlug) {
  const { sections } = getCollection(name);
  const flat = sections.flatMap((s) => s.articles.map((a) => ({ s, a })));
  const i = flat.findIndex(({ s, a }) => s.slug === sectionSlug && a.slug === articleSlug);
  if (i === -1) return null;
  const values = await placeholders();
  const link = (x) => (x ? { section: x.s.slug, slug: x.a.slug, title: fill(x.a.title, values) } : null);
  const { s, a } = flat[i];
  return {
    section: { slug: s.slug, title: s.title },
    article: { slug: a.slug, title: fill(a.title, values), summary: fill(a.summary, values), body: fill(a.body, values) },
    prev: link(flat[i - 1]),
    next: link(flat[i + 1]),
  };
}

// ─── Search ────────────────────────────────────────────────────────────────
const STOP = new Set('a an and are as at be by can do does for from get go has have how i if in is it me my of on or so the this to use using we what when where which who why will with you your'.split(' '));
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '') || w;
const tokens = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);

function snippet(body, terms) {
  const plain = body.replace(/[#>*_`|[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = plain.toLowerCase();
  const at = terms.map((t) => lower.indexOf(t)).filter((n) => n >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return plain.slice(0, 160);
  const start = Math.max(0, at - 60);
  return `${start > 0 ? '…' : ''}${plain.slice(start, start + 180).trim()}…`;
}

/** Search one collection only. The caller decides which collection a user may search. */
export async function search(name, query) {
  const terms = [...new Set(tokens(query))];
  if (!terms.length) return [];
  const { sections } = getCollection(name);
  const values = await placeholders();
  const results = [];
  for (const s of sections) {
    for (const a of s.articles) {
      const title = tokens(a.title);
      const keys = tokens(a.keywords.join(' '));
      const summary = tokens(a.summary);
      const headings = tokens((a.body.match(/^#{2,3} .*$/gm) || []).join(' '));
      const body = tokens(a.body);
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        const inBody = body.filter((w) => w === t).length;
        const s1 = (title.includes(t) ? 8 : 0) + (keys.includes(t) ? 5 : 0) + (summary.includes(t) ? 3 : 0) + (headings.includes(t) ? 3 : 0) + Math.min(inBody, 5);
        if (s1) matched++;
        score += s1;
      }
      if (!score) continue;
      score *= matched / terms.length; // prefer articles that match every word
      results.push({
        section: s.slug,
        sectionTitle: s.title,
        slug: a.slug,
        title: fill(a.title, values),
        snippet: fill(snippet(a.body, terms), values),
        score,
      });
    }
  }
  return results.sort((x, y) => y.score - x.score).slice(0, 15).map(({ score, ...r }) => r);
}

/** Admin screenshots are served only through the authenticated admin route. */
export function adminAssetPath(file) {
  if (!/^[a-z0-9-]+\.(png|jpe?g|webp)$/.test(file)) return null;
  const full = path.join(DOCS_ROOT, 'admin', 'assets', file);
  return fs.existsSync(full) ? full : null;
}
