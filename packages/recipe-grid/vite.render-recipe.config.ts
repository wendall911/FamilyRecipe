import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: 'scripts/generate-dom.ts',
      formats: ['es'],
      fileName: 'render-recipe',
    },
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:process'],
      output: {
        entryFileNames: 'render-recipe',
        banner: '#!/usr/bin/env node',
      },
    },
    outDir: 'bin',
  },
});
