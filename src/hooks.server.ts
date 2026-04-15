// Request middleware: validates JWT from cookie and injects user into locals.
import { verifyJwt } from '$lib/auth';
import { getDb } from '$lib/db';
import type { User } from '$lib/db';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Extract JWT from httpOnly cookie
	const token = event.cookies.get('token');
	event.locals.user = null;

	if (token) {
		const subject = await verifyJwt(token);
		if (subject) {
			const db = getDb();
			// Auto-create admin if subject matches ADMIN_SUBJECT env var and no users exist
			const { env } = await import('$env/dynamic/private');
			if (env.ADMIN_SUBJECT === subject) {
				const existing = db.prepare('SELECT * FROM users WHERE subject = ?').get(subject) as User | undefined;
				if (!existing) {
					db.prepare("INSERT INTO users (subject, role) VALUES (?, 'admin')").run(subject);
				}
			}
			const user = db.prepare('SELECT * FROM users WHERE subject = ?').get(subject) as User | undefined;
			if (user) {
				event.locals.user = { subject: user.subject, role: user.role };
			}
		}
	}

	// Redirect unauthenticated users to login (except public paths and API routes)
	if (!event.locals.user && !PUBLIC_PATHS.includes(path) && !path.startsWith('/api/')) {
		return new Response(null, { status: 303, headers: { Location: '/login' } });
	}

	return resolve(event);
};
