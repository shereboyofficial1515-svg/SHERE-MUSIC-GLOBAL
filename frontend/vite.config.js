import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const LOCAL = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i;

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // A production build must never call a development machine. On Vercel (VERCEL=1)
  // this fails the build; locally it only warns, since .env is for development.
  if (command === 'build' && mode === 'production') {
    const deploying = Boolean(process.env.VERCEL || process.env.CI);
    for (const key of ['VITE_API_URL', 'VITE_SITE_URL']) {
      if (env[key] && LOCAL.test(env[key])) {
        const message = `${key} points to localhost (${env[key]}). Set it to your production URL in Vercel → Settings → Environment Variables.`;
        if (deploying) throw new Error(message);
        console.warn(`[build] ${message}`);
      }
    }
    if (!env.VITE_API_URL || env.VITE_API_URL.startsWith('/')) {
      console.warn('[build] VITE_API_URL is not an absolute URL: the site will call /api on its own domain. That only works with the Vercel /api rewrite described in README → Deployment.');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // In development the API is proxied so cookies stay same-origin.
      proxy: {
        '/api': { target: env.DEV_API_PROXY || 'http://localhost:5000', changeOrigin: true },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
        },
      },
    },
  };
});
