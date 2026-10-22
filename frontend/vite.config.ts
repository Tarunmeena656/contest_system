import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// in development the api runs on :3000; the proxy keeps everything same-origin
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
