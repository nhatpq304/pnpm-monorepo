import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC replaces esbuild because esbuild does not emit the decorator metadata
  // Nest needs for constructor injection.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
