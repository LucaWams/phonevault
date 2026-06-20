# Phone Vault PWA

A simple offline-capable Progressive Web App for tracking phone-in-vault sessions.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`
- `icons/`

## How it works

The app stores everything locally on the device using browser `localStorage`.

When you tap **Phone In**, it saves the start time.  
When you tap **Phone Out**, it calculates the elapsed time and logs the session.

The timer does not need to keep running in the background. If the phone locks, the app recalculates the elapsed time when you open it again.

## Local test on Windows

Open this folder in VS Code and use a simple local server, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Hosting on GitHub Pages

1. Create a GitHub account if you do not have one.
2. Create a new repository called `phone-vault`.
3. Upload all files in this folder.
4. Go to repository Settings → Pages.
5. Under "Build and deployment", choose:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /root
6. Save.
7. Open the GitHub Pages link on your iPhone in Safari.
8. Tap Share → Add to Home Screen.

After the app has loaded once, it should work offline.
