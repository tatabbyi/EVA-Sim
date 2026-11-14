// Written with AI assistance (Claude).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true }, // reachable from a headset on the same network
  worker: { format: 'es' },
});
