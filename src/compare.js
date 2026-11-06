const kinds = ['alpine', 'tiptap'];
const labels = { alpine: 'Alpine custom', tiptap: 'Tiptap' };
const rows = [
    ['setup', 'Set up editor'], ['load', 'Load HTML + layout'],
    ['format', 'Format selection + layout'], ['serialize', 'Read HTML'],
    ['preview', 'Sanitize + preview + layout'], ['save', 'Sanitize + save browser draft'],
];
const button = document.getElementById('run-comparison');
const status = document.getElementById('comparison-status');
const body = document.getElementById('comparison-body');
const reports = {};
let running = false;
let reverseNext = false;
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The in-memory comparison still works. */ } };
function refresh() {
    for (const kind of kinds) reports[kind] = read(`type-html:report:${kind}`) ?? reports[kind];
    render();
}
function addCell(row, text, tooltip) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (tooltip) cell.title = tooltip;
    row.append(cell);
}
function render() {
    body.replaceChildren();
    for (const [key, label] of rows) {
        const row = document.createElement('tr');
        const heading = document.createElement('th');
        heading.scope = 'row'; heading.textContent = label; row.append(heading);
        for (const kind of kinds) {
            const metric = reports[kind]?.metrics?.[key];
            const valid = metric && Number.isFinite(metric.median);
            addCell(row, valid ? `${metric.median.toFixed(2)} ms` : '—', valid ? `95th percentile: ${metric.p95.toFixed(2)} ms · ${metric.count} measurements` : undefined);
        }
        body.append(row);
    }
    const bundleRow = document.createElement('tr');
    bundleRow.className = 'bundle-row';
    const bundleLabel = document.createElement('th');
    bundleLabel.scope = 'row'; bundleLabel.textContent = 'JavaScript download';
    const detail = document.createElement('small'); detail.textContent = 'GZIP / ALL PAGE DEPENDENCIES'; bundleLabel.append(detail); bundleRow.append(bundleLabel);
    for (const kind of kinds) {
        const bytes = reports[kind]?.bundle?.gzipBytes;
        addCell(bundleRow, Number.isFinite(bytes) ? `${(bytes / 1024).toFixed(1)} KiB` : '—');
    }
    body.append(bundleRow);
    if (!running) {
        const present = kinds.filter(kind => reports[kind]);
        if (!present.length) return;
        if (present.length === 1) { status.textContent = `${labels[present[0]]} has measurements. Run the comparison to measure both.`; return; }
        const a = reports.alpine;
        const b = reports.tiptap;
        if (a.size !== b.size || a.inputBytes !== b.inputBytes || a.iterations !== b.iterations) {
            status.textContent = 'These saved runs use different settings. Run comparison for matching measurements.';
        } else {
            status.textContent = `Latest saved runs: ${a.size} fixture · ${a.inputBytes.toLocaleString()} input bytes · ${a.iterations} measurements per operation. Run again to refresh both together.`;
        }
    }
}
function runPage(kind) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.className = 'benchmark-frame';
        iframe.title = `${labels[kind]} automatic benchmark`;
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        let timeout;
        const cleanup = () => { clearTimeout(timeout); window.removeEventListener('message', receive); iframe.remove(); };
        const receive = event => {
            if (event.source !== iframe.contentWindow) return;
            if (location.protocol === 'file:' ? event.origin !== 'null' : event.origin !== location.origin) return;
            if (event.data?.type !== 'type-html:benchmark' || event.data.kind !== kind || event.data.report?.kind !== kind) return;
            const report = event.data.report;
            if (!report.metrics || !Number.isFinite(report.inputBytes)) return;
            cleanup(); resolve(report);
        };
        window.addEventListener('message', receive);
        timeout = setTimeout(() => { cleanup(); reject(new Error(`${labels[kind]} did not finish within 45 seconds. Open its editor page to retry.`)); }, 45000);
        iframe.src = `${kind}.html?benchmark=1`;
        document.body.append(iframe);
    });
}
button.addEventListener('click', async () => {
    if (running) return;
    running = true; button.disabled = true; button.textContent = 'Measuring…';
    const reverse = read('type-html:reverse-order') ?? reverseNext;
    reverseNext = !reverse;
    write('type-html:reverse-order', reverseNext);
    const order = reverse ? [...kinds].reverse() : kinds;
    try {
        for (const kind of order) {
            status.textContent = `Measuring ${labels[kind]}… 3 warmups, then 15 runs.`;
            reports[kind] = await runPage(kind);
            write(`type-html:report:${kind}`, reports[kind]);
            render();
        }
        running = false;
        render();
        status.textContent = `Comparison complete · same short fixture · 15 runs after 3 warmups · ${labels[order[0]]} ran first. Timings are specific to this browser and machine.`;
    } catch (error) {
        status.textContent = error.message;
    } finally {
        running = false; button.disabled = false; button.textContent = 'Run comparison →';
    }
});
window.addEventListener('storage', () => { if (!running) refresh(); });
refresh();
