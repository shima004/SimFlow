// Pass authenticated user info to all pages via layout data.
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: locals.user };
};
