import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: https://USERNAME.github.io/promptfolio/
  base: '/promptfolio/',
  // Tracks the latest build automatically; no date to update by hand.
  define: {
    __PROMPTFOLIO_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
