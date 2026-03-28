<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import NodeStatusCard from '$lib/components/node-status-card.svelte';
	import type { PageData } from './$types';
	import type { components } from '$lib/api/schema.d.ts';

	let { data }: { data: PageData } = $props();

	type NodeStatus = components['schemas']['io.argoproj.workflow.v1alpha1.NodeStatus'];

	const phaseVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		Succeeded: 'default',
		Running: 'secondary',
		Failed: 'destructive',
		Error: 'destructive',
		Pending: 'outline'
	};

	// Lookup a node by its displayName from the nodes map
	function findNode(displayName: string): NodeStatus | undefined {
		const nodes = data.workflow.status?.nodes;
		if (!nodes) return undefined;
		return Object.values(nodes).find((n) => n.displayName === displayName);
	}

	// Node groups to display
	const precomputeNodes = [
		{ key: 'ambulance-precompute', label: 'Ambulance Precompute' },
		{ key: 'fire-precompute', label: 'Fire Precompute' },
		{ key: 'police-precompute', label: 'Police Precompute' },
		{ key: 'precompute-server', label: 'Precompute Server' }
	];

	const simulationNodes = [
		{ key: 'ambulance-simulation', label: 'Ambulance Simulation' },
		{ key: 'fire-simulation', label: 'Fire Simulation' },
		{ key: 'police-simulation', label: 'Police Simulation' },
		{ key: 'server-simulation', label: 'Server Simulation' }
	];

	const wf = data.workflow;

	function formatDate(iso: string | undefined): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleString();
	}
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6">
		<a href="/" class="text-muted-foreground hover:text-foreground mb-2 inline-block text-sm">
			← Back
		</a>
		<div class="flex items-center gap-3">
			<h1 class="font-mono text-2xl font-semibold">{wf.metadata?.name}</h1>
			<Badge variant={phaseVariant[wf.status?.phase ?? ''] ?? 'outline'}>
				{wf.status?.phase ?? 'Unknown'}
			</Badge>
		</div>
		<p class="text-muted-foreground mt-1 text-sm">Namespace: {data.namespace}</p>
		<div class="text-muted-foreground mt-1 flex gap-4 text-sm">
			<span>Started: {formatDate(wf.status?.startedAt)}</span>
			<span>Finished: {formatDate(wf.status?.finishedAt)}</span>
		</div>
		{#if wf.status?.message}
			<p class="text-destructive mt-2 text-sm">{wf.status.message}</p>
		{/if}
	</div>

	<section class="mb-8">
		<h2 class="mb-3 text-lg font-semibold">Precompute</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each precomputeNodes as { key, label }}
				<NodeStatusCard node={findNode(key)} {label} />
			{/each}
		</div>
	</section>

	<section>
		<h2 class="mb-3 text-lg font-semibold">Simulation</h2>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each simulationNodes as { key, label }}
				<NodeStatusCard node={findNode(key)} {label} />
			{/each}
		</div>
	</section>
</main>
