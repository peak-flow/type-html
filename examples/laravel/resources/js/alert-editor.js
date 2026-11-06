import Alpine from 'alpinejs';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// Same StarterKit setup as src/tiptap.js, so the editor can only produce tags the server allowlist keeps.
const extensions = [StarterKit.configure({
    heading: { levels: [2] },
    link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } },
    blockquote: false, codeBlock: false, code: false, horizontalRule: false,
    strike: false, underline: false, trailingNode: false,
})];

document.addEventListener('alpine:init', () => {
    Alpine.data('alertEditor', (initialHtml) => {
        // Kept outside the returned object: Alpine wraps its data in a reactive Proxy, which breaks Tiptap internals.
        let editor = null;

        return {
            body: initialHtml,

            init() {
                editor = new Editor({
                    element: this.$refs.editor,
                    extensions,
                    content: initialHtml,
                    onUpdate: () => {
                        // An empty Tiptap document serializes as "<p></p>"; send '' so the required rule catches it.
                        this.body = editor.isEmpty ? '' : editor.getHTML();
                    },
                });
            },

            destroy() {
                editor?.destroy();
            },

            toggle(action) {
                const chain = editor.chain().focus();
                if (action === 'bold') chain.toggleBold();
                if (action === 'italic') chain.toggleItalic();
                if (action === 'heading') chain.toggleHeading({ level: 2 });
                if (action === 'bulletList') chain.toggleBulletList();
                if (action === 'orderedList') chain.toggleOrderedList();
                if (action === 'undo') chain.undo();
                if (action === 'redo') chain.redo();
                chain.run();
            },

            addLink() {
                if (editor.state.selection.empty) return;
                const url = window.prompt('Link URL (https://…)');
                if (!url) return;
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            },
        };
    });
});

// Remove these two lines if your app already starts Alpine (for example, Livewire 3+ bundles and starts it).
window.Alpine = Alpine;
Alpine.start();
