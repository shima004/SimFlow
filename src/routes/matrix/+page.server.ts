// Server-side load for the agent × map score matrix page.
// Fetches agent keys and map keys from S3, then overlays workflow scores
// from Argo Workflows labels (agent, map, score).
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client } from '$lib/s3';
import { createArgoClient } from '$lib/api/argo';
import type { PageServerLoad } from './$types';

// Strips the file extension from a key (e.g. "agent1.py" → "agent1")
function stripExt(key: string): string {
	const slash = key.lastIndexOf('/');
	const base = key.slice(slash + 1);
	const dot = base.lastIndexOf('.');
	if (dot <= 0) return key; // no extension or hidden file
	return key.slice(0, slash + 1 + dot);
}

async function listBucketKeys(bucket: string): Promise<string[]> {
	const client = getS3Client();
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const res = await client.send(
			new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: continuationToken })
		);
		for (const obj of res.Contents ?? []) {
			if (obj.Key) keys.push(stripExt(obj.Key));
		}
		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return keys;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 'workflows:view')) error(403, 'Forbidden');

	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE;

	if (!baseUrl || !namespace) {
		error(500, 'ARGO_BASE_URL and ARGO_NAMESPACE are required');
	}

	// Fetch agents, maps, and workflows in parallel
	const [agentKeys, mapKeys, workflowsResult] = await Promise.all([
		listBucketKeys('agents').catch(() => [] as string[]),
		listBucketKeys('maps').catch(() => [] as string[]),
		createArgoClient(baseUrl, env.ARGO_TOKEN)
			.GET('/api/v1/workflows/{namespace}', {
				params: {
					path: { namespace },
					query: {
						fields: 'items.metadata.name,items.metadata.labels,items.status.phase'
					}
				}
			})
			.catch(() => ({ data: null, error: null }))
	]);

	if (workflowsResult.error) {
		error(502, `Failed to fetch workflows: ${JSON.stringify(workflowsResult.error)}`);
	}

	// Build a lookup: (agent, map) → best RunInfo by score (highest numeric value wins).
	type RunInfo = { score: string; phase: string; workflowName: string };
	const scoreMap = new Map<string, RunInfo>();

	for (const wf of workflowsResult.data?.items ?? []) {
		const agent = wf.metadata?.labels?.['agent'];
		const map = wf.metadata?.labels?.['map'];
		const score = wf.metadata?.labels?.['score'];
		if (!agent || !map) continue;
		// Strip extensions so labels match S3 key display names
		const key = `${stripExt(agent)}::${stripExt(map)}`;
		const entry: RunInfo = {
			score: score ?? '',
			phase: wf.status?.phase ?? 'Unknown',
			workflowName: wf.metadata?.name ?? ''
		};
		const existing = scoreMap.get(key);
		if (!existing) {
			scoreMap.set(key, entry);
		} else {
			// Keep the entry with the higher numeric score
			const newScore = parseFloat(entry.score);
			const oldScore = parseFloat(existing.score);
			if (!isNaN(newScore) && (isNaN(oldScore) || newScore > oldScore)) {
				scoreMap.set(key, entry);
			}
		}
	}

	return {
		agentKeys,
		mapKeys,
		namespace,
		// Convert Map to plain object for serialization
		scoreMap: Object.fromEntries(scoreMap)
	};
};
