// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { it } from 'vitest';
import { mount, unmount } from 'svelte';
import RootHarness from './RootHarness.svelte';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
    return readFileSync(join(here, '..', 'fixtures', name), 'utf8');
}

it('mounts Recipe.Root with a context-reading child from raw md', () => {
    const md = loadFixture('turkish-pizza.md');

    const component = mount(RootHarness, {
        target: document.body,
        props: { md },
    });

    console.log('start');
    console.log(document.body.innerHTML);
    console.log('end');

    unmount(component);
});