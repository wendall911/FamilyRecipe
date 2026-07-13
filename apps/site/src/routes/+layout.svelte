<script lang="ts">
    import '../app.css';
    import { mode } from '$lib/mode.svelte';
    import { page } from '$app/state';
    import Head from '$comp/Head.svelte';
    import Nav from '$comp/header/Nav.svelte';

    let { children } = $props();

    $effect(() => {
        void page.url.pathname;
        mode.apply();
    });
</script>

<Head />

<div>
    <Nav />
    {@render children()}
</div>
