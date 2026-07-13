import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),

    kit: {
        adapter: adapter(),
        inlineStyleThreshold: 51200,
        csp: {
            mode: 'hash',
        },
        csrf: {
            trustedOrigins:
                process.env.NODE_ENV === 'development'
                    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
                    : [],
        },
        alias: {
            $comp: './src/components',
            $lib: './src/lib',
            $content: './src/content',
        },
    },
};

export default config;
