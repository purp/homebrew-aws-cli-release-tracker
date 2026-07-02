import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/homebrew-aws-cli-release-tracker/',
  plugins: [react()],
  resolve: { alias: { '@data': resolve(__dirname, '../data/data.json') } },
  server: { fs: { allow: ['..'] } },
});
