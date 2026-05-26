# Representative log excerpts

These are illustrative, not literal — your agents will phrase their lines slightly
differently. They show how the structured grammar works in practice.

## `.team/log/lead.md`
```
09:00 · lead · 🚀 kickoff — build a tiny todo CLI; @backend @frontend @quality see board
09:14 · lead · ↺ sync — #1 done, #3 done, #4 done; reflecting on board
09:32 · lead · 🤝 HANDOFF → @backend · #2 · needs:none · finish the three verbs
09:48 · lead · ✅ integrated #1..#4; pushing
```

## `.team/log/backend.md`
```
09:02 · backend · 🛠 CLAIM #1 — start
09:11 · backend · ✅ DONE #1 — bin/todo + src/todos.js + JSON persistence; gate green
09:12 · backend · 🛠 CLAIM #2 — start
09:31 · backend · 🤝 HANDOFF → @frontend · #2 · needs:exit-codes-spec · which rc on missing id?
```

## `.team/log/frontend.md`
```
09:04 · frontend · 🛠 CLAIM #3 — start
09:18 · frontend · ✅ DONE #3 — argv parsing + --help text + colour fallback; gate green
09:33 · frontend · 🤝 HANDOFF → @backend · #2 · needs:none · suggest rc=2 on missing id (kept consistent with `node --test`)
```

## `.team/log/quality.md`
```
09:06 · quality · 🛠 CLAIM #4 — start
09:24 · quality · ✅ DONE #4 — 3 unit tests via node --test; gate green
09:25 · quality · ⛔ BLOCKED #5 — @backend/needs #2
09:50 · quality · ✅ quality sign-off — full gate green
```
