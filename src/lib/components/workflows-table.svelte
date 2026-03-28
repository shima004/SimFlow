<script lang="ts">
	// Workflows data table built on @tanstack/table-core (Svelte 5 runes compatible)
	// and shadcn-svelte Table / Badge components.
	import type { components } from '$lib/api/schema.d.ts';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import {
		createColumnHelper,
		createTable,
		getCoreRowModel,
		getSortedRowModel,
		type SortingState
	} from '@tanstack/table-core';

	type Workflow = components['schemas']['io.argoproj.workflow.v1alpha1.Workflow'];

	let { workflows }: { workflows: Workflow[] } = $props();

	// --- Column definitions ---
	const col = createColumnHelper<Workflow>();
	const columns = [
		col.accessor((w) => w.metadata?.name ?? '', {
			id: 'name',
			header: 'Name',
			cell: (info) => info.getValue()
		}),
		col.accessor((w) => w.status?.phase ?? 'Unknown', {
			id: 'phase',
			header: 'Status',
			cell: (info) => info.getValue()
		}),
		col.accessor((w) => w.status?.startedAt ?? '', {
			id: 'startedAt',
			header: 'Started',
			cell: (info) => formatDate(info.getValue())
		}),
		col.accessor((w) => w.status?.finishedAt ?? '', {
			id: 'finishedAt',
			header: 'Finished',
			cell: (info) => (info.getValue() ? formatDate(info.getValue()) : '-')
		})
	];

	// --- Sorting state (reactive via runes) ---
	let sorting = $state<SortingState>([]);

	// Rebuild table whenever data or sorting changes
	let table = $derived(
		createTable({
			data: workflows,
			columns,
			state: {
				sorting,
				// columnPinning must be initialized to avoid getHeaderGroups errors
				columnPinning: { left: [], right: [] }
			},
			onSortingChange: (updater) => {
				sorting = typeof updater === 'function' ? updater(sorting) : updater;
			},
			// Required by TableOptionsResolved but state is managed externally
			onStateChange: () => {},
			renderFallbackValue: null,
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel()
		})
	);

	// --- Helpers ---
	function formatDate(iso: string): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleString();
	}

	const phaseVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		Succeeded: 'default',
		Running: 'secondary',
		Failed: 'destructive',
		Error: 'destructive',
		Pending: 'outline'
	};
</script>

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup}
				<Table.Row>
					{#each headerGroup.headers as header}
						<Table.Head
							class={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
							onclick={header.column.getToggleSortingHandler()}
						>
							{header.column.columnDef.header as string}
							{#if header.column.getIsSorted() === 'asc'}
								↑
							{:else if header.column.getIsSorted() === 'desc'}
								↓
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			{/each}
		</Table.Header>
		<Table.Body>
			{#if table.getRowModel().rows.length === 0}
				<Table.Row>
					<Table.Cell colspan={columns.length} class="text-muted-foreground text-center">
						No workflows found.
					</Table.Cell>
				</Table.Row>
			{:else}
				{#each table.getRowModel().rows as row}
					<Table.Row>
						{#each row.getVisibleCells() as cell}
							<Table.Cell>
								{#if cell.column.id === 'phase'}
									{@const phase = cell.getValue() as string}
									<Badge variant={phaseVariant[phase] ?? 'outline'}>{phase}</Badge>
								{:else}
									{cell.getValue() as string}
								{/if}
							</Table.Cell>
						{/each}
					</Table.Row>
				{/each}
			{/if}
		</Table.Body>
	</Table.Root>
</div>
