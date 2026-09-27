import 'dotenv/config';

const bool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function fail(message) {
  console.error(`[config] ${message}`);
  process.exit(1);
}

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'FRONTEND_URL'].filter(
  (key) => !process.env[key]
);
if (missing.length) fail(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
if (process.env.JWT_SECRET.length < 32) fail('JWT_SECRET must be at least 32 characters long.');
if (isProduction && !process.env.RESEND_API_KEY) fail('RESEND_API_KEY is required in production.');
if (isProduction && !process.env.RESEND_FROM_EMAIL) fail('RESEND_FROM_EMAIL is required in production.');

const frontendUrls = list(process.env.FRONTEND_URL);
const sessionDays = Math.max(1, int(process.env.SESSION_DAYS, 7));
const cookieSecure = bool(process.env.COOKIE_SECURE, isProduction);
const sameSite = (process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')).toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) fail('COOKIE_SAMESITE must be lax, strict or none.');
if (sameSite === 'none' && !cookieSecure) fail('COOKIE_SAMESITE=none requires COOKIE_SECURE=true.');

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: int(process.env.PORT, 5000),
  frontendUrl: frontendUrls[0],
  corsOrigins: [...new Set([...frontendUrls, ...list(process.env.CORS_ORIGINS)])],
  trustProxy: int(process.env.TRUST_PROXY, isProduction ? 1 : 0),
  supabase: {
    url: process.env.SUPABASE_URL.replace(/\/+$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    audioBucket: process.env.STORAGE_AUDIO_BUCKET || 'music',
    mediaBucket: process.env.STORAGE_MEDIA_BUCKET || 'media',
    videoBucket: process.env.STORAGE_VIDEO_BUCKET || 'videos',
    subtitleBucket: process.env.STORAGE_SUBTITLE_BUCKET || 'subtitles',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: `${sessionDays}d`,
  },
  cookie: {
    name: 'sm_session',
    secure: cookieSecure,
    sameSite,
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAgeMs: sessionDays * 24 * 60 * 60 * 1000,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM_EMAIL || 'SHERE MUSIC <onboarding@resend.dev>',
  },
  uploads: {
    maxAudioMb: Math.max(1, int(process.env.MAX_AUDIO_MB, 50)),
    maxImageMb: Math.max(1, int(process.env.MAX_IMAGE_MB, 5)),
    maxVideoMb: Math.max(1, int(process.env.MAX_VIDEO_MB, 500)),
  },
  // Paystack. The secret key never leaves the server. sk_test_… = test mode, sk_live_… = live mode.
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    baseUrl: (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').replace(/\/+$/, ''),
    mode: (process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_live_') ? 'live' : 'test',
  },
  // Optional external lyrics provider. When set, these override the values saved in admin settings.
  lyrics: {
    apiUrl: process.env.LYRICS_API_URL || '',
    apiKey: process.env.LYRICS_API_KEY || '',
  },
});
