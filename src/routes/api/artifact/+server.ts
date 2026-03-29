// Issues a presigned S3 GET URL for an artifact and redirects the browser to it.
// GET /api/artifact?bucket=<bucket>&key=<s3key>&filename=<filename>
import { error, redirect } from '@sveltejs/kit';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const bucket = url.searchParams.get('bucket');
	const key = url.searchParams.get('key');
	const filename = url.searchParams.get('filename');

	if (!bucket || !key) error(400, 'bucket and key are required');

	try {
		assertBucketAllowed(bucket);
	} catch (e) {
		error(403, e instanceof Error ? e.message : String(e));
	}

	const client = getS3Client();
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
		// Set Content-Disposition so the browser uses the correct filename
		ResponseContentDisposition: `attachment; filename="${filename ?? key.split('/').pop() ?? 'artifact'}"`,
	});

	const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
	redirect(302, presignedUrl);
};
