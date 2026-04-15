// Deletes one or more workflows.
// Falls back to the archived-workflow endpoint if the active workflow is not found.
// POST /api/workflow/delete
// Body: { workflows: { name: string; uid: string }[] }
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { createArgoClient } from '$lib/api/argo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!can(locals.user?.role, 'workflows:delete')) error(403, 'Forbidden');
	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE;
	if (!baseUrl || !namespace) error(500, 'ARGO_BASE_URL and ARGO_NAMESPACE are required');

	let body: { workflows: { name: string; uid: string }[] };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { workflows } = body;
	if (!Array.isArray(workflows) || workflows.length === 0) {
		error(400, 'workflows must be a non-empty array');
	}

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const results = await Promise.all(
		workflows.map(async ({ name, uid }) => {
			// Try deleting as an active workflow first
			const { error: activeError } = await client.DELETE('/api/v1/workflows/{namespace}/{name}', {
				params: { path: { namespace, name } }
			});

			if (!activeError) return { name, error: null };

			// Fall back to archived workflow delete using UID
			const { error: archiveError } = await client.DELETE(
				'/api/v1/archived-workflows/{uid}',
				{ params: { path: { uid }, query: { namespace, name } } }
			);

			return { name, error: archiveError ? JSON.stringify(archiveError) : null };
		})
	);

	return json({ results });
};
