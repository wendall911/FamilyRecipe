import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  /*
   * The svelte plugin is needed so the package's `.svelte` imports resolve
   * during the run. The smoke tests do not render components (no DOM env);
   * full DOM rendering comes later via the standalone Svelte 5 DOM tests.
   */
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
