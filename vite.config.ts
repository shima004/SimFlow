import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// better-sqlite3 is a native module and must not be bundled
		noExternal: [],
		external: ['better-sqlite3']
	}
});
