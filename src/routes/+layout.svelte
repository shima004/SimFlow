<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<svelte:head>
	<title>SimFlow</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="border-b px-6 py-3 flex items-center justify-between">
	<ul class="flex gap-6 text-sm font-medium">
		<li><a href="/" class="hover:text-foreground text-muted-foreground">Workflows</a></li>
		<li><a href="/maps" class="hover:text-foreground text-muted-foreground">Maps</a></li>
		<li><a href="/agents" class="hover:text-foreground text-muted-foreground">Agents</a></li>
		<li><a href="/matrix" class="hover:text-foreground text-muted-foreground">Matrix</a></li>
		<li><a href="/competition" class="hover:text-foreground text-muted-foreground">Competition</a></li>
		{#if data.user?.role === 'admin'}
			<li><a href="/admin" class="hover:text-foreground text-muted-foreground">Admin</a></li>
		{/if}
	</ul>

	{#if data.user}
		<div class="flex items-center gap-3 text-sm">
			<span class="text-muted-foreground text-xs">
				<span class="font-mono">{data.user.subject}</span>
				<span class="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs">{data.user.role}</span>
			</span>
			<form method="POST" action="/api/auth/logout">
				<button type="submit" class="text-muted-foreground hover:text-foreground text-xs">ログアウト</button>
			</form>
		</div>
	{/if}
</nav>

{@render children()}
