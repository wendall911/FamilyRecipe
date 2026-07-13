<script lang="ts">
    import { page } from '$app/state';
</script>

<main>
    <article>
        <div>
            <h1>Error {page.status}</h1>
            <p>{page.error?.message ?? 'Page Not Found'}</p>
        </div>

        <a href="/"> Home </a>
    </article>
</main>
