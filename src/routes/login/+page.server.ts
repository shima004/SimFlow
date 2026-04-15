// Login action: validates JWT and stores it as an httpOnly cookie.
import { verifyJwt } from '$lib/auth';
import { getDb } from '$lib/db';
import type { User } from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const token = (form.get('token') as string)?.trim();

		if (!token) return fail(400, { error: 'JWTを入力してください' });

		const subject = await verifyJwt(token);
		if (!subject) return fail(401, { error: 'JWTが無効または期限切れです' });

		const db = getDb();
		const { env } = await import('$env/dynamic/private');

		// Auto-create admin on first login if subject matches ADMIN_SUBJECT
		if (env.ADMIN_SUBJECT && env.ADMIN_SUBJECT === subject) {
			const existing = db.prepare('SELECT id FROM users WHERE subject = ?').get(subject);
			if (!existing) {
				db.prepare("INSERT INTO users (subject, role) VALUES (?, 'admin')").run(subject);
			}
		}

		const user = db.prepare('SELECT * FROM users WHERE subject = ?').get(subject) as User | undefined;
		if (!user) return fail(403, { error: 'このユーザーはアクセス権がありません。管理者に登録を依頼してください。' });

		cookies.set('token', token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			// Expire when the browser session ends (or use JWT exp claim)
			maxAge: 60 * 60 * 24 * 7
		});

		redirect(303, '/');
	}
};
