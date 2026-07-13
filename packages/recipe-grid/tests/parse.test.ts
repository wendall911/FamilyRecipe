import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractRecipe } from '../src/markdown.ts';
import { parseToTree } from '../src/index.ts';

const RECIPES_DIR = fileURLToPath(
    new URL('../../../apps/site/src/content/recipes/', import.meta.url),
);

function readRecipe(slug: string): string {
    return readFileSync(new URL(`${slug}.md`, `file://${RECIPES_DIR}`), 'utf8');
}

for (const slug of ['tiffin', 'egg-fried-rice']) {
    test(`${slug}: extracts a title and recipe block`, () => {
        const { title, blocks } = extractRecipe(readRecipe(slug));
        assert.ok(title, 'expected a title');
        assert.ok(blocks.length >= 1, 'expected at least one recipe block');
    });

    test(`${slug}: each recipe block parses`, () => {
        const { blocks } = extractRecipe(readRecipe(slug));
        for (const block of blocks) {
            assert.doesNotThrow(() => parseToTree(block));
        }
    });
}
