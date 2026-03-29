// Stops (terminates) one or more workflows.
// POST /api/workflow/stop
// Body: { names: string[] }
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { createArgoClient } from '$lib/api/argo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE;
	if (!baseUrl || !namespace) error(500, 'ARGO_BASE_URL and ARGO_NAMESPACE are required');

	let body: { names: string[] };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { names } = body;
	if (!Array.isArray(names) || names.length === 0) error(400, 'names must be a non-empty array');

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const results = await Promise.all(
		names.map(async (name) => {
			const { error: apiError } = await client.PUT('/api/v1/workflows/{namespace}/{name}/terminate', {
				params: { path: { namespace, name } },
				body: {}
			});
			return { name, error: apiError ? JSON.stringify(apiError) : null };
		})
	);

	return json({ results });
};
