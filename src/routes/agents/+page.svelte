<script lang="ts">
	import BucketBrowser from '$lib/components/bucket-browser.svelte';
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6">
		<a href="/" class="text-muted-foreground hover:text-foreground mb-2 inline-block text-sm">
			← Back
		</a>
		<h1 class="text-2xl font-semibold">Agents</h1>
		<p class="text-muted-foreground text-sm">Bucket: agents</p>
	</div>

	<BucketBrowser bucket="agents" />
</main>
