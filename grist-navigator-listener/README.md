# Grist Navigator Listener

A custom listener widget that navigates to a table row via `#grist-navigate:Table:RowId` hash.

### Setup
1. Upload this folder to a static host (GitHub Pages, Netlify, etc.).
2. Add it as a custom widget using the URL to `index.html`.
3. On page load, it parses the `#grist-navigate:` URL fragment and sets the cursor.

### Manifest
This uses the official `external.jsonc` manifest (not `grist-plugin.json`).
