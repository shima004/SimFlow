<script lang="ts">
	import WorkflowsTable from '$lib/components/workflows-table.svelte';
	import RunWorkflowDialog from '$lib/components/run-workflow-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let dialogOpen = $state(false);
	let submittedName = $state('');
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Workflows</h1>
			<p class="text-muted-foreground text-sm">Namespace: {data.namespace}</p>
		</div>
		<Button onclick={() => (dialogOpen = true)}>Run Workflow</Button>
	</div>

	{#if submittedName}
		<div class="bg-muted mb-4 rounded-md px-4 py-2 text-sm">
			Submitted: <span class="font-mono">{submittedName}</span>
		</div>
	{/if}

	<WorkflowsTable workflows={data.workflows} namespace={data.namespace} />
</main>

<RunWorkflowDialog
	bind:open={dialogOpen}
	onclose={() => (dialogOpen = false)}
	onsubmitted={(name) => (submittedName = name)}
	agentKeys={data.agentKeys}
	mapKeys={data.mapKeys}
/>
