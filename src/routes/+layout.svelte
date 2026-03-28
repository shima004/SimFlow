<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="border-b px-6 py-3">
	<ul class="flex gap-6 text-sm font-medium">
		<li><a href="/" class="hover:text-foreground text-muted-foreground">Workflows</a></li>
		<li><a href="/maps" class="hover:text-foreground text-muted-foreground">Maps</a></li>
		<li><a href="/agents" class="hover:text-foreground text-muted-foreground">Agents</a></li>
	</ul>
</nav>

{@render children()}
