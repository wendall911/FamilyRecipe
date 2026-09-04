<script lang="ts">
    import { page } from '$app/state';
</script>


<svelte:head>
    <title>Family Recipes</title>
</svelte:head>

<main>
    <ul>
        {#each page.data.titleSlugs as { title, slug } (slug)}
            <li><a href="/recipe/{slug}">{title}</a></li>
        {/each}
    </ul>
</main>
