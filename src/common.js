import DOMPurify from 'dompurify';

export const SAMPLE = '<h2>A quick update for your team</h2><p>We’re making a few improvements to Connect this weekend. Here’s what you need to know.</p><ul><li>Maintenance begins at <strong>8:00 PM on Saturday</strong>.</li><li>Please save your work before signing out.</li><li>Normal service resumes on Sunday morning.</li></ul><p>Questions? <a href="https://example.com/support">Contact the support team</a>.</p><p>Thanks for your patience.</p>';
export const SIZES = { short: 6, medium: 60, long: 300 };
export const RUNS = 15;
export const WARMUPS = 3;
export const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
export const bytes = value => new TextEncoder().encode(value).length;
export const formatMs = value => Number.isFinite(value) ? `${value.toFixed(2)} ms` : '—';
export function fixture(size) {
    const paragraph = '<p>Connect alert: please <strong>save your work</strong> before the scheduled maintenance window. Read the <a href="https://example.com/status">status page</a> for updates. Thank you for your patience.</p>';
    return '<h2>Scheduled maintenance</h2>' + paragraph.repeat(SIZES[size] ?? SIZES.short);
}
export function sanitize(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'h2', 'ul', 'ol', 'li', 'a'],
        ALLOWED_ATTR: ['href', 'title'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        FORBID_CONTENTS: ['script', 'style', 'iframe', 'svg', 'math'],
    });
}
export function safeURL(value) {
    try {
        const parsed = new URL(value);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
    } catch { return null; }
}
export function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return {
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.ceil(sorted.length * .95) - 1],
        count: sorted.length,
    };
}
export function remember(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
}
export function recall(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
}
