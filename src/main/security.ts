import { dialog, type BrowserWindow, type Session, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { hostname } from '../shared/navigation';
export function trustedSender(event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>, ui: WebContents, url: string): boolean {
  return event.sender === ui && event.senderFrame === ui.mainFrame && event.senderFrame?.url === url;
}
export function configurePermissions(session: Session, win: BrowserWindow, active: () => WebContents | undefined, protect: (id: number) => void) {
  const grants = new Set<string>();
  const tracked = new Set<number>();
  session.setPermissionCheckHandler((wc, permission, origin) => !!wc && wc === active() && grants.has(`${wc.id}:${origin}:${permission}`));
  session.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    const url = details.requestingUrl || wc.getURL();
    let origin: string; try { origin = new URL(url).origin; } catch { callback(false); return; }
    if (wc !== active() || !url.startsWith('https:') || new URL(wc.getURL()).origin !== origin) { callback(false); return; }
    if (permission === 'fullscreen') { callback(true); return; }
    if (!['media', 'geolocation', 'notifications'].includes(permission)) { callback(false); return; }
    const answer = await dialog.showMessageBox(win, { type: 'question', message: `Allow ${hostname(url)} to use ${permission === 'media' ? 'your camera or microphone' : permission}?`, detail: `Requesting origin: ${origin}\nPermission lasts for this running browser session.`, buttons: ['Deny', 'Allow'], defaultId: 0, cancelId: 0 });
    const allowed = answer.response === 1 && !wc.isDestroyed() && wc === active() && new URL(wc.getURL()).origin === origin;
    if (allowed) { if (!tracked.has(wc.id)) { const id = wc.id; tracked.add(id); wc.once('destroyed', () => { tracked.delete(id); for (const key of grants) if (key.startsWith(`${id}:`)) grants.delete(key); }); } grants.add(`${wc.id}:${origin}:${permission}`); if (permission === 'media') protect(wc.id); }
    callback(allowed);
  });
  session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
}
