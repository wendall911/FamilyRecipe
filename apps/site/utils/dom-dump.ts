/*
 * dom-dump.ts - drives installed Firefox via WebdriverIO standalone,
 * dumps the DOM of a route with every node's computed styles inlined.
 * Assumes `pnpm run dev` is already serving http://localhost:5173.
 * pnpm exec tsx utils/dom-dump.ts /recipe/tiffin
 *
 * This is NOT a debugging script. This is for analysis of DOM structures
 * ONLY.
 */

import { remote } from 'webdriverio';

const path = process.argv[2] ?? '/';
const url = `http://localhost:5173${path}`;

const browser = await remote({
    logLevel: 'silent',
    capabilities: {
        browserName: 'firefox'
    },
});

try {
    await browser.url(url);

    const dump = await browser.execute(() => {
        const PROPS = [
            'display', 'flex-direction', 'align-items', 'align-self',
            'flex-grow', 'flex-shrink', 'flex-basis', 'margin', 'width',
        ];
        const root = document.querySelector('article');
        const lines: string[] = [];

        /*
         * A node's OWN text: its direct text nodes only, so identity (ingredient
         * description, action word, quantity) shows without swallowing the subtree.
         */
        const ownText = (el: Element): string =>
            Array.from(el.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.textContent ?? '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

        // The data-recipe-grid-* markers on this element (the layout hooks).
        const markers = (el: Element) =>
            el.getAttributeNames().filter((n) => n.startsWith('data-recipe-grid-'));

        /*
         * Walk the WHOLE article subtree — every element, so the real DOM
         * structure is preserved as text. Each line: indent = depth, the tag,
         * its recipe-grid markers, its own text, and the resolved layout props.
         * Comments/hydration markers are skipped (we only recurse elements).
         */
        const walk = (el: Element, depth: number) => {
            const tag = el.tagName.toLowerCase();
            const mk = markers(el);
            const mkStr = mk.length ? ` {${mk.join(',')}}` : '';
            const text = ownText(el);
            const textStr = text ? ` "${text}"` : '';
            const s = window.getComputedStyle(el);
            const props = PROPS.map((p) => `${p}:${s.getPropertyValue(p)}`).join('; ');

            /*
             * Resolved geometry: where the box actually landed after layout.
             * The computed props say what was declared; the rect says what the
             * browser did with it. Rounded — sub-pixel noise is not signal.
             */
            const r = el.getBoundingClientRect();
            const box = `L:${Math.round(r.left)} R:${Math.round(r.right)} W:${Math.round(r.width)}`;

            lines.push(`${'  '.repeat(depth)}<${tag}>${mkStr}${textStr}  ${box}  ${props}`);

            for (const child of Array.from(el.children)) {
                walk(child, depth + 1);
            }
        };

        if (root) {
            walk(root, 0);
        }
        else {
            lines.push('DUMP: no <article> found');
        }

        return lines.join('\n');
    });

    console.log(dump);
}
finally {
    await browser.deleteSession();
}
