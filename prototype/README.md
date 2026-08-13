# Design ideas

One folder per idea. Each is a self-contained static prototype — no build, no framework, not
imported by any app.

**Browse them all in one place:**

```bash
python3 prototype/serve.py --port 4321
```

Then open <http://127.0.0.1:4321/> — pick the idea, the screen, light or dark, and a viewport
width, all from one toolbar. The URL carries the state, so any screen can be linked. In Claude
Code, the `design-gallery` skill runs this for you.

| Idea | Direction | State |
| --- | --- | --- |
| [candidate-portal-idea-1](./candidate-portal-idea-1/) | The Verified Instrument — security printing, two inks, generated employer seals | Jobs, one job, applications, profile. No landing page yet. |

Add the next idea as a sibling folder rather than editing an existing one, so the ideas can be
compared side by side later.
