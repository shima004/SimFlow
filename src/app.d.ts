// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: {
				subject: string;
				role: 'admin' | 'operator' | 'competition-upload' | 'competition' | 'viewer';
			} | null;
		}
	}
}

export {};
