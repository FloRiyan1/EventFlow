import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@eventflow/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
