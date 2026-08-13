#!/usr/bin/env python3
"""Serve every design idea in this folder from one navigable gallery.

    python3 prototype/serve.py [--port 4321]

Ideas are discovered by scanning for sub-folders, and pages by scanning each folder for
*.html. Nothing is registered by hand, so a new idea only has to exist to show up.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import re
import socketserver
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHELL_FILES = {"index.html", "gallery.html"}
TITLE = re.compile(r"<title>(.*?)</title>", re.I | re.S)


def page_title(html_path: Path) -> str:
    try:
        head = html_path.read_text(encoding="utf-8", errors="ignore")[:4096]
    except OSError:
        return html_path.stem
    found = TITLE.search(head)
    if not found:
        return html_path.stem.replace("-", " ").title()
    # "Your profile — sync" -> "Your profile"
    return re.split(r"\s[—|]\s", found.group(1).strip())[0].strip()


def idea_title(folder: Path) -> str:
    readme = folder / "README.md"
    if readme.exists():
        for line in readme.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    return folder.name.replace("-", " ").title()


def scan() -> list[dict]:
    ideas = []
    for folder in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")):
        pages = [
            {"file": f"{folder.name}/{p.name}", "name": page_title(p)}
            for p in sorted(folder.glob("*.html"))
            if p.name not in SHELL_FILES
        ]
        if pages:
            ideas.append({"slug": folder.name, "title": idea_title(folder), "pages": pages})
    return ideas


GALLERY = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design ideas</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #16181c; color: #f2f3f5; min-height: 100vh;
    font-family: ui-sans-serif, system-ui, sans-serif; display: flex; flex-direction: column;
  }
  .stage { flex: 1; padding: 20px 16px 108px; display: flex; justify-content: center;
    align-items: flex-start; overflow: auto; }
  .shell { background: #fff; border-radius: 10px; overflow: hidden; flex: none;
    box-shadow: 0 18px 60px rgb(0 0 0 / .5); transform-origin: top center; }
  iframe { display: block; border: 0; width: 100%; height: 100%; }
  .bar { position: fixed; inset: auto 0 0 0; background: #101114; border-top: 1px solid #2c2f36;
    display: flex; align-items: center; gap: 22px; padding: 10px 16px; flex-wrap: wrap; }
  .grp { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .lbl { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .14em;
    text-transform: uppercase; color: #8b909a; }
  select, .seg button {
    background: #1b1d22; color: #f2f3f5; border: 1px solid #2c2f36; border-radius: 7px;
    padding: 6px 10px; font: inherit; font-size: 12.5px; cursor: pointer; max-width: 260px;
  }
  .seg { display: flex; border: 1px solid #2c2f36; border-radius: 7px; overflow: hidden; }
  .seg button { border: 0; border-left: 1px solid #2c2f36; border-radius: 0;
    font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #8b909a; }
  .seg button:first-child { border-left: 0; }
  .seg button[aria-pressed="true"] { background: #f2f3f5; color: #101114; font-weight: 600; }
  .meta { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: #8b909a;
    margin-left: auto; }
  .empty { margin: 60px auto; max-width: 46ch; color: #b9bec7; line-height: 1.6; }
  :focus-visible { outline: 2px solid #6ea8ff; outline-offset: 2px; }
</style>
</head>
<body>
<div class="stage" id="stage">
  <div class="shell" id="shell"><iframe id="frame" title="Design preview"></iframe></div>
</div>

<div class="bar">
  <span class="grp"><span class="lbl">Idea</span><select id="idea"></select></span>
  <span class="grp"><span class="lbl">Screen</span><select id="page"></select></span>
  <span class="grp"><span class="lbl">Theme</span>
    <span class="seg" id="theme">
      <button data-t="light">Light</button><button data-t="dark">Dark</button>
    </span>
  </span>
  <span class="grp"><span class="lbl">Width</span>
    <span class="seg" id="widths">
      <button data-w="1440">1440</button><button data-w="1280">1280</button>
      <button data-w="834">834</button><button data-w="390">390</button>
    </span>
  </span>
  <span class="meta" id="readout"></span>
</div>

<script>
const IDEAS = __IDEAS__;
const HEIGHTS = { 1440: 900, 1280: 900, 834: 1040, 390: 880 };
const q = new URLSearchParams(location.search);
let ii = Math.max(0, IDEAS.findIndex(i => i.slug === q.get('idea')));
let pi = 0, w = Number(q.get('w')) || 1280, theme = q.get('theme') || 'light';

const $ = id => document.getElementById(id);

if (!IDEAS.length) {
  document.querySelector('.stage').innerHTML =
    '<p class="empty">No ideas found. Each idea is a sub-folder here holding at least one .html page — add one and reload.</p>';
  document.querySelector('.bar').style.display = 'none';
} else {
  const pageFromUrl = q.get('page');
  if (pageFromUrl) {
    const found = IDEAS[ii].pages.findIndex(p => p.file.endsWith('/' + pageFromUrl));
    if (found > -1) pi = found;
  }

  $('idea').innerHTML = IDEAS.map((i, n) => `<option value="${n}">${i.title}</option>`).join('');
  $('idea').onchange = e => { ii = +e.target.value; pi = 0; fillPages(); render(); };
  $('page').onchange = e => { pi = +e.target.value; render(); };
  $('widths').onclick = e => { const b = e.target.closest('button'); if (b) { w = +b.dataset.w; render(); } };
  $('theme').onclick = e => { const b = e.target.closest('button'); if (b) { theme = b.dataset.t; render(); } };
  addEventListener('resize', fit);
  addEventListener('keydown', e => {
    if (e.target.matches('select, input')) return;
    const n = IDEAS[ii].pages.length;
    if (e.key === 'ArrowRight') { pi = (pi + 1) % n; render(); }
    if (e.key === 'ArrowLeft') { pi = (pi - 1 + n) % n; render(); }
  });

  fillPages();
  render();
}

function fillPages() {
  $('page').innerHTML = IDEAS[ii].pages.map((p, n) => `<option value="${n}">${p.name}</option>`).join('');
}

function fit() {
  const avail = $('stage').clientWidth - 32;
  const scale = Math.min(1, avail / w);
  const h = HEIGHTS[w];
  Object.assign($('shell').style, {
    width: w + 'px', height: h + 'px',
    transform: `scale(${scale})`, marginBottom: (h * scale - h) + 'px',
  });
  $('readout').textContent = `${w}×${h} · ${Math.round(scale * 100)}%`;
}

function render() {
  const page = IDEAS[ii].pages[pi];
  const src = `./${page.file}?theme=${theme}`;
  if ($('frame').dataset.src !== src) { $('frame').src = src; $('frame').dataset.src = src; }
  $('idea').value = ii; $('page').value = pi;
  document.querySelectorAll('#widths button').forEach(b =>
    b.setAttribute('aria-pressed', String(+b.dataset.w === w)));
  document.querySelectorAll('#theme button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.t === theme)));
  fit();
  history.replaceState(null, '', '?' + new URLSearchParams({
    idea: IDEAS[ii].slug, page: page.file.split('/').pop(), w, theme,
  }));
}
</script>
</body>
</html>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path.split("?")[0] in ("/", "/index.html"):
            body = GALLERY.replace("__IDEAS__", json.dumps(scan())).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, format, *args):  # noqa: A002 — signature fixed by the base class
        pass


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=4321)
    ap.add_argument("--open", action="store_true", help="open a browser at the gallery")
    args = ap.parse_args()

    ideas = scan()
    handler = functools.partial(Handler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.port), handler) as srv:
        url = f"http://127.0.0.1:{args.port}/"
        print(f"Design gallery: {url}")
        for i in ideas:
            print(f"  - {i['title']}  ({len(i['pages'])} screens)")
        if not ideas:
            print("  (no ideas found — add a sub-folder with .html pages)")
        if args.open:
            webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
