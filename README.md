# Grist Calendar Navigator

A custom Grist widget that displays events in a calendar and allows navigation to other pages on double-click.

## How to Use

In Grist, add a **Custom Widget**, and paste the URL: https://rapidshade.github.io/grist-calendar-navigator/

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
