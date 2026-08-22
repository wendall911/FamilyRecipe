<script lang="ts">
    import { page } from '$app/state';
    import cn from 'classnames';
    import ModeToggle from '$comp/header/ModeToggle.svelte';
    import { NAVIGATION } from '$content/links';
    import { METADATA } from '$content/info';

    const isActive = (url: string, pathname: string) =>
        pathname === url || pathname.startsWith(url);
</script>

<header class="top-0 z-50 w-full border-b backdrop-blur">
    <div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href="/" class="self-center">
            <h3 class="self-center">{METADATA.title}</h3>
        </a>
        <nav class="flex items-center text-sm">
            {#each NAVIGATION as link (link.name)}
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                <a
                    href={link.url}
                    class={cn(
                        'mb-0 inline-block pr-4 align-middle transition-colors hover:opacity-100',
                        isActive(link.url, page.url.pathname) ? 'opacity-100' : 'opacity-80'
                    )}
                >
                    {link.name}
                </a>
            {/each}
            <ModeToggle />
        </nav>
    </div>
</header>
