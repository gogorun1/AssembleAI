import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/AssembleAI/' : '/',
  server: {
    host: true,
    port: 5325,
    allowedHosts: [
      'nor-photographer-architectural-douglas.trycloudflare.com'
    ]
  }
}));
