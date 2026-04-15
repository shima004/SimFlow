// Searches objects by key prefix and/or suffix (extension) pattern.
// Paginates through all objects and returns matches.
// GET /api/s3/search?bucket=<bucket>&prefix=<prefix>&suffix=<suffix>&query=<substring>&maxResults=<n>
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!can(locals.user?.role, 's3:view')) error(403, 'Forbidden');
	const bucket = url.searchParams.get('bucket');
	if (!bucket) error(400, 'bucket is required');

	try {
		assertBucketAllowed(bucket);
	} catch (e) {
		error(403, e instanceof Error ? e.message : String(e));
	}

	// prefix narrows the S3-side listing; suffix and query are filtered client-side
	const prefix = url.searchParams.get('prefix') ?? '';
	const suffix = url.searchParams.get('suffix') ?? '';
	const query = url.searchParams.get('query') ?? '';
	const maxResults = Number(url.searchParams.get('maxResults') ?? '200');

	try {
		const client = getS3Client();
		const results: { key: string; size: number | undefined; lastModified: Date | undefined }[] = [];
		let continuationToken: string | undefined;

		// Page through the listing until we have enough results or exhaust the bucket
		do {
			const res = await client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix || undefined,
					MaxKeys: 1000,
					ContinuationToken: continuationToken
				})
			);

			for (const obj of res.Contents ?? []) {
				const key = obj.Key ?? '';
				if (suffix && !key.endsWith(suffix)) continue;
				if (query && !key.includes(query)) continue;
				results.push({ key, size: obj.Size, lastModified: obj.LastModified });
				if (results.length >= maxResults) break;
			}

			continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
		} while (continuationToken && results.length < maxResults);

		return json({ objects: results, count: results.length });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 search failed: ${msg}`);
	}
};
