# Privacy & Data Protection (Datenschutz)

AgentForge Command is a **local-first** tool. It ships **zero telemetry**,
**no analytics**, **no tracking**, and **no cloud sync**. Nothing about your
usage is sent to the maintainer or any third party.

## What stays on your machine

- **PTY sessions** — the terminals AgentForge spawns run locally; their output
  lives in memory and is shown only in your own browser.
- **Cockpit state** — `.team/arena.json`, `.team/sessions.json`, logs and
  worktrees under `.agentforge/` are written to your local repository only.
- **Your inputs** — goals and messages you type go to the local server and,
  from there, only to Claude (see below) if you have enabled an LLM path.

Data leaves your machine **only** when *you* push to Git/a remote, or when a
configured LLM path calls Claude.

## When does anything leave your machine?

| Mode | Network egress |
|------|----------------|
| **Test-harness mode** (no key, `AGENTFORGE_HARNESS=1`) | **None.** Deterministic mock routing; no LLM calls. |
| **PTY mode** (local `claude` CLI) | Whatever your local `claude` CLI sends to Anthropic — governed by *its* configuration, not AgentForge. |
| **API-key mode** (`ANTHROPIC_API_KEY` set) | HTTPS calls to `api.anthropic.com` only, to stream Atlas's briefings. Your key, your account, your consumption. |

The `ANTHROPIC_API_KEY` is read **server-side only** and is **never** sent to
the browser, logged, or persisted (see [`SECURITY.md`](SECURITY.md)).

## Datenverarbeitung gemäß DSGVO / GDPR (DACH)

If you run AgentForge with your **own** Anthropic API key:

- **Verantwortlicher (Controller):** *you*, the operator.
- **Auftragsverarbeiter (Processor):** Anthropic, for the Claude API calls you
  initiate. Review Anthropic's privacy policy:
  <https://www.anthropic.com/legal/privacy>.
- **AgentForge's role:** AgentForge itself processes **no personal data** on a
  server it controls — there is no AgentForge backend. It only relays *your*
  inputs from *your* machine to Claude. The maintainer receives nothing.

AgentForge sets **no cookies** and embeds **no third-party trackers**. The web
UI is served from your local loopback interface.

### Löschung / Deletion

- **Local data:** delete `.team/arena.json`, `.team/sessions.json`,
  `.agentforge/`, or the whole `.team/` directory.
- **API-side records:** managed by Anthropic — see your
  [Anthropic Console](https://console.anthropic.com/).

### Kontakt

- Questions about **AgentForge**: open a [GitHub issue](https://github.com/BEKO2210/AgentForge-Command/issues).
- Questions about **Claude API data handling**: contact Anthropic support.

---

*This document describes the software's behaviour and is provided for
transparency. It is **not legal advice**; if you deploy AgentForge in a
regulated context, consult your own counsel and Anthropic's terms.*
