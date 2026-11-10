import { defineConfig } from 'vite';

// Relative base so the production build works from any folder or GitHub Pages sub-path.
export default defineConfig({
  base: './',
  server: { port: 5173, open: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
