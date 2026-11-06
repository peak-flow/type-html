# Type / HTML

A standalone alert-editor comparison. No PHP, Laravel, Livewire, database, CDN, or runtime npm server is required.

Open **index.html**, **alpine.html**, or **tiptap.html** directly in a browser. On this machine, Herd also serves the folder at **http://type-html.test**. That URL gives both pages a consistent browser-storage origin and is recommended for comparing saved results.

The compiled `assets/` folder is included. To share the demo, copy `index.html`, `alpine.html`, `tiptap.html`, `app.css`, and `assets/` together to any static host. There is no deployment build step unless you change the source.

## What is compared

- **Custom Alpine:** our own contenteditable editor, using Selection and Range rather than deprecated `document.execCommand`. Bold, italic, headings, lists, links, plain-text paste, and snapshot undo/redo.
- **Tiptap:** the open-source core and StarterKit, using the same toolbar and a structured document model. Both pages use Alpine for the interface and DOMPurify for sanitizing.

Tiptap was selected using weekly npm downloads among six checked candidates. For October 29–November 4, 2026: `@tiptap/core` 35,062,646; `quill` 8,743,642; `lexical` 8,530,442; `slate` 4,126,224; `tinymce` 1,448,757; `trix` 724,830. This is a package-download comparison, not a count of users or proof of quality. Source: https://api.npmjs.org/downloads/point/2026-10-29:2026-11-04/@tiptap/core . Installed versions are pinned in `package-lock.json` and recorded in `assets/build-meta.json`.

## Measurements

Each editor page shows live setup, ready, formatting, preview, browser save, and input-to-next-frame timings. Page-ready starts at the inline head script, after document navigation has already begun; it includes asset loading and two animation-frame callbacks. Input-to-next-frame measures scheduling, not actual paint or hardware input latency.

The repeatable benchmark creates a separate editor, preserving the visible draft. It uses identical HTML fixtures (6, 60, or 300 paragraphs), three discarded warmups and 15 measured iterations, and reports median and 95th percentile. It measures:

1. Editor creation, including inserting initial content. Destruction is excluded.
2. Loading the fixture and forcing layout.
3. Bolding the same selected text and forcing layout. Selecting the text is excluded.
4. Serializing to HTML.
5. Serialization, DOMPurify, preview insertion, and forced layout.
6. Serialization, DOMPurify, and a synchronous `localStorage.setItem`. This is **not a server/database save**; unavailable storage yields no save result.

The comparison page runs each editor sequentially in an offscreen, normally sized iframe and alternates the run order on subsequent comparisons. This avoids simultaneous editor workloads, but it is still a browser microbenchmark. Cache state, garbage collection, browser timer precision, extensions, power saving, and foreground/background tabs affect results. Repeat tests in the same foreground browser. Sub-millisecond differences rarely say much about user experience. Use the full pages to judge typing and actual usability.

Bundle sizes include the editor, the shared Alpine interface, and DOMPurify. Gzip bytes are calculated at build time; they are not a claim that your local server actually compresses responses. No Debugbar is included because it requires Laravel and would add overhead unrelated to editing.

## Safety and prototype boundaries

All initial/restored content, previews, draft saves, and HTML downloads use a narrow DOMPurify allowlist. Both versions accept plain-text paste and prevent drops. Links allow only HTTP, HTTPS, and mailto. No images, uploads, remote services, or analytics are included.

This is a **browser demo**, not a complete production editor. The custom version requires a selection for bold/italic/links, applies list toggles to the whole containing list, uses at most 80 full-HTML undo snapshots, and restores the cursor at the end on undo. It does not match Tiptap's document normalization, nested-list editing, comprehensive history behavior, or cross-browser/IME coverage. That extra functionality explains part of Tiptap's size and cost. Visible failures should count against the custom editor when choosing a production replacement.

Browser-side sanitation protects this preview; a future Laravel integration must sanitize independently on the server before storing and displaying content. Browser storage is per origin, may be unavailable on `file://` or in privacy modes, and is neither shared with other users nor appropriate for confidential patient information.

## Laravel example

`examples/laravel/` shows the Tiptap editor inside a Blade form, with the HTML sanitized on the server by HTMLPurifier and saved to an `alerts` table through Eloquent. See [examples/laravel/README.md](examples/laravel/README.md).

## Editing the demo

```sh
npm ci
npm run build
npm test
```

`src/editor.template` generates the two editor pages. Open the root-level pages to use the demo; `src/editor.html` redirects to the comparison if opened by accident. `src/custom-editor.js` contains the custom engine; `src/tiptap.js` the Tiptap adapter; `src/app.js` the shared interface and benchmark. `src/compare.js` handles the comparison page. `build.mjs` bundles dependencies locally using esbuild and writes bundle metadata. `tests/browser.mjs` exercises both pages in Chrome, including formatting, undo, links, paste, sanitation, draft restore, benchmarks, and the comparison runner. Chrome is expected at the standard macOS path; set `CHROME_PATH` to override it. Set `DEMO_URL` to test a hosted copy instead of the local files.
