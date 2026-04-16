// Server-side load function: fetches Argo Workflows from the configured server.
// Connection settings are read from runtime environment variables so they can
// be injected at container startup without rebuilding the image.
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { createArgoClient } from '$lib/api/argo';
import { listBucketKeys, getAgentsBucket, getMapsBucket } from '$lib/s3';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 'workflows:list')) error(403, 'Forbidden');
	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE;

	if (!baseUrl || !namespace) {
		error(500, 'ARGO_BASE_URL and ARGO_NAMESPACE environment variables are required');
	}

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const [{ data, error: apiError }, agentKeys, mapKeys] = await Promise.all([
		client.GET('/api/v1/workflows/{namespace}', {
			params: {
				path: { namespace },
				query: {
					fields: 'items.metadata.name,items.metadata.uid,items.metadata.labels,items.status.phase,items.status.startedAt,items.status.finishedAt'
				}
			}
		}),
		listBucketKeys(getAgentsBucket()).catch(() => [] as string[]),
		listBucketKeys(getMapsBucket()).catch(() => [] as string[])
	]);

	if (apiError) {
		error(502, `Failed to fetch workflows: ${JSON.stringify(apiError)}`);
	}

	return {
		workflows: data?.items ?? [],
		namespace,
		agentKeys,
		mapKeys
	};
};
