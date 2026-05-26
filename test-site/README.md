# test-site — Demo-Webseite (4-Agent-Test)

Kleine statische Test-Webseite + Mini-Backend, gebaut vom 4-Agent-Team-Kit.
Zweck: Smoke-Test der Team-Pipeline (Lead → Backend/Frontend → Quality) an einem
sichtbaren Artefakt.

## Layout & Lanes

```
test-site/
├── public/        # HTML (frontend)
│   ├── index.html       (Landing)
│   ├── about.html
│   └── contact.html
├── styles/        # CSS, Assets (frontend)
│   └── main.css
├── server/        # Node http-Server + /api (backend)
│   └── server.js
└── tests/         # Smoke-Test, in tests/run.sh eingehängt (quality)
    └── smoke.sh
```

Lane-Mapping:
- **frontend** schreibt `public/**` und `styles/**`.
- **backend** schreibt `server/**` (Node ≥ 18, **keine** npm-Deps — `http`/`fs` builtin).
- **quality** schreibt `tests/**` und hängt den Smoke in `tests/run.sh` der Wurzel ein.
- **lead** pflegt diese README + integriert.

## Lokal starten (sobald Backend #3 fertig ist)

```bash
node test-site/server/server.js
# → http://localhost:8080
```

Endpoints:
- `GET /` → `public/index.html`
- `GET /about` → `public/about.html`
- `GET /contact` → `public/contact.html`
- `GET /api/hello` → `{"message":"hello","ts":<unix>}`
- statische Auslieferung für `public/**` und `styles/**`

## Akzeptanz

- HTML validiert grob (lang-Attr, title, semantische Tags, Labels für Inputs).
- Server antwortet auf `/` und `/api/hello` mit `200`.
- Smoke-Test grün → Lead pusht.
