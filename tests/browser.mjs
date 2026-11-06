import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.DEMO_URL ? process.env.DEMO_URL.replace(/\/$/, '') + '/' : pathToFileURL(resolve('.') + '/').href;
const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--allow-file-access-from-files'],
});
const results = [];
const errors = [];
try {
    await mkdir('test-results', { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + 'index.html');
    await page.evaluate(() => localStorage.clear());

    for (const kind of ['alpine', 'tiptap']) {
        await page.goto(base + `${kind}.html`);
        await page.waitForFunction(() => window.DEMO_READY === true);
        const initial = await page.evaluate(() => window.DEMO.getHTML());
        assert(initial.includes('A quick update'), `${kind}: sample loaded`);

        // Removing an outer mark must preserve nested italic and all selected text.
        await page.evaluate(() => {
            window.DEMO.setHTML('<p><strong>bold <em>italic</em> tail</strong></p>');
            const strong = document.querySelector('[contenteditable=true] strong');
            const range = document.createRange();
            range.selectNodeContents(strong);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
            document.dispatchEvent(new Event('selectionchange'));
        });
        await page.getByRole('button', { name: 'Bold', exact: true }).click();
        assert.equal(await page.evaluate(() => window.DEMO.getHTML()), '<p>bold <em>italic</em> tail</p>', `${kind}: remove nested bold, retain italic`);
        await page.evaluate(html => window.DEMO.setHTML(html), initial);

        // Select an actual word, format it through the shared toolbar, and undo/redo.
        await page.evaluate(() => window.DEMO.selectFirstWord());
        await page.getByRole('button', { name: 'Bold', exact: true }).click();
        assert.match(await page.evaluate(() => window.DEMO.getHTML()), /<strong>A quick u/);
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        assert.equal(await page.evaluate(() => window.DEMO.getHTML()), initial, `${kind}: undo`);
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        assert.match(await page.evaluate(() => window.DEMO.getHTML()), /<strong>A quick u/);

        // A real keyboard edit and plain-text paste go through the editing surface.
        const surface = page.locator('[contenteditable="true"]').first();
        await surface.click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.type(' Browser typing works.');
        assert((await page.evaluate(() => window.DEMO.getHTML())).includes('Browser typing works.'));
        await surface.evaluate(element => {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', ' Plain pasted text.');
            clipboardData.setData('text/html', '<img src=x onerror="window.__unsafe=true"><b>Formatted paste</b>');
            element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
        });
        const pasted = await page.evaluate(() => window.DEMO.getHTML());
        assert(pasted.includes('Plain pasted text.'), `${kind}: plain-text paste`);
        assert(!pasted.includes('<img'), `${kind}: discarded rich paste`);

        // Dialog focus must not lose the editor selection; reject unsafe schemes.
        await page.evaluate(() => window.DEMO.selectFirstWord());
        await page.getByRole('button', { name: 'Add link', exact: true }).click();
        await page.getByLabel('Website or email address').fill('javascript:alert(1)');
        await page.getByRole('button', { name: 'Add link', exact: true }).last().click();
        await page.getByRole('alert').filter({ hasText: 'Use an https://' }).waitFor();
        await page.getByLabel('Website or email address').fill('https://example.com/test');
        await page.getByRole('button', { name: 'Add link', exact: true }).last().click();
        assert((await page.evaluate(() => window.DEMO.getHTML())).includes('https://example.com/test'), `${kind}: link retained selection`);

        // Preview/save use sanitation even if raw custom editor DOM is tampered with.
        await page.evaluate(() => window.DEMO.setHTML('<h2>Safe heading</h2><p>Safe <strong>body</strong><img src=x onerror="window.__unsafe=true"><a href="javascript:alert(1)">bad link</a><script>window.__unsafe=true</script></p>'));
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        const preview = page.locator('.preview-panel .editor-content');
        await preview.waitFor();
        const safe = await preview.innerHTML();
        assert(!/script|onerror|<img|javascript:/i.test(safe), `${kind}: sanitized preview`);
        assert(safe.includes('<strong>body</strong>'));
        await page.getByRole('button', { name: 'Save draft' }).click();
        await page.getByRole('status').filter({ hasText: 'Draft saved in this browser.' }).waitFor();
        await page.reload();
        await page.waitForFunction(() => window.DEMO_READY);
        assert((await page.evaluate(() => window.DEMO.getHTML())).includes('Safe heading'), `${kind}: draft restored`);

        // Verify malicious legacy saved drafts are sanitized on initialization.
        await page.evaluate(kind => localStorage.setItem(`type-html:draft:${kind}`, JSON.stringify({ html: '<p>restored<script>window.__unsafe=true</script><a href="javascript:alert(1)" onclick="alert(1)">link</a></p>' })), kind);
        await page.reload();
        await page.waitForFunction(() => window.DEMO_READY);
        assert(!/script|onclick|javascript:/i.test(await page.evaluate(() => window.DEMO.getHTML())), `${kind}: sanitized restore`);
        assert.equal(await page.evaluate(() => !!window.__unsafe), false);

        const before = await page.evaluate(() => window.DEMO.getHTML());
        await page.getByRole('button', { name: 'Run benchmark' }).click();
        await page.waitForFunction(() => window.DEMO.getReport() !== null);
        const report = await page.evaluate(() => JSON.parse(JSON.stringify(window.DEMO.getReport())));
        assert.equal(report.iterations, 15);
        assert.equal(report.warmups, 3);
        assert(report.inputBytes > 1000);
        assert.equal(report.metrics.format.count, 15);
        assert.equal(await page.evaluate(() => window.DEMO.getHTML()), before, `${kind}: benchmark preserves draft`);
        results.push(report);
        await page.screenshot({ path: `test-results/${kind}.png`, fullPage: true });

        // Exercise the larger workload too, including cleanup between repeated runs.
        await page.getByLabel('Sample alert').selectOption('long');
        await page.getByRole('button', { name: 'Run benchmark' }).click();
        await page.waitForFunction(() => window.DEMO.getReport()?.size === 'long', null, { timeout: 45000 });
        assert.equal(await page.locator('.benchmark-sandbox').count(), 0);
    }
    await page.goto(base + 'index.html');
    await page.getByRole('button', { name: /Run comparison/i }).click();
    await page.waitForFunction(() => {
        const a = JSON.parse(localStorage.getItem('type-html:report:alpine'));
        const b = JSON.parse(localStorage.getItem('type-html:report:tiptap'));
        return a?.size === 'short' && b?.size === 'short';
    }, null, { timeout: 45000 });
    await page.waitForFunction(() => !document.querySelector('#run-comparison').disabled);
    await page.screenshot({ path: 'test-results/comparison.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of ['index', 'alpine', 'tiptap']) {
        await page.goto(base + `${name}.html`);
        if (name !== 'index') await page.waitForFunction(() => window.DEMO_READY);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no mobile overflow`);
    }
    assert.deepEqual(errors, [], 'no JavaScript exceptions');
    await writeFile('test-results/benchmarks.json', JSON.stringify(results, null, 2));
    console.log('Passed: both editors, format/undo/redo, typing, paste, links, sanitizer, browser drafts, benchmarks, comparison, mobile layout.');
    console.log(JSON.stringify(results.map(report => ({ kind: report.kind, size: report.size, metrics: report.metrics })), null, 2));
} finally {
    await browser.close();
}
