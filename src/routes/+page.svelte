<script lang="ts">
	import WorkflowsTable from '$lib/components/workflows-table.svelte';
	import RunWorkflowDialog from '$lib/components/run-workflow-dialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { invalidateAll } from '$app/navigation';
	import { can } from '$lib/permissions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const role = $derived(data.user?.role);

	let dialogOpen = $state(false);
	let submittedNames = $state<string[]>([]);
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Workflows</h1>
			<p class="text-muted-foreground text-sm">Namespace: {data.namespace}</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => invalidateAll()}>Refresh</Button>
			{#if can(role, 'workflows:run')}
				<Button onclick={() => (dialogOpen = true)}>Run Workflow</Button>
			{/if}
		</div>
	</div>

	{#if submittedNames.length > 0}
		<div class="bg-muted mb-4 rounded-md px-4 py-2 text-sm">
			Submitted {submittedNames.length} workflow{submittedNames.length !== 1 ? 's' : ''}:
			{#each submittedNames as name}
				<span class="font-mono mr-2">{name}</span>
			{/each}
		</div>
	{/if}

	<WorkflowsTable
		workflows={data.workflows}
		namespace={data.namespace}
		canStop={can(role, 'workflows:stop')}
		canDelete={can(role, 'workflows:delete')}
	/>
</main>

<RunWorkflowDialog
	bind:open={dialogOpen}
	onclose={() => (dialogOpen = false)}
	onsubmitted={(names) => (submittedNames = names)}
	agentKeys={data.agentKeys}
	mapKeys={data.mapKeys}
/>
