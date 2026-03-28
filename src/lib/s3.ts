// S3-compatible client factory.
// Reads connection settings from runtime environment variables so they can
// be injected at container startup without rebuilding the image.
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
	if (_client) return _client;
	const endpoint = env.S3_ENDPOINT;
	const region = env.S3_REGION ?? 'us-east-1';
	const accessKeyId = env.S3_ACCESS_KEY_ID;
	const secretAccessKey = env.S3_SECRET_ACCESS_KEY;

	if (!endpoint || !accessKeyId || !secretAccessKey) {
		throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required');
	}

	_client = new S3Client({
		endpoint,
		region,
		credentials: { accessKeyId, secretAccessKey },
		// Required for path-style access (MinIO, Ceph, etc.)
		forcePathStyle: true
	});
	return _client;
}

// Returns the list of allowed bucket names from S3_ALLOWED_BUCKETS (comma-separated).
export function getAllowedBuckets(): string[] {
	const raw = env.S3_ALLOWED_BUCKETS;
	if (!raw) throw new Error('S3_ALLOWED_BUCKETS is required');
	return raw.split(',').map((b) => b.trim()).filter(Boolean);
}

// Throws if the given bucket name is not in the allowed list.
export function assertBucketAllowed(bucket: string): void {
	const allowed = getAllowedBuckets();
	if (!allowed.includes(bucket)) {
		throw new Error(`Bucket "${bucket}" is not in the allowed list`);
	}
}
