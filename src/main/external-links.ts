import { webURL } from '../shared/navigation';
// OS URL events are untrusted input. Never turn an arbitrary protocol into a search.
export function externalWebURL(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\x7f]/.test(value)) return null;
  return webURL(value);
}
