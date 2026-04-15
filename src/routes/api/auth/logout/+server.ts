// Logout: clears the token cookie.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('token', { path: '/' });
	redirect(303, '/login');
};
