import { marked, type Token, type Tokens } from 'marked';
import { parse as parseYaml } from 'yaml';

import type { RecipeScaling } from './model.ts';

/**
 * [EXT] Recipe-level scaling metadata, declared in the YAML frontmatter block.
 * The shape is owned by {@link RecipeScaling} in model.ts (single source of
 * truth); this alias names it in the markdown/extraction layer.
 */
export type RecipeMeta = RecipeScaling;

export interface ExtractedRecipe {
    title: string | null;
    blocks: string[];
    meta: RecipeMeta;
}

const RECIPE_LANGS = new Set(['', 'recipe', 'new-recipe']);
const SCALING_TYPES = new Set(['servings', 'fixed']);

function isRecipeCode(token: Token): token is Tokens.Code {
    if (token.type !== 'code') return false;
    const lang = (token as Tokens.Code).lang ?? '';
    return RECIPE_LANGS.has(lang);
}

/*
 * marked does not parse YAML frontmatter (it treats '---' as a thematic break),
 * so the leading '---'-fenced block is split off here before lexing. A document
 * with no frontmatter is returned unchanged with a null block.
 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

function splitFrontmatter(md: string): { yaml: string | null; body: string } {
    const match = FRONTMATTER.exec(md);
    if (match === null) return { yaml: null, body: md };
    return { yaml: match[1], body: md.slice(match[0].length) };
}

/*
 * Build RecipeMeta from parsed frontmatter, applying defaults. An unknown
 * scalingType falls back to 'fixed'; a non-numeric base falls back to 1.
 * NB: a fractional base (e.g. "1/2") is read by YAML as a string, not a
 * RecipeNumber, and so currently falls back to 1 — fraction bases are a later
 * concern.
 */
function toMeta(data: unknown): RecipeMeta {
    const record = (data ?? {}) as Record<string, unknown>;
    const rawType = record.scalingType;
    const scalingType =
        typeof rawType === 'string' && SCALING_TYPES.has(rawType)
            ? (rawType as 'servings' | 'fixed')
            : 'fixed';
    const base = typeof record.base === 'number' ? record.base : 1;
    return { scalingType, base };
}

export function extractRecipe(md: string): ExtractedRecipe {
    const { yaml, body } = splitFrontmatter(md);
    const meta = toMeta(yaml === null ? null : parseYaml(yaml));

    const tokens = marked.lexer(body);

    let title: string | null = null;
    const blocks: string[] = [];

    for (const token of tokens) {
        if (title === null && token.type === 'heading' && token.depth === 1) {
            title = token.text;
        } else if (isRecipeCode(token)) {
            blocks.push(token.text);
        }
    }

    return { title, blocks, meta };
}
