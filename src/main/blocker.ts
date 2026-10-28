import { FiltersEngine, Request } from '@ghostery/adblocker';
import type { Session } from 'electron';
import type { Settings } from '../shared/model';
import { hostname } from '../shared/navigation';
export function shouldFilter(settings: Settings, source: string, type: string) {
  return settings.blocker && type !== 'mainFrame' && !settings.siteExceptions.includes(hostname(source));
}
export class Blocker {
  readonly engine: FiltersEngine;
  count = 0;
  constructor(rules: string, session: Session, settings: () => Settings, source: (id: number) => string) {
    this.engine = FiltersEngine.parse(rules, { loadCosmeticFilters: false });
    session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, done) => {
      const origin = source(d.webContentsId ?? -1) || d.referrer;
      const types: Record<string, string> = { subFrame: 'sub_frame', xhr: 'xmlhttprequest', mainFrame: 'main_frame' };
      const cancel = shouldFilter(settings(), origin, d.resourceType) && this.engine.match(Request.fromRawDetails({ url: d.url, sourceUrl: origin, type: (types[d.resourceType] || d.resourceType) as any })).match;
      if (cancel) this.count++;
      done({ cancel });
    });
  }
}
