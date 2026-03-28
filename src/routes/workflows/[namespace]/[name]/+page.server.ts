// Server-side load for workflow detail page.
// Fetches the workflow with node status filtered to only the fields we display.
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { createArgoClient } from '$lib/api/argo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const baseUrl = env.ARGO_BASE_URL;

	if (!baseUrl) {
		error(500, 'ARGO_BASE_URL environment variable is required');
	}

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const { data, error: apiError } = await client.GET('/api/v1/workflows/{namespace}/{name}', {
		params: {
			path: { namespace: params.namespace, name: params.name },
			query: {
				// Fetch only the fields needed for the detail view
				fields: 'metadata.name,status.phase,status.startedAt,status.finishedAt,status.message,status.nodes'
			}
		}
	});

	if (apiError) {
		error(502, `Failed to fetch workflow: ${JSON.stringify(apiError)}`);
	}

	return {
		workflow: data!,
		namespace: params.namespace
	};
};
