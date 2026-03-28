<script lang="ts">
	// Displays the status of a single workflow node as a card.
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import type { components } from '$lib/api/schema.d.ts';

	type NodeStatus = components['schemas']['io.argoproj.workflow.v1alpha1.NodeStatus'];

	let { node, label }: { node: NodeStatus | undefined; label: string } = $props();

	const phaseVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		Succeeded: 'default',
		Running: 'secondary',
		Failed: 'destructive',
		Error: 'destructive',
		Pending: 'outline'
	};

	function formatDate(iso: string | undefined): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleString();
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<div class="flex items-center justify-between gap-2">
			<Card.Title class="text-sm font-medium">{label}</Card.Title>
			{#if node}
				<Badge variant={phaseVariant[node.phase ?? ''] ?? 'outline'}>
					{node.phase ?? 'Unknown'}
				</Badge>
			{:else}
				<Badge variant="outline">Not found</Badge>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="text-muted-foreground space-y-1 text-xs">
		{#if node}
			<div>Started: {formatDate(node.startedAt)}</div>
			<div>Finished: {formatDate(node.finishedAt)}</div>
			{#if node.message}
				<div class="text-destructive mt-1 break-words">{node.message}</div>
			{/if}
		{:else}
			<div>No data</div>
		{/if}
	</Card.Content>
</Card.Root>
