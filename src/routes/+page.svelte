<script lang="ts">
	import WorkflowsTable from '$lib/components/workflows-table.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">Workflows</h1>
		<p class="text-muted-foreground text-sm">Namespace: {data.namespace}</p>
	</div>

	<WorkflowsTable workflows={data.workflows} namespace={data.namespace} />
</main>
