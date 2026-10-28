import { dialog, type BrowserWindow, type Session, type WebContents } from 'electron';

// Keep WebAuthn inside Chromium. Never inject a credentials polyfill into sites
// or export secrets. iCloud browser authorization requires an Apple-approved,
// signed integration; configureWebAuthn({platformPasskeys:true}) alone cannot
// grant an unsigned browser access to arbitrary relying parties.
export function configureWebAuthnAccounts(session: Session, win: BrowserWindow, active: () => WebContents | undefined) {
  let busy = false;
  // The named handler is removed when the window closes, preventing duplicate
  // sheets if the macOS application reopens its window without quitting.
  const select = async (_event: Electron.Event, details: Electron.SelectWebauthnAccountDetails, callback: (credentialId?: string | null) => void) => {
    let selected: string | undefined;
    const owner = active(); const frame = details.frame; const url = frame?.url;
    const valid = () => {
      try { return !!owner && !owner.isDestroyed() && !win.isDestroyed() && active() === owner && owner.mainFrame === frame && frame.url === url && new URL(frame.url).protocol === 'https:'; }
      catch { return false; }
    };
    if (busy || !valid() || !details.accounts.length) { callback(); return; }
    busy = true;
    try {
      const accounts = details.accounts;
      const result = await dialog.showMessageBox(win, {
        type: 'question', message: `Sign in to ${details.relyingPartyId}`,
        detail: `Choose an account for ${new URL(url!).origin}.`,
        buttons: ['Cancel', ...accounts.map((a, i) => (a.name || a.displayName || `Account ${i + 1}`).slice(0, 160))],
        defaultId: 0, cancelId: 0, noLink: true
      });
      if (valid() && result.response > 0) selected = accounts[result.response - 1]?.credentialId;
    } catch { /* A closed/navigated window cancels the outstanding request. */ }
    finally { busy = false; callback(selected); }
  };
  session.on('select-webauthn-account', select);
  return () => session.removeListener('select-webauthn-account', select);
}
