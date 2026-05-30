# Demo assets — how to record the walkthrough

> We don't commit a fake/placeholder cast. Record the real thing with the steps
> below, then paste the link into the README's **Try it** section.

The demo runs entirely in **test-harness mode** — no API key, deterministic,
nothing leaves the machine.

> **Tip:** `scripts/record-demo.sh` boots the server in harness mode with the
> right flags — both recording options below can delegate setup to it.

## What to show (15–30s)

1. `npm install && npm start` → server boots, prints the session token + URL.
2. Open `http://localhost:4173` → cockpit loads, Atlas Prime centre stage,
   **TEST HARNESS** badge visible.
3. In the broadcast bar, type a goal, e.g. *"run a swarm check across sentinel and aurora"*, press Enter.
4. Atlas streams his answer; the workflow stepper runs; the Dispatch panel names
   each specialist (honestly flagged — no fake "work").
5. Open a specialist drawer to show details.

## Option A — asciinema (best for a technical audience)

```bash
# Let the helper boot the server in harness mode (consistent setup):
asciinema rec docs/demo/agentforge.cast --idle-time-limit=2 \
  --title "AgentForge Command — harness walkthrough" \
  --command "bash scripts/record-demo.sh"
# Then drive the cockpit in the browser; Ctrl-C stops the server and recording.
```

Upload + get a shareable link:

```bash
asciinema upload docs/demo/agentforge.cast    # prints https://asciinema.org/a/XXXXX
```

Then in the README replace the placeholder with:

```markdown
[![AgentForge demo](https://asciinema.org/a/XXXXX.svg)](https://asciinema.org/a/XXXXX)
```

## Option B — screen-capture → GIF (best for Reddit/X)

```bash
# Record the browser window however you like (e.g. macOS screenshot.app,
# OBS, or wf-recorder on Linux) to screen.mp4, then:
ffmpeg -i screen.mp4 -vf "fps=12,scale=1280:-1:flags=lanczos" -loop 0 docs/demo/demo.gif
```

Commit `docs/demo/demo.gif` and reference it: `![AgentForge demo](docs/demo/demo.gif)`.

## Helper

`scripts/record-demo.sh` boots the server in harness mode with sensible flags so
you can focus on the browser interaction.
