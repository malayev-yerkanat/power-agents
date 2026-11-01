import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
  // Vite serves the project root in development; run history, logs and backups in .power-agents must never be served.
  // Setting deny replaces Vite's defaults, so they are repeated here.
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.power-agents/**'] } },
});
