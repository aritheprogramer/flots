export function webURL(input: string): string | null {
  try { const u = new URL(input); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function navigateInput(input: string): string {
  const text = input.trim().slice(0, 8192);
  if (!text) return '';
  const direct = webURL(text);
  if (direct) return direct;
  const hostLike = /^(localhost|\[[\da-f:]+\]|[^\s/:]+\.[^\s/:]+)(:\d+)?([/?#].*)?$/i.test(text) || /^localhost:\d+/.test(text);
  if (hostLike) { const u = webURL(`${/^localhost([:/]|$)/.test(text) ? 'http' : 'https'}://${text}`); if (u) return u; }
  if (/^[a-z][a-z\d+.-]*:/i.test(text)) throw new Error('Only HTTP and HTTPS addresses can be opened.');
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}
export function hostname(url: string): string { try { return new URL(url).hostname; } catch { return ''; } }
export function faviconURL(url: unknown): string | undefined {
  return typeof url === 'string' && url.length <= 8192 && webURL(url) ? url : undefined;
}
