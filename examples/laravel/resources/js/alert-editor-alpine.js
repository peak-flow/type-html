import Alpine from 'alpinejs';
// Copy src/custom-editor.js from this repo to resources/js/custom-editor.js in your Laravel app.
import { createCustomEditor } from './custom-editor.js';

// Same rule as safeURL in src/common.js: the server purifier would strip other schemes anyway,
// but rejecting them here tells the author immediately.
function safeLinkUrl(value) {
    try {
        const parsed = new URL(value);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
        return null;
    }
}

// Registers the same 'alertEditor' component name and methods as alert-editor.js (Tiptap),
// so resources/views/alerts/form.blade.php works unchanged with either editor.
document.addEventListener('alpine:init', () => {
    Alpine.data('alertEditor', (initialHtml) => {
        // Kept outside Alpine's reactive Proxy, matching the Tiptap version.
        let editor = null;

        return {
            body: initialHtml,

            init() {
                const host = this.$refs.editor;
                editor = createCustomEditor(host, initialHtml, () => {
                    // An emptied contenteditable can still hold "<br>" or "<p><br></p>"; send '' so required fails.
                    this.body = editor.getText().trim() === '' ? '' : editor.getHTML();
                });

                // The custom engine does not handle paste itself (the demo's app.js does), so without this
                // a rich paste would insert arbitrary HTML into the editor.
                host.addEventListener('paste', (event) => {
                    event.preventDefault();
                    editor.insertText(event.clipboardData.getData('text/plain'));
                }, true);
                host.addEventListener('drop', (event) => event.preventDefault());
            },

            destroy() {
                editor?.destroy();
            },

            toggle(action) {
                editor.command(action);
            },

            addLink() {
                const url = safeLinkUrl(window.prompt('Link URL (https://…)') ?? '');
                if (!url) return;
                // Returns false when no text is selected; the custom engine needs a selection to link.
                editor.command('link', url);
            },
        };
    });
});

// Remove these two lines if your app already starts Alpine (for example, Livewire 3+ bundles and starts it).
window.Alpine = Alpine;
Alpine.start();
