import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
