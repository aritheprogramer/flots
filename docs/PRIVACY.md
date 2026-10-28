# Privacy

Flots has no Flots account, telemetry endpoint, analytics SDK or automatic crash-upload service. The browser stores tabs, favorites, history, settings and downloads locally in its application profile. Chromium stores cookies and website storage in the persistent `flots` partition.

On macOS the profile normally lives at `~/Library/Application Support/flots`. Deleting the application alone does not delete it. Do not share this directory: it may contain authenticated sessions and other personal data.

Websites receive normal browser traffic. Searches entered into the address field are sent to Google when they are not web addresses; local history suggestions do not make a remote suggestion request. Site favicons are requested from website-provided URLs. Websites and Google have their own privacy policies. The built-in blocker is a small rule list and does not guarantee anonymity or complete tracking protection.

Camera, microphone, location and notifications are mediated by the browser's permission policy and macOS where applicable. Screen capture is currently denied. There is one shared browsing profile and no private-browsing mode.

GitHub hosts the repository, issues and download files. GitHub's own privacy policy applies when visiting or downloading from GitHub. The application does not check for updates in the background.

This is a technical description of the current implementation, not a promise that websites cannot track you.
