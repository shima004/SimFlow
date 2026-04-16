// Guard for the Maps page — requires s3:maps:view permission.
import { error } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { getMapsBucket } from '$lib/s3';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 's3:maps:view')) error(403, 'Forbidden');
	return { bucket: getMapsBucket() };
};
