import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/*
 * Fixtures resolve from tests/fixtures, anchored to this file (tests/util),
 * so callers at any depth get the same path. Pass the full filename.
 */
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function loadFixture(name: string): string {
    return readFileSync(join(fixturesDir, name), 'utf8');
}
