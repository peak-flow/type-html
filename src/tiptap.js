import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { boot } from './app.js';

function createTiptapEditor(host, html, onChange = () => {}) {
    const editor = new Editor({
        element: host,
        extensions: [StarterKit.configure({
            heading: { levels: [2] },
            link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } },
            blockquote: false, codeBlock: false, code: false, horizontalRule: false,
            strike: false, underline: false, trailingNode: false,
        })],
        content: html,
        editorProps: {
            attributes: { role: 'textbox', 'aria-label': 'Alert message', 'aria-multiline': 'true' },
            handlePaste: () => true, // The shared capture listener inserts plain text.
            handleDrop: () => true,
        },
        onUpdate: onChange,
    });
    let selection = { from: 1, to: 1 };
    editor.on('selectionUpdate', () => { selection = { from: editor.state.selection.from, to: editor.state.selection.to }; });
    return {
        getHTML: () => editor.getHTML(),
        getText: () => editor.getText(),
        setHTML: html => editor.commands.setContent(html, { emitUpdate: false }),
        focus: () => editor.commands.focus(),
        command(action, value) {
            let chain = editor.chain().focus().setTextSelection(selection);
            if (action === 'bold') chain = chain.toggleBold();
            if (action === 'italic') chain = chain.toggleItalic();
            if (action === 'heading') chain = chain.toggleHeading({ level: 2 });
            if (action === 'bulletList') chain = chain.toggleBulletList();
            if (action === 'orderedList') chain = chain.toggleOrderedList();
            if (action === 'link') {
                if (selection.from === selection.to) return false;
                chain = chain.extendMarkRange('link').setLink({ href: value });
            }
            if (action === 'undo') chain = chain.undo();
            if (action === 'redo') chain = chain.redo();
            return chain.run();
        },
        insertText(text) {
            const fragment = text.replace(/\r\n?/g, '\n').split('\n').flatMap((line, index) => [
                ...(index ? [{ type: 'hardBreak' }] : []),
                ...(line ? [{ type: 'text', text: line }] : []),
            ]);
            editor.chain().focus().insertContent(fragment).run();
        },
        selectFirstWord: () => editor.commands.setTextSelection({ from: 1, to: 10 }),
        destroy: () => editor.destroy(),
    };
}
boot('tiptap', createTiptapEditor);
