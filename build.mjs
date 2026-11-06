import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

await mkdir('assets', { recursive: true });
await build({
    entryPoints: ['src/alpine.js', 'src/tiptap.js', 'src/compare.js'],
    outdir: 'assets', bundle: true, minify: true, format: 'iife',
    target: ['es2022'], legalComments: 'eof',
});
const template = await readFile('src/editor.template', 'utf8');
const metadata = {};
for (const kind of ['alpine', 'tiptap']) {
    const name = kind === 'alpine' ? 'Custom Alpine' : 'Tiptap';
    const isCustom = kind === 'alpine';
    const replacements = {
        '__NAME__': name,
        '__KIND__': kind,
        '__NUMBER__': isCustom ? '01' : '02',
        '__TITLE__': isCustom ? 'The handmade editor.' : 'The package editor.',
        '__DESCRIPTION__': isCustom ? 'A little Alpine, a contenteditable surface, and our own formatting logic. Try the essentials, then see what they cost.' : 'Tiptap’s editing engine, wrapped in the same Alpine interface. Same alert. Same controls. A different way to get there.',
        '__ALPINE_CURRENT__': isCustom ? 'aria-current="page"' : '',
        '__TIPTAP_CURRENT__': isCustom ? '' : 'aria-current="page"',
        '__LIMITATION__': isCustom ? 'Prototype limits: select text before bold, italic, or links. List toggles affect a whole containing list; undo stores the last 80 content snapshots and restores the cursor at the end. Nested lists and complex browser/IME behavior need more work before production.' : 'Tiptap includes a structured document model, selection handling, and transaction-based undo. Only the basic alert toolbar is enabled here.',
    };
    let html = template;
    for (const [key, value] of Object.entries(replacements)) html = html.replaceAll(key, value);
    await writeFile(`${kind}.html`, html);
    const bundle = await readFile(`assets/${kind}.js`);
    const dependency = JSON.parse(await readFile(isCustom ? 'node_modules/alpinejs/package.json' : 'node_modules/@tiptap/core/package.json'));
    metadata[kind] = { rawBytes: bundle.length, gzipBytes: gzipSync(bundle).length, version: `${isCustom ? 'Alpine' : 'Tiptap'} ${dependency.version}` };
}
await writeFile('assets/meta.js', `window.BUILD_META=${JSON.stringify(metadata)};`);
await writeFile('assets/build-meta.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
