import { defineConfig } from 'vite';

// No React plugin needed: Vite compiles JSX itself (automatic runtime).
export default defineConfig({
  build: { chunkSizeWarningLimit: 1500 }, // maplibre-gl alone is ~1 MB
});
