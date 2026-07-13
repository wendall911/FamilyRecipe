<script lang="ts">
    import { toggleMode, mode } from '$lib/mode.svelte';
    import { MoonIcon, SunIcon } from '@lucide/svelte';
</script>

<button
    type="button"
    onclick={toggleMode}
    aria-label={mode.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    class="mr-5 opacity-80 hover:opacity-100"
>
    {#if mode.current === 'dark'}
        <SunIcon aria-label="Switch to light mode" size={20} strokeWidth={1.5} />
    {:else}
        <MoonIcon aria-label="Switch to dark mode" size={20} strokeWidth={1.5} />
    {/if}
</button>
