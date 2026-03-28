<script lang="ts">
	// Displays the status of a single workflow node as a card.
	// Includes a "View Logs" button that streams logs in real time via SSE.
	import * as Card from '$lib/components/ui/card';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { components } from '$lib/api/schema.d.ts';
	import AnsiToHtml from 'ansi-to-html';

	const ansiConverter = new AnsiToHtml({ escapeXML: true });

	type NodeStatus = components['schemas']['io.argoproj.workflow.v1alpha1.NodeStatus'];

	let {
		node,
		label,
		namespace,
		workflowName,
		logUrl
	}: {
		node: NodeStatus | undefined;
		label: string;
		namespace: string;
		workflowName: string;
		logUrl?: string;
	} = $props();

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

	// --- Log streaming state ---
	// Flush interval in ms — balances UI responsiveness vs render cost
	const FLUSH_INTERVAL_MS = 150;
	// Keep only the last N lines to prevent unbounded memory growth
	const MAX_LINES = 2000;

	let sheetOpen = $state(false);
	let logText = $state('');   // raw ANSI text
	let logHtml = $state('');   // ANSI converted to HTML
	let logDone = $state(false);
	let logError = $state('');
	let eventSource: EventSource | null = null;
	let flushTimer: ReturnType<typeof setInterval> | null = null;
	// Lines accumulate here between flushes — never triggers reactivity
	let lineBuffer: string[] = [];

	function derivePodName(node: NodeStatus): string {
		// Pod name = insert templateRef.template between the prefix and hash of node.id
		// e.g. "wf-abc123-352152739" → "wf-abc123-python-agent-simulation-352152739"
		const lastHyphen = node.id.lastIndexOf('-');
		const prefix = node.id.slice(0, lastHyphen);
		const hash = node.id.slice(lastHyphen + 1);
		return `${prefix}-${node.templateRef?.template}-${hash}`;
	}

	function flushBuffer() {
		if (lineBuffer.length === 0) return;
		const incoming = lineBuffer.splice(0);
		// Merge with existing lines, capping at MAX_LINES
		const merged = (logText ? logText.split('\n') : []).concat(incoming);
		if (merged.length > MAX_LINES) merged.splice(0, merged.length - MAX_LINES);
		logText = merged.join('\n');
		logHtml = ansiConverter.toHtml(logText);
	}

	function openLogs() {
		if (!node?.id) return;
		// derivePodName requires templateRef.template; only available for Running nodes
		if (node.phase === 'Running' && !node.templateRef?.template) return;
		logText = '';
		logHtml = '';
		lineBuffer = [];
		logDone = false;
		logError = '';
		sheetOpen = true;

		// For Running nodes, derive the actual pod name; otherwise node.id is sufficient
		const podName = node.phase === 'Running' ? derivePodName(node) : node.id;
		const params = new URLSearchParams({
			namespace,
			workflow: workflowName,
			podName,
			nodeId: node.id,
			phase: node.phase ?? '',
			...(logUrl ? { logUrl } : {})
		});
		eventSource = new EventSource(`/api/log?${params}`);

		// Batch DOM updates — only re-render every FLUSH_INTERVAL_MS
		flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

		eventSource.onmessage = (e) => {
			lineBuffer.push(JSON.parse(e.data) as string);
		};

		eventSource.addEventListener('done', () => {
			flushBuffer();
			clearInterval(flushTimer!);
			flushTimer = null;
			logDone = true;
			eventSource?.close();
			eventSource = null;
		});

		eventSource.onerror = () => {
			flushBuffer();
			clearInterval(flushTimer!);
			flushTimer = null;
			logError = 'Connection lost.';
			logDone = true;
			eventSource?.close();
			eventSource = null;
		};
	}

	function onSheetClose() {
		clearInterval(flushTimer!);
		flushTimer = null;
		eventSource?.close();
		eventSource = null;
	}

	// --- Resizable panel ---
	const MIN_WIDTH = 320;
	let panelWidth = $state(672); // default ~sm:max-w-2xl

	function onResizeStart(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = panelWidth;

		function onMove(e: MouseEvent) {
			const delta = startX - e.clientX;
			// Clamp between MIN_WIDTH and 95% of viewport (evaluated at drag time, not module load)
			const max = window.innerWidth * 0.95;
			panelWidth = Math.min(max, Math.max(MIN_WIDTH, startWidth + delta));
		}
		function onUp() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
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
			<div class="pt-2">
				<Button size="sm" variant="outline" onclick={openLogs}>View Logs</Button>
			</div>
		{:else}
			<div>No data</div>
		{/if}
	</Card.Content>
</Card.Root>

<Sheet.Root bind:open={sheetOpen} onOpenChange={(open) => { if (!open) onSheetClose(); }}>
	<Sheet.Content side="right" class="w-full overflow-hidden" style="width: {panelWidth}px; max-width: 95vw;">
		<!-- Resize handle on the left edge -->
		<div
			class="absolute top-0 left-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/40 transition-colors"
			onmousedown={onResizeStart}
			role="separator"
			aria-label="Resize panel"
		></div>
		<Sheet.Header>
			<Sheet.Title>{label} — Logs</Sheet.Title>
			<Sheet.Description>
				{#if logDone}
					Stream ended.
				{:else}
					Streaming...
				{/if}
			</Sheet.Description>
		</Sheet.Header>
		<div class="mt-4 h-[calc(100vh-8rem)] overflow-y-auto rounded-md bg-black p-4">
			<pre class="font-mono text-xs whitespace-pre-wrap break-all text-white">{#if logHtml}{@html logHtml}{/if}{#if logError}<span class="text-red-400">{logError}</span>{/if}{#if !logDone && !logHtml}<span class="text-zinc-500">Waiting for logs...</span>{/if}</pre>
		</div>
	</Sheet.Content>
</Sheet.Root>

