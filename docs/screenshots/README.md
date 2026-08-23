# Safe screenshot page

Serve this directory over localhost so Firefox or Zen treats the fixture as an eligible HTTP page:

```powershell
python -m http.server 4173 --directory docs/screenshots
```

Then open <http://localhost:4173/safe-demo-page.html>. Wait for the extension badge to show detected links and open the toolbar popup.

The seven destinations are intentionally invalid. They use neutral filenames, and the page cancels clicks so it cannot navigate to them. Use the fixture for discovery and selection screenshots only; do not send its links to TorBox.
