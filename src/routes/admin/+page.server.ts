// Admin page: user management (add, update role, delete, issue JWT).
// Requires admin role.
import { getDb } from '$lib/db';
import { can } from '$lib/auth';
import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SignJWT } from 'jose';
import type { Actions, PageServerLoad } from './$types';
import type { User } from '$lib/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 'admin')) error(403, 'Forbidden');

	const db = getDb();
	const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
	return { users };
};

export const actions: Actions = {
	addUser: async ({ request, locals }) => {
		if (!can(locals.user?.role, 'admin')) return fail(403, { error: 'Forbidden' });

		const form = await request.formData();
		const subject = (form.get('subject') as string)?.trim();
		const role = form.get('role') as string;

		if (!subject) return fail(400, { error: 'Subject is required' });
		if (!['admin', 'operator', 'competition-upload', 'competition', 'viewer'].includes(role)) return fail(400, { error: 'Invalid role' });

		const db = getDb();
		try {
			db.prepare('INSERT INTO users (subject, role) VALUES (?, ?)').run(subject, role);
		} catch {
			return fail(409, { error: 'このユーザーは既に登録されています' });
		}
		return { success: true };
	},

	updateRole: async ({ request, locals }) => {
		if (!can(locals.user?.role, 'admin')) return fail(403, { error: 'Forbidden' });

		const form = await request.formData();
		const id = Number(form.get('id'));
		const role = form.get('role') as string;

		if (!['admin', 'operator', 'competition-upload', 'competition', 'viewer'].includes(role)) return fail(400, { error: 'Invalid role' });

		const db = getDb();
		db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
		return { success: true };
	},

	issueJwt: async ({ request, locals }) => {
		if (!can(locals.user?.role, 'admin')) return fail(403, { error: 'Forbidden' });

		const form = await request.formData();
		const subject = form.get('subject') as string;
		const expiresDays = Number(form.get('expires_days') ?? 30);

		if (!subject) return fail(400, { error: 'Subject is required' });
		if (!env.JWT_SECRET) return fail(500, { error: 'JWT_SECRET が設定されていません' });

		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const token = await new SignJWT({ sub: subject })
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt()
			.setExpirationTime(`${expiresDays}d`)
			.sign(secret);

		return { issuedToken: token, issuedSubject: subject };
	},

	deleteUser: async ({ request, locals }) => {
		if (!can(locals.user?.role, 'admin')) return fail(403, { error: 'Forbidden' });

		const form = await request.formData();
		const id = Number(form.get('id'));

		// Prevent self-deletion
		const db = getDb();
		const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
		if (target?.subject === locals.user?.subject) {
			return fail(400, { error: '自分自身は削除できません' });
		}

		db.prepare('DELETE FROM users WHERE id = ?').run(id);
		return { success: true };
	}
};
