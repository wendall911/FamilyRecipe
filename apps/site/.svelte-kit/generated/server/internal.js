
import root from '../root.js';
import { set_building, set_prerendering } from '$app/env/internal';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../../../node_modules/.pnpm/@sveltejs+kit@2.69.2_@sveltejs+vite-plugin-svelte@7.2.0_svelte@5.56.4_@typescript-eslin_df48142f64742700c325c50ad8b6ed93/node_modules/@sveltejs/kit/src/runtime/shared-server.js';
import error from '../shared/error-template.js';

export const options = {
	app_template_contains_nonce: false,
	async: false,
	csp: {"mode":"hash","directives":{"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: ["http://localhost:5173","http://127.0.0.1:5173"],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: false,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!doctype html>\n<html lang=\"en\">\n    <head>\n        <meta charset=\"utf-8\" />\n        <link rel=\"icon\" href=\"" + assets + "/favicon.svg\" />\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n        <script>\n            (function () {\n                var stored = localStorage.getItem('mode');\n                var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';\n                var light =\n                    mode === 'light' ||\n                    (mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);\n                document.documentElement.classList.toggle('light', light);\n                document.documentElement.style.colorScheme = light ? 'light' : 'dark';\n            })();\n        </script>\n        " + head + "\n    </head>\n    <body data-sveltekit-preload-data=\"hover\">\n        <div style=\"display: contents\">" + body + "</div>\n    </body>\n</html>\n",
		error
	},
	version_hash: "nhv395"
};

export async function get_hooks() {
	let handle;
	let handleFetch;
	let handleError;
	let handleValidationError;
	let init;
	

	let reroute;
	let transport;
	

	return {
		handle,
		handleFetch,
		handleError,
		handleValidationError,
		init,
		reroute,
		transport
	};
}

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };
