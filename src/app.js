import Alpine from 'alpinejs';
import { SAMPLE, fixture, sanitize, safeURL, frame, bytes, stats, formatMs, remember, recall, RUNS, WARMUPS } from './common.js';

export function boot(kind, createEditor) {
    // Keep editor objects outside Alpine's proxies (important for ProseMirror).
    let editor;
    let benchmarkActive = false;
    const storeKey = `type-html:draft:${kind}`;
    const measure = (name, callback) => {
        const start = performance.now();
        const result = callback();
        const elapsed = performance.now() - start;
        return { result, elapsed };
    };
    Alpine.data('editorDemo', () => ({
        kind,
        title: kind === 'alpine' ? 'The handmade editor.' : 'The package editor.',
        status: 'Ready when you are.',
        dirty: false,
        previewOpen: false,
        previewHTML: '',
        sourceOpen: false,
        sourceHTML: '',
        chars: 0,
        size: 'short',
        initMs: null,
        readyMs: null,
        latency: null,
        actionMs: null,
        previewMs: null,
        saveMs: null,
        busy: false,
        progress: '',
        report: null,
        linkOpen: false,
        linkURL: '',
        linkError: '',
        bundle: window.BUILD_META?.[kind],
        ms: formatMs,
        async init() {
            const stored = recall(storeKey);
            const html = sanitize(typeof stored?.html === 'string' ? stored.html : SAMPLE);
            const start = performance.now();
            editor = createEditor(this.$refs.editor, html, () => {
                if (!benchmarkActive) this.changed();
            });
            this.initMs = performance.now() - start;
            this.changed(false);
            if (stored?.html) this.status = 'Your browser draft is restored.';
            this.$refs.editor.addEventListener('paste', event => {
                event.preventDefault();
                editor.insertText(event.clipboardData.getData('text/plain'));
            }, true);
            this.$refs.editor.addEventListener('drop', event => event.preventDefault());
            this.$refs.editor.addEventListener('input', () => {
                const start = performance.now();
                requestAnimationFrame(() => { this.latency = performance.now() - start; });
            });
            window.DEMO = {
                kind,
                getHTML: () => editor.getHTML(),
                setHTML: html => { editor.setHTML(sanitize(html)); this.changed(); },
                selectFirstWord: () => editor.selectFirstWord(),
                command: (action, value) => this.action(action, value),
                preview: () => this.preview(),
                save: () => this.save(),
                runBenchmark: () => this.runBenchmark(),
                getReport: () => this.report,
            };
            await frame();
            await frame();
            this.readyMs = performance.now() - window.PAGE_STARTED;
            window.DEMO_READY = true;
            if (new URLSearchParams(location.search).has('benchmark')) {
                await this.runBenchmark();
                if (window.parent !== window) window.parent.postMessage({ type: 'type-html:benchmark', kind, report: JSON.parse(JSON.stringify(this.report)) }, '*');
            }
        },
        destroy() { editor?.destroy(); },
        changed(dirty = true) {
            this.chars = editor.getText().length;
            this.dirty = dirty;
            if (this.sourceOpen) this.sourceHTML = editor.getHTML();
            if (dirty) this.status = 'Unsaved changes';
        },
        action(name, value) {
            if (this.busy) return;
            const { result, elapsed } = measure('format', () => editor.command(name, value));
            this.actionMs = elapsed;
            this.changed();
            if (result === false) this.status = 'Select some text first, then choose formatting.';
        },
        openLink() {
            this.linkURL = 'https://';
            this.linkError = '';
            this.linkOpen = true;
            this.$nextTick(() => this.$refs.linkInput.focus());
        },
        closeLink() {
            this.linkOpen = false;
            this.$nextTick(() => this.$refs.linkButton.focus());
        },
        addLink() {
            const url = safeURL(this.linkURL);
            if (!url) { this.linkError = 'Use an https://, http://, or mailto: address.'; return; }
            this.linkOpen = false;
            this.action('link', url);
        },
        preview() {
            const { elapsed } = measure('preview', () => {
                this.previewHTML = sanitize(editor.getHTML());
                this.previewOpen = true;
            });
            // Includes the actual preview DOM update and layout, not just Alpine state.
            const start = performance.now() - elapsed;
            this.$nextTick(() => {
                this.$refs.preview.getBoundingClientRect();
                this.previewMs = performance.now() - start;
            });
        },
        save() {
            const { result, elapsed } = measure('save', () => remember(storeKey, {
                html: sanitize(editor.getHTML()),
                savedAt: new Date().toISOString(),
            }));
            this.saveMs = elapsed;
            this.status = result ? 'Draft saved in this browser.' : 'Storage is unavailable. Download the HTML instead.';
            if (result) this.dirty = false;
        },
        download() {
            const blob = new Blob([sanitize(editor.getHTML())], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = Object.assign(document.createElement('a'), { href: url, download: `alert-${kind}.html` });
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        toggleSource() {
            this.sourceOpen = !this.sourceOpen;
            this.sourceHTML = editor.getHTML();
        },
        loadSample() {
            if (this.dirty && !confirm('Replace your unsaved edits with the sample?')) return;
            editor.setHTML(sanitize(SAMPLE));
            this.changed();
            this.previewOpen = false;
            this.status = 'Sample loaded. Your saved draft is unchanged.';
        },
        async runBenchmark() {
            if (this.busy) return;
            this.busy = true;
            benchmarkActive = true;
            const html = fixture(this.size);
            const results = Object.fromEntries(['setup', 'load', 'format', 'serialize', 'preview', 'save'].map(key => [key, []]));
            const container = document.createElement('div');
            container.className = 'benchmark-sandbox';
            document.body.append(container);
            const preview = document.createElement('div');
            const tempHost = document.createElement('div');
            container.append(tempHost, preview);
            const key = `type-html:benchmark-temp:${kind}`;
            let storageAvailable = true;
            let temp;
            try {
                for (let index = -WARMUPS; index < RUNS; index++) {
                    this.progress = index < 0 ? `Warming up ${index + WARMUPS + 1}/${WARMUPS}` : `Measuring ${index + 1}/${RUNS}`;
                    const sample = (name, callback) => {
                        const start = performance.now();
                        const value = callback();
                        const elapsed = performance.now() - start;
                        if (index >= 0) results[name].push(elapsed);
                        return value;
                    };
                    // Identical starting content; destruction is outside the setup timer.
                    temp = sample('setup', () => createEditor(tempHost, html));
                    sample('load', () => { temp.setHTML(html); tempHost.getBoundingClientRect(); });
                    temp.selectFirstWord();
                    sample('format', () => { temp.command('bold'); tempHost.getBoundingClientRect(); });
                    // Restore identical content for serialization, preview, and saving.
                    temp.setHTML(html);
                    sample('serialize', () => temp.getHTML());
                    sample('preview', () => {
                        preview.innerHTML = sanitize(temp.getHTML());
                        preview.getBoundingClientRect();
                    });
                    sample('save', () => {
                        const draft = sanitize(temp.getHTML());
                        try { localStorage.setItem(key, draft); }
                        catch { storageAvailable = false; }
                    });
                    temp.destroy();
                    temp = null;
                    preview.replaceChildren();
                    await frame();
                }
                this.report = {
                    kind, size: this.size, inputBytes: bytes(html), iterations: RUNS, warmups: WARMUPS,
                    measuredAt: new Date().toISOString(), userAgent: navigator.userAgent,
                    debug: false, storageAvailable, bundle: this.bundle,
                    metrics: Object.fromEntries(Object.entries(results).map(([key, values]) => [key, key === 'save' && !storageAvailable ? null : stats(values)])),
                };
                remember(`type-html:report:${kind}`, this.report);
                this.status = 'Benchmark complete. Your editing content is unchanged.';
                this.progress = '';
                return this.report;
            } catch (error) {
                this.status = `Benchmark failed: ${error.message}`;
                throw error;
            } finally {
                temp?.destroy();
                container.remove();
                try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
                this.busy = false;
                benchmarkActive = false;
            }
        },
        exportReport() {
            if (!this.report) return;
            const url = URL.createObjectURL(new Blob([JSON.stringify(this.report, null, 2)], { type: 'application/json' }));
            Object.assign(document.createElement('a'), { href: url, download: `${kind}-benchmark.json` }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
    }));
    window.Alpine = Alpine;
    Alpine.start();
}
