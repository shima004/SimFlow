// Pass agents bucket name (from S3_AGENTS_BUCKET env var) to the page.
import { can } from '$lib/auth';
import { getAgentsBucket } from '$lib/s3';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 's3:view')) error(403, 'Forbidden');
	return { bucket: getAgentsBucket() };
};
