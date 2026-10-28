export const accents = { graphite: '#656f86', blue: '#6688bb', purple: '#9f83c6', rose: '#ce8199', terracotta: '#cb8269', sage: '#7fa58f' } as const;
export type Accent = 'system' | keyof typeof accents | 'custom';
export const validHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function mix(a: string, b: string, amount: number) { const c = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (c[i] - v) * amount).toString(16).padStart(2, '0')).join(''); }
function luminance(hex: string) { return rgb(hex).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0); }
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function accessibleAccent(color: string, background: string, minimum = 4.5) {
  const end = contrast('#ffffff', background) > contrast('#000000', background) ? '#ffffff' : '#000000';
  for (let i = 0; i <= 100; i++) { const c = mix(color, end, i / 100); if (contrast(c, background) >= minimum) return c; }
  return end;
}
export function accentTokens(color: string, dark: boolean) {
  const surface = dark ? '#171a20' : '#ffffff'; const selected = mix(surface, color, dark ? .23 : .12);
  return { raw: color, action: accessibleAccent(color, surface), focus: accessibleAccent(color, dark ? '#30343d' : '#e9edf3', 3), selected, selectedText: accessibleAccent(color, selected), onAccent: contrast(color, '#fffFFF') >= 4.5 ? '#ffffff' : '#171a20' };
}
