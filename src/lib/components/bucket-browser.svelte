<script lang="ts">
	// Generic S3 bucket browser component.
	// Supports listing, search, upload (presigned PUT), download (presigned GET), and delete.
	import * as Table from '$lib/components/ui/table';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';

	let { bucket }: { bucket: string } = $props();

	type S3Object = {
		key: string;
		size: number | undefined;
		lastModified: string | undefined;
		etag: string | undefined;
	};

	let objects = $state<S3Object[]>([]);
	let loading = $state(false);
	let error = $state('');
	let searchQuery = $state('');
	let prefixFilter = $state('');
	let nextContinuationToken = $state<string | null>(null);
	let isTruncated = $state(false);
	let uploading = $state(false);
	let deletingKeys = $state<Set<string>>(new Set());

	// Fetch object list from the API
	async function loadObjects(reset = true) {
		loading = true;
		error = '';
		if (reset) {
			objects = [];
			nextContinuationToken = null;
		}

		const params = new URLSearchParams({ bucket, maxKeys: '200' });
		if (prefixFilter) params.set('prefix', prefixFilter);
		if (!reset && nextContinuationToken) params.set('continuationToken', nextContinuationToken);

		try {
			const res = await fetch(`/api/s3/list?${params}`);
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			objects = reset ? data.objects : [...objects, ...data.objects];
			isTruncated = data.isTruncated;
			nextContinuationToken = data.nextContinuationToken;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	// Search objects via the search endpoint
	async function searchObjects() {
		loading = true;
		error = '';
		objects = [];

		const params = new URLSearchParams({ bucket, query: searchQuery });
		if (prefixFilter) params.set('prefix', prefixFilter);

		try {
			const res = await fetch(`/api/s3/search?${params}`);
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			objects = data.objects;
			isTruncated = false;
			nextContinuationToken = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	// Download: get presigned GET URL and open it
	async function download(key: string) {
		const params = new URLSearchParams({ bucket, key, operation: 'get' });
		const res = await fetch(`/api/s3/presign?${params}`);
		if (!res.ok) { error = await res.text(); return; }
		const { url } = await res.json();
		window.open(url, '_blank');
	}

	// Upload: get presigned PUT URL, then PUT the file directly to S3
	async function upload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		error = '';

		const key = prefixFilter ? `${prefixFilter.replace(/\/$/, '')}/${file.name}` : file.name;
		const params = new URLSearchParams({ bucket, key, operation: 'put' });

		try {
			const presignRes = await fetch(`/api/s3/presign?${params}`);
			if (!presignRes.ok) throw new Error(await presignRes.text());
			const { url } = await presignRes.json();

			const uploadRes = await fetch(url, { method: 'PUT', body: file });
			if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

			// Reload to reflect the new file
			await loadObjects();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	// Delete a single object
	async function deleteObject(key: string) {
		deletingKeys = new Set([...deletingKeys, key]);
		error = '';

		try {
			const res = await fetch('/api/s3/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bucket, keys: [key] })
			});
			if (!res.ok) throw new Error(await res.text());
			objects = objects.filter((o) => o.key !== key);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			const next = new Set(deletingKeys);
			next.delete(key);
			deletingKeys = next;
		}
	}

	function formatBytes(bytes: number | undefined): string {
		if (bytes == null) return '-';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
		return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	}

	function formatDate(iso: string | undefined): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleString();
	}

	// Load on mount
	$effect(() => {
		loadObjects();
	});
</script>

<div class="space-y-4">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-2">
		<Input
			class="w-48"
			placeholder="Prefix filter"
			bind:value={prefixFilter}
			onkeydown={(e) => e.key === 'Enter' && loadObjects()}
		/>
		<Input
			class="w-48"
			placeholder="Search key..."
			bind:value={searchQuery}
			onkeydown={(e) => e.key === 'Enter' && (searchQuery ? searchObjects() : loadObjects())}
		/>
		<Button
			variant="outline"
			size="sm"
			onclick={() => (searchQuery ? searchObjects() : loadObjects())}
			disabled={loading}
		>
			{loading ? 'Loading...' : 'Search'}
		</Button>
		<Button variant="outline" size="sm" onclick={() => { searchQuery = ''; loadObjects(); }} disabled={loading}>
			Reset
		</Button>

		<!-- Upload: label styled as button wraps hidden file input -->
		<label class={buttonVariants({ size: 'sm' })} class:opacity-50={uploading} class:pointer-events-none={uploading}>
			{uploading ? 'Uploading...' : 'Upload'}
			<input type="file" class="hidden" onchange={upload} disabled={uploading} />
		</label>
	</div>

	{#if error}
		<p class="text-destructive text-sm">{error}</p>
	{/if}

	<!-- Object table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Key</Table.Head>
					<Table.Head class="w-28">Size</Table.Head>
					<Table.Head class="w-44">Last Modified</Table.Head>
					<Table.Head class="w-32"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if objects.length === 0 && !loading}
					<Table.Row>
						<Table.Cell colspan={4} class="text-muted-foreground text-center">
							No objects found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each objects as obj}
						<Table.Row>
							<Table.Cell class="font-mono text-xs break-all">{obj.key}</Table.Cell>
							<Table.Cell class="text-sm">{formatBytes(obj.size)}</Table.Cell>
							<Table.Cell class="text-sm">{formatDate(obj.lastModified)}</Table.Cell>
							<Table.Cell>
								<div class="flex gap-1">
									<Button size="sm" variant="outline" onclick={() => download(obj.key)}>
										Download
									</Button>
									<Button
										size="sm"
										variant="destructive"
										disabled={deletingKeys.has(obj.key)}
										onclick={() => deleteObject(obj.key)}
									>
										{deletingKeys.has(obj.key) ? '...' : 'Delete'}
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	{#if isTruncated}
		<div class="flex items-center gap-2">
			<Badge variant="outline">More results available</Badge>
			<Button size="sm" variant="outline" onclick={() => loadObjects(false)} disabled={loading}>
				Load more
			</Button>
		</div>
	{/if}
</div>
