import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@data': resolve(__dirname, '../data/data.json') } },
  test: { environment: 'jsdom', globals: true, include: ['test/**/*.test.{ts,tsx}'], setupFiles: ['./test/setup.ts'] },
});
