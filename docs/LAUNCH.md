# AgentForge Command v1.0.0 — Launch Sequence

The pre-written posts live in [`docs/launch/`](launch/) (`show-hn.md`,
`reddit-claudeai.md`, `blog-intro.md`). This file is the **timing + checklist**
that wraps them. Honesty first — every claim we post must be backed by
something in the repo (tests, benchmarks, docs).

## T-24h — polish & verify

- [ ] All CI green on `main` (gate ×3 Node, build ×3 OS, e2e, a11y, coverage, audit).
- [ ] Demo asset recorded (`docs/demo/`) and uploaded to asciinema.org; link pasted into README.
- [ ] One-command paths verified from a **fresh clone**: `npm install && npm start` and `docker compose up --build`.
- [ ] Comparison table + README proofread (no unverifiable claims).
- [ ] `v1.0.0` tag + GitHub Release drafted (notes: `docs/release-notes/v1.0.0.md`).
- [ ] Repo metadata: description (replace "Comming soon…"), topics, social preview image.

## T-0 — release

- [ ] Push tag `v1.0.0`; publish the GitHub Release (attach SBOM if generated).
- [ ] (Optional, operator) `npm publish` so `npx agentforge-command` resolves.
- [ ] (Optional) Deploy the static landing page (GitHub Pages) — see `site/`.

## T+0 to T+2h — Show HN (peak window: weekday 09:00–11:00 PT)

- Post `docs/launch/show-hn.md` to <https://news.ycombinator.com/showhn.html>.
- Title (no hype): *"Show HN: AgentForge Command – a local cockpit for Claude Code agent swarms"*.
- Be present for 2 hours; answer every comment plainly. Lead with honesty:
  harness mode (try without a key), documented limits, the PTY-vs-API policy.

## T+6h — Reddit

- r/ClaudeAI, r/OpenSource (stagger, human tone, no marketing-speak).
- Use `docs/launch/reddit-claudeai.md`; link the demo + repo; offer to answer in-thread.

## T+24h — dev.to / blog

- Publish `docs/launch/blog-intro.md` (the build story: security journey, E2E/a11y, Node-version & CI-matrix lessons).

## T+48h — ecosystem

- PR AgentForge into a curated **awesome-claude-code** list.

## Metrics

GitHub stars, HN rank/duration on front page, Reddit upvotes, demo pageviews,
(npm downloads if published). Targets are aspirational, not promises.

## Anti-patterns (do NOT)

- ❌ Claim "faster than Ruflo" (or anyone) without a published benchmark.
- ❌ Downplay limitations — link `KNOWN_LIMITS.md` proudly instead.
- ❌ Post a dead "live demo" link — only link what actually works.
- ❌ Spam every channel the same hour — stagger 6h+.
- ❌ Post then disappear — stay and respond.

## Operator-only steps (cannot be automated from CI)

These require a human with credentials/recording and are intentionally **not**
done by the agent:

1. **Record** the asciinema/GIF (real terminal + browser interaction).
2. **Publish** the GitHub Release and (optionally) to npm.
3. **Deploy** the hosted demo (Pages static landing, or a tiny hosted Node
   server for a truly interactive harness — the cockpit needs a server, so a
   plain static deploy shows a preview, not a live cockpit).
4. **Post** to HN/Reddit/dev.to and engage.
