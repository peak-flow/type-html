// Deliberately small Range-based editor. No deprecated document.execCommand.
// It is a prototype: Tiptap supplies a much richer document model and input handling.
export function createCustomEditor(host, initialHTML, onChange = () => {}) {
    host.contentEditable = 'true';
    host.innerHTML = initialHTML;
    let savedRange = null;
    let composing = false;
    let history = [initialHTML];
    let cursor = 0;
    const handlers = [];
    const listen = (target, type, handler) => {
        target.addEventListener(type, handler);
        handlers.push(() => target.removeEventListener(type, handler));
    };
    const currentRange = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        return host.contains(range.commonAncestorContainer) ? range : null;
    };
    const selectRange = range => {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range.cloneRange();
    };
    const restore = () => {
        host.focus({ preventScroll: true });
        if (savedRange && host.contains(savedRange.commonAncestorContainer)) selectRange(savedRange);
        if (!currentRange()) {
            const range = document.createRange();
            range.selectNodeContents(host);
            range.collapse(false);
            selectRange(range);
        }
        return currentRange();
    };
    const checkpoint = () => {
        const html = host.innerHTML;
        if (history[cursor] !== html) {
            history = history.slice(0, cursor + 1);
            history.push(html);
            if (history.length > 80) history.shift();
            cursor = history.length - 1;
        }
        onChange();
    };
    const closest = (node, selector) => {
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        const match = element?.closest(selector);
        return match && host.contains(match) ? match : null;
    };
    const unwrap = element => element.replaceWith(...element.childNodes);
    const selectedTextNodes = range => {
        // Split the end first so a single-text-node selection remains correct.
        if (range.endContainer.nodeType === Node.TEXT_NODE && range.endOffset < range.endContainer.length) {
            range.endContainer.splitText(range.endOffset);
        }
        if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
            const endContainer = range.endContainer;
            const endOffset = range.endOffset;
            const startContainer = range.startContainer;
            const startOffset = range.startOffset;
            const selected = startContainer.splitText(startOffset);
            range.setStart(selected, 0);
            if (endContainer === startContainer) range.setEnd(selected, endOffset - startOffset);
            else range.setEnd(endContainer, endOffset);
        }
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            if (node.length && range.intersectsNode(node)) nodes.push(node);
        }
        return nodes;
    };
    const removeMarkFromText = (node, selector) => {
        let ancestor = closest(node, selector);
        while (ancestor) {
            // Move original text nodes instead of cloning them: the remaining
            // selected nodes must retain their identities as we split marks.
            let middle = node;
            const partition = (parent, child, keepWrapper) => {
                const left = parent.cloneNode(false);
                const right = parent.cloneNode(false);
                while (parent.firstChild !== child) left.append(parent.firstChild);
                while (child.nextSibling) right.append(child.nextSibling);
                const content = keepWrapper ? parent.cloneNode(false) : child;
                if (keepWrapper) content.append(child);
                parent.replaceWith(...(left.hasChildNodes() ? [left] : []), content, ...(right.hasChildNodes() ? [right] : []));
                return content;
            };
            while (middle.parentNode !== ancestor) middle = partition(middle.parentNode, middle, true);
            partition(ancestor, middle, false);
            ancestor = closest(node, selector);
        }
    };
    const mark = (tag, attrs = {}) => {
        const range = restore();
        if (range.collapsed) return false;
        const nodes = selectedTextNodes(range);
        if (!nodes.length) return false;
        const selector = tag === 'strong' ? 'strong,b' : tag === 'em' ? 'em,i' : tag;
        const remove = tag !== 'a' && nodes.every(node => closest(node, selector));
        for (const node of nodes) {
            if (remove || tag === 'a') removeMarkFromText(node, selector);
            if (!remove && !closest(node, selector)) {
                const wrapper = document.createElement(tag);
                Object.entries(attrs).forEach(([key, value]) => wrapper.setAttribute(key, value));
                node.replaceWith(wrapper);
                wrapper.append(node);
            }
        }
        const selection = document.createRange();
        selection.setStart(nodes[0], 0);
        selection.setEnd(nodes.at(-1), nodes.at(-1).length);
        selectRange(selection);
        checkpoint();
        return true;
    };
    const blocks = range => {
        const found = [...host.querySelectorAll('p,h2,div,li')].filter(element => range.collapsed
            ? element.contains(range.startContainer)
            : range.intersectsNode(element));
        return found.filter(element => !found.some(other => other !== element && element.contains(other)));
    };
    const placeCursor = element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selectRange(range);
    };
    const command = (action, value) => {
        if (action === 'bold') return mark('strong');
        if (action === 'italic') return mark('em');
        if (action === 'link') return mark('a', { href: value });
        if (action === 'undo' || action === 'redo') {
            cursor = Math.max(0, Math.min(history.length - 1, cursor + (action === 'undo' ? -1 : 1)));
            host.innerHTML = history[cursor];
            savedRange = null;
            placeCursor(host);
            onChange();
            return true;
        }
        const range = restore();
        let selected = blocks(range);
        if (!selected.length) {
            const paragraph = document.createElement('p');
            paragraph.append(...host.childNodes);
            host.append(paragraph);
            selected = [paragraph];
        }
        if (action === 'heading') {
            const tag = selected.every(element => element.tagName === 'H2') ? 'p' : 'h2';
            selected = selected.map(element => {
                if (element.tagName === 'LI') {
                    const existing = element.querySelector(':scope > h2');
                    if (existing) { unwrap(existing); return element; }
                    const heading = document.createElement('h2');
                    heading.append(...element.childNodes);
                    element.append(heading);
                    return heading;
                }
                const replacement = document.createElement(tag);
                replacement.append(...element.childNodes);
                element.replaceWith(replacement);
                return replacement;
            });
        } else if (action === 'bulletList' || action === 'orderedList') {
            const tag = action === 'bulletList' ? 'UL' : 'OL';
            const parents = [...new Set(selected.map(element => closest(element, 'ul,ol')).filter(Boolean))];
            if (parents.length) {
                // List operations apply to the whole containing list in this basic editor.
                parents.forEach(list => {
                    if (list.tagName === tag) {
                        list.replaceWith(...[...list.children].map(item => {
                            const paragraph = document.createElement('p');
                            paragraph.append(...item.childNodes);
                            return paragraph;
                        }));
                    } else {
                        const replacement = document.createElement(tag);
                        replacement.append(...list.childNodes);
                        list.replaceWith(replacement);
                    }
                });
                selected = [host];
            } else {
                const list = document.createElement(tag);
                selected[0].before(list);
                selected.forEach(element => {
                    const item = document.createElement('li');
                    item.append(...element.childNodes);
                    list.append(item);
                    element.remove();
                });
                selected = [list];
            }
        }
        placeCursor(selected.at(-1));
        checkpoint();
        return true;
    };
    const insertText = text => {
        const range = restore();
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        const lines = text.replace(/\r\n?/g, '\n').split('\n');
        lines.forEach((line, index) => {
            if (index) fragment.append(document.createElement('br'));
            fragment.append(document.createTextNode(line));
        });
        const last = fragment.lastChild;
        range.insertNode(fragment);
        range.setStartAfter(last);
        range.collapse(true);
        selectRange(range);
        checkpoint();
    };
    listen(document, 'selectionchange', () => {
        const range = currentRange();
        if (range) savedRange = range.cloneRange();
    });
    listen(host, 'input', () => { if (!composing) checkpoint(); });
    listen(host, 'compositionstart', () => { composing = true; });
    listen(host, 'compositionend', () => { composing = false; checkpoint(); });
    listen(host, 'beforeinput', event => {
        if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
            event.preventDefault();
            command(event.inputType === 'historyUndo' ? 'undo' : 'redo');
        }
    });
    listen(host, 'keydown', event => {
        if (!(event.metaKey || event.ctrlKey) || event.isComposing) return;
        const key = event.key.toLowerCase();
        const action = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' ? 'redo' : null;
        if (action) { event.preventDefault(); command(action); }
    });
    return {
        getHTML: () => host.innerHTML,
        getText: () => host.textContent,
        setHTML(html) {
            host.innerHTML = html;
            savedRange = null;
            history = [html];
            cursor = 0;
        },
        command,
        insertText,
        focus: () => host.focus(),
        selectFirstWord() {
            const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
            const node = walker.nextNode();
            const range = document.createRange();
            range.setStart(node, 0);
            range.setEnd(node, Math.min(9, node.length));
            selectRange(range);
        },
        destroy() { handlers.forEach(remove => remove()); host.innerHTML = ''; host.removeAttribute('contenteditable'); },
    };
}
