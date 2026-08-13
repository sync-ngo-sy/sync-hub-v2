---
name: design-gallery
description: Spin up the local design gallery to browse every candidate-portal design idea in prototype/ — switching ideas, screens, light/dark and viewport width in one place. Use when the user wants to see, review, compare or navigate the design prototypes, or asks to "show me the designs", "open the gallery", "run the prototype", or to compare two design ideas.
---

# Design gallery

Serves every design idea in `prototype/` from one navigable page.

## Run it

```bash
python3 prototype/serve.py --port 4321
```

Runs in the foreground and prints the address plus every idea it found. Start it in the
background so the session is not blocked, then give the user the URL:
**<http://127.0.0.1:4321/>**

Pass `--open` to open a browser as well. If the port is taken, pick another with `--port`.

## What the user gets

One toolbar over a live frame:

- **Idea** — every sub-folder of `prototype/` that contains `.html` pages
- **Screen** — every page in the chosen idea, named from its `<title>`; `←` `→` also step through
- **Theme** — light or dark, passed to the page as `?theme=`
- **Width** — 1440 / 1280 / 834 / 390, scaled to fit the window, with the true size read out

The URL carries the full state (`?idea=…&page=…&w=…&theme=…`), so any particular screen can be
linked or reloaded.

## Adding an idea

Create a sibling folder under `prototype/` with at least one `.html` page. Nothing is registered
by hand — the server rescans on every load of `/`, so a new idea appears on refresh.

Give it a `README.md` whose first `#` heading names the idea; that heading becomes its label in
the picker. A folder's `index.html` is treated as that idea's own shell and is hidden from the
screen list.

## Notes

- Standard library only. No install, no build step, no dependencies.
- Serves on `127.0.0.1` only.
- `prototype/` is throwaway design work and is excluded from Biome; it is never imported by any
  app, so nothing here affects a build.
