import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/mom-is-coming-family-game/',
  root: 'github',
  publicDir: '../public',
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  plugins: [react()],
  build: {
    outDir: '../dist-github',
    emptyOutDir: true,
  },
});
