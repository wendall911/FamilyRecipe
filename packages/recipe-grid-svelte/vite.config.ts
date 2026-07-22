import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  /*
   * The svelte plugin is needed so the package's `.svelte` imports resolve
   * during the run. The smoke tests do not render components (no DOM env);
   * full DOM rendering comes later via the standalone Svelte 5 DOM tests.
   */
  // @ts-expect-error
  plugins: [svelte(), svelteTesting()],
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'jsdom'
  },
});
