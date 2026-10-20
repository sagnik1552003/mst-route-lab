import { defineConfig } from 'vite';

// No React plugin needed: esbuild compiles JSX with the automatic runtime.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  build: { chunkSizeWarningLimit: 1500 }, // maplibre-gl alone is ~1 MB
});
