// Lists objects in a bucket (or under a prefix).
// GET /api/s3/list?bucket=<bucket>&prefix=<prefix>&maxKeys=<n>
import { error, json } from '@sveltejs/kit';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
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

	try {
		const client = getS3Client();
		const res = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix || undefined,
				MaxKeys: maxKeys,
				ContinuationToken: continuationToken
			})
		);

		return json({
			objects: (res.Contents ?? []).map((o) => ({
				key: o.Key,
				size: o.Size,
				lastModified: o.LastModified,
				etag: o.ETag
			})),
			isTruncated: res.IsTruncated ?? false,
			nextContinuationToken: res.NextContinuationToken ?? null
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 list failed: ${msg}`);
	}
};
