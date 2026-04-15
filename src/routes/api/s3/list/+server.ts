// Lists objects in a bucket (or under a prefix).
// GET /api/s3/list?bucket=<bucket>&prefix=<prefix>&maxKeys=<n>
// competition/competition-upload roles can only see their own file in the agents bucket.
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

// Roles that are restricted to their own agent file in the agents bucket
const COMPETITION_ROLES = ['competition', 'competition-upload'] as const;
type CompetitionRole = (typeof COMPETITION_ROLES)[number];
function isCompetitionRole(role: string | undefined): role is CompetitionRole {
	return COMPETITION_ROLES.includes(role as CompetitionRole);
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!can(locals.user?.role, 's3:view')) error(403, 'Forbidden');
	const bucket = url.searchParams.get('bucket');
	if (!bucket) error(400, 'bucket is required');

	try {
		assertBucketAllowed(bucket);
	} catch (e) {
		error(403, e instanceof Error ? e.message : String(e));
	}

	const prefix = url.searchParams.get('prefix') ?? '';
	const maxKeys = Number(url.searchParams.get('maxKeys') ?? '1000');
	const continuationToken = url.searchParams.get('continuationToken') ?? undefined;

	// Block competition roles from the maps bucket entirely
	if (bucket === 'maps' && !can(locals.user?.role, 's3:maps:view')) error(403, 'Forbidden');

	// competition roles may only see their own zip in the agents bucket
	const restrictToOwn = isCompetitionRole(locals.user?.role) && bucket === 'agents';
	const ownKey = restrictToOwn ? `${locals.user!.subject}.zip` : null;

	try {
		const client = getS3Client();
		const res = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				// Narrow the S3-side listing to the exact key when restricted
				Prefix: ownKey ?? (prefix || undefined),
				MaxKeys: maxKeys,
				ContinuationToken: continuationToken
			})
		);

		let objects = (res.Contents ?? []).map((o) => ({
			key: o.Key,
			size: o.Size,
			lastModified: o.LastModified,
			etag: o.ETag
		}));

		// Exact-match filter: prefix search may return keys with the same prefix
		if (ownKey) objects = objects.filter((o) => o.key === ownKey);

		return json({
			objects,
			isTruncated: res.IsTruncated ?? false,
			nextContinuationToken: res.NextContinuationToken ?? null
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 list failed: ${msg}`);
	}
};
