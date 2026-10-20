import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pandalsDevPlugin } from './vite-pandals-dev-plugin.js';

export default defineConfig({
  plugins: [react(), pandalsDevPlugin()],
  server: { port: 5173, host: true },
});
