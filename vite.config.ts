// Written with AI assistance (Claude).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // also reachable from a headset or phone on the same network
    port: 5173,
    strictPort: true, // if 5173 is taken, fail with a clear error instead of silently moving to 5174
  },
  worker: { format: 'es' },
});
