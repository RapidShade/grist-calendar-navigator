# Grist Calendar Navigator

A custom Grist widget that displays events in a calendar and allows navigation to other pages on double-click.

## How to Use

1. Upload `index.html` to a GitHub repository (e.g. `grist-calendar-navigator`).
2. Enable GitHub Pages: go to Repo → Settings → Pages → set Source to `main`, root.
3. Copy the public URL (e.g. `https://yourusername.github.io/grist-calendar-navigator/`).
4. In Grist, add a **Custom Widget**, and paste the URL.

## Widget Options

```json
{
  "targetPages": ["Overview ΕΣΟΔΑ", "Overview ΕΞΟΔΑ"],
  "idField": "id"
}
```

- `targetPages`: List of Grist pages to allow jumping to
- `idField`: Field used to identify the record (default is `"id"`)

## Features

- FullCalendar interface
- Click an event to jump to another page
- Record is selected in the master view
