# forge-pulse · Optional Rust accelerator

A tiny single-file Rust binary that reads PTY chunks on stdin and writes prompt /
activity events on stdout. The AgentForge Node server spawns it automatically if
it finds the binary; the native JS auto-enter path stays in charge so the
sidecar is **purely advisory** — never required.

## Why Rust here, and not the rest of the stack?

The UI is browser-driven, the server is I/O-bound. Most of the runtime spends
its time waiting on network and PTY events, which Node handles fine.

The one place that benefits from a tighter, isolated process is the hot path
that watches every byte coming out of every PTY for permission prompts and
activity changes. As we scale up to dozens of specialists with real LLMs
behind them, this loop will get hotter. Putting it in a small Rust binary
gives us:

- **Crash isolation** — if the matcher hits a bad path, only the sidecar dies,
  the server keeps running and respawns it.
- **Headroom** — once we have more sophisticated detection (token streaming,
  diff-aware logs, multi-line context), Rust keeps it cheap.
- **A clean export point** — the same protocol could run on a remote VM later.

It is intentionally not the only path: the Node side keeps a JS implementation
of the matcher, and the server will run without the binary just fine.

## Build

```bash
cd tools/forge-pulse
cargo build --release
```

The Node server (`gui/server.js`) auto-detects the binary at:

- `tools/forge-pulse/target/release/forge-pulse`
- `tools/forge-pulse/target/debug/forge-pulse`

Set `FORGE_PULSE=0` in the environment to disable the sidecar even when it is
present.

## Protocol

Stdin — one JSON object per line:

```json
{"id":"sentinel","d":"continue? (y/n) "}
```

Stdout — one JSON event per detection:

```json
{"t":"prompt","id":"sentinel","reason":"(y/n)","kind":"permission"}
{"t":"activity","id":"sentinel","kind":"working","reason":"chunk"}
```

`stderr` is reserved for human-readable diagnostics.

## Why not depend on `serde` and `regex`?

For a hot loop this small the extra MB of binary and the cargo audit surface
isn't worth it. The matcher is literal-substring search on a 2KB rolling tail —
plenty fast for the volumes a PTY produces.
