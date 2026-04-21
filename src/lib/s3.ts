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

	const hasStaticCreds = accessKeyId && secretAccessKey;

	_client = new S3Client({
		region,
		// Only set endpoint for S3-compatible storage (MinIO, Ceph, etc.)
		// Omit for AWS S3 to use the standard regional endpoint
		...(endpoint ? { endpoint } : {}),
		// Use static credentials when provided; otherwise fall back to the
		// default credential chain (IRSA, EC2 IMDSv2, env vars, ~/.aws, etc.)
		...(hasStaticCreds ? { credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } } : {}),
		// Path-style is required for MinIO/Ceph but must be false for AWS S3
		forcePathStyle: !!endpoint
	});
	return _client;
}

// Returns the agents bucket name from S3_AGENTS_BUCKET (default: 'agents').
export function getAgentsBucket(): string {
	return env.S3_AGENTS_BUCKET ?? 'agents';
}

// Returns the maps bucket name from S3_MAPS_BUCKET (default: 'maps').
export function getMapsBucket(): string {
	return env.S3_MAPS_BUCKET ?? 'maps';
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

// Strips the file extension from a key (e.g. "agent1.py" → "agent1")
export function stripExt(key: string): string {
	const slash = key.lastIndexOf('/');
	const base = key.slice(slash + 1);
	const dot = base.lastIndexOf('.');
	if (dot <= 0) return key; // no extension or hidden file
	return key.slice(0, slash + 1 + dot);
}

// Lists all object keys in a bucket, stripped of extensions.
export async function listBucketKeys(bucket: string): Promise<string[]> {
	const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
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
