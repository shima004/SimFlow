<script lang="ts">
	// Workflows data table built on @tanstack/table-core (Svelte 5 runes compatible)
	// and shadcn-svelte Table / Badge components.
	// Supports multi-select with stop and delete bulk actions.
	import type { components } from '$lib/api/schema.d.ts';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import { goto, invalidateAll } from '$app/navigation';

	let { workflows, namespace }: { workflows: Workflow[]; namespace: string } = $props();
	import {
		createColumnHelper,
		createTable,
		getCoreRowModel,
		getSortedRowModel,
		type SortingState
	} from '@tanstack/table-core';

	type Workflow = components['schemas']['io.argoproj.workflow.v1alpha1.Workflow'];

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
		col.accessor((w) => w.metadata?.labels?.['agent'] ?? '-', {
			id: 'agent',
			header: 'Agent',
			cell: (info) => info.getValue()
		}),
		col.accessor((w) => w.metadata?.labels?.['map'] ?? '-', {
			id: 'map',
			header: 'Map',
			cell: (info) => info.getValue()
		}),
		col.accessor((w) => w.metadata?.labels?.['score'] ?? '-', {
			id: 'score',
			header: 'Score',
			cell: (info) => {
				const v = info.getValue();
				const n = Number(v);
				return isNaN(n) ? v : n.toFixed(3);
			}
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

	// --- Sorting state ---
	let sorting = $state<SortingState>([]);

	let table = $derived(
		createTable({
			data: filteredWorkflows,
			columns,
			state: {
				sorting,
				columnPinning: { left: [], right: [] }
			},
			onSortingChange: (updater) => {
				sorting = typeof updater === 'function' ? updater(sorting) : updater;
			},
			onStateChange: () => {},
			renderFallbackValue: null,
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel()
		})
	);

	// --- Filter state ---
	let filterAgent = $state('');
	let filterMap = $state('');

	let filteredWorkflows = $derived(
		workflows.filter((w) => {
			const agent = w.metadata?.labels?.['agent'] ?? '';
			const map = w.metadata?.labels?.['map'] ?? '';
			return (
				agent.toLowerCase().includes(filterAgent.toLowerCase()) &&
				map.toLowerCase().includes(filterMap.toLowerCase())
			);
		})
	);

	// --- Multi-select state ---
	let selected = $state(new Set<string>());

	let allNames = $derived(filteredWorkflows.map((w) => w.metadata?.name ?? '').filter(Boolean));
	let allSelected = $derived(allNames.length > 0 && allNames.every((n) => selected.has(n)));
	let someSelected = $derived(selected.size > 0);

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(allNames);
	}

	function toggleRow(name: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(selected);
		next.has(name) ? next.delete(name) : next.add(name);
		selected = next;
	}

	// --- Bulk actions ---
	let actionError = $state('');
	let stopping = $state(false);
	let deleting = $state(false);

	async function stopSelected() {
		stopping = true;
		actionError = '';
		try {
			const res = await fetch('/api/workflow/stop', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ names: [...selected] })
			});
			if (!res.ok) throw new Error(await res.text());
			selected = new Set();
			await invalidateAll();
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
		} finally {
			stopping = false;
		}
	}

	async function deleteSelected() {
		deleting = true;
		actionError = '';
		try {
			const selectedWorkflows = workflows
				.filter((w) => selected.has(w.metadata?.name ?? ''))
				.map((w) => ({ name: w.metadata?.name ?? '', uid: w.metadata?.uid ?? '' }));
			const res = await fetch('/api/workflow/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workflows: selectedWorkflows })
			});
			const text = await res.text();
			if (!res.ok) throw new Error(text);
			const data = JSON.parse(text);
			const errors = data.results?.filter((r: { error: string | null }) => r.error).map((r: { name: string; error: string }) => `${r.name}: ${r.error}`);
			if (errors?.length) throw new Error(errors.join(', '));
			selected = new Set();
			await invalidateAll();
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
		} finally {
			deleting = false;
		}
	}

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

<!-- Bulk action toolbar -->
<!-- Filter bar -->
<div class="mb-2 flex gap-2">
	<Input placeholder="Filter agent..." bind:value={filterAgent} class="h-8 w-48 text-xs" />
	<Input placeholder="Filter map..." bind:value={filterMap} class="h-8 w-48 text-xs" />
	{#if filterAgent || filterMap}
		<Button size="sm" variant="ghost" class="h-8 text-xs" onclick={() => { filterAgent = ''; filterMap = ''; }}>
			Clear
		</Button>
	{/if}
	<span class="text-muted-foreground ml-auto self-center text-xs">{filteredWorkflows.length} / {workflows.length}</span>
</div>

{#if someSelected}
	<div class="bg-muted mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm">
		<span>{selected.size} selected</span>
		<Button size="sm" variant="outline" onclick={stopSelected} disabled={stopping || deleting}>
			{stopping ? 'Stopping...' : 'Stop'}
		</Button>
		<Button size="sm" variant="destructive" onclick={deleteSelected} disabled={stopping || deleting}>
			{deleting ? 'Deleting...' : 'Delete'}
		</Button>
		<Button size="sm" variant="ghost" onclick={() => (selected = new Set())} disabled={stopping || deleting}>
			Clear
		</Button>
		{#if actionError}
			<span class="text-destructive ml-2 text-xs">{actionError}</span>
		{/if}
	</div>
{/if}

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup}
				<Table.Row>
					<!-- Select-all checkbox -->
					<Table.Head class="w-10">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={toggleAll}
							class="cursor-pointer"
						/>
					</Table.Head>
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
					<Table.Cell colspan={columns.length + 1} class="text-muted-foreground text-center">
						No workflows found.
					</Table.Cell>
				</Table.Row>
			{:else}
				{#each table.getRowModel().rows as row}
					{@const wfName = row.original.metadata?.name ?? ''}
					<Table.Row
						class="cursor-pointer {selected.has(wfName) ? 'bg-muted/50' : ''}"
						onclick={() => goto(`/workflows/${namespace}/${wfName}`)}
					>
						<!-- Per-row checkbox -->
						<Table.Cell onclick={(e) => toggleRow(wfName, e)}>
							<input
								type="checkbox"
								checked={selected.has(wfName)}
								class="cursor-pointer"
								onchange={() => {}}
							/>
						</Table.Cell>
						{#each row.getVisibleCells() as cell}
							<Table.Cell>
								{#if cell.column.id === 'phase'}
									{@const phase = cell.getValue() as string}
									{@const phaseClass = phase === 'Succeeded' ? 'bg-green-500 text-white border-transparent hover:bg-green-500' : phase === 'Running' ? 'bg-blue-500 text-white border-transparent hover:bg-blue-500' : ''}
									<Badge variant={phaseVariant[phase] ?? 'outline'} class={phaseClass}>{phase}</Badge>
								{:else if cell.column.id === 'score'}
									{@const v = cell.getValue() as string}
									{@const n = Number(v)}
									{isNaN(n) ? v : n.toFixed(3)}
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
