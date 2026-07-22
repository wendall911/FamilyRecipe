// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { it } from 'vitest';
import { mount, unmount } from 'svelte';
import { parse } from '@wendall911/recipe-grid';
import { Recipe } from '../../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

// Loader inline for now; a shared util comes once more tests need it.
function loadFixture(name: string): string {
    return readFileSync(join(here, '..', 'fixtures', name), 'utf8');
}

it('renders the fixture through Recipe.Grid', () => {
    const node = parse(loadFixture('turkish-pizza.md')).structure;

    const component = mount(Recipe.Grid, {
        target: document.body,
        props: { node },
    });

    console.log('start');
    console.log(document.body.innerHTML);
    console.log('end');

    unmount(component);
});
