## Quick summary

This is a small single-repo POS-tracker app: an Express (Node) backend serving a static single-page frontend. The app uses a checked-in SQLite database file `dev.db` and no build step. Use `npm install` then `npm start` and open http://localhost:3000.

## How to run / debug (commands)

- Install deps: `npm install` (project uses `express` and `sqlite3`)
- Start server: `npm start` (runs `node server.js`, listens on port 3000)
- If you need to inspect DB: use sqlite3 CLI on the repository root: `sqlite3 dev.db` then `.tables` / `.schema`
- Logs: `server.js` prints DB connection status and the listening port to stdout

Note: `dev.db` is tracked in the repo and can be locked on Windows while the server is running. Stop the server or any DB-using process before running merges or replacing the file.

## Big picture architecture

- Backend: `server.js` is the single Express app. It opens `./dev.db` (SQLite) and defines all API endpoints under `/api/*`.
- Frontend: static files in `public/` (entry `public/index.html`, logic in `public/script.js`). Tailwind is included via CDN — there is no frontend build.
- Data flow: frontend uses fetch() (see `apiRequest` in `public/script.js`) to call `/api/*` endpoints; server reads/writes `dev.db` and returns JSON. Many server queries use JOINs and GROUP_CONCAT to pack related rows into comma-separated strings (e.g. versions/models/bulgular).

## Key files and example references

- `server.js` — all API routes and DB interactions. Search here for `/api/vendors`, `/api/models`, `/api/versions`, `/api/bulgular` to see validation and returned shapes.
- `public/script.js` — single-file frontend: `apiRequest()` (unified fetch wrapper), render functions (`renderYonetimPage`, `renderBulgularPage`), and modal handlers (`attach*ModalListeners`). Use it to see expected request/response shapes.
- `public/index.html` — root SPA shell; loads `/script.js` and tailwind CDN.
- `dev.db` — checked-in SQLite DB (schema + example data). Be careful: it's a binary file that can block filesystem operations on Windows.

## API shapes & example calls (concrete)

- GET /api/vendors -> [{ id, name, makeCode, slug }, ...]
- POST /api/vendors { name, makeCode } -> 201 { id, name, makeCode, slug }
- GET /api/models -> [{ id, name, code, vendorId, vendorName, isTechpos, isAndroidPos, isOkcPos }, ...]
- POST /api/models { name, code, vendorId, isTechpos, isAndroidPos, isOkcPos }
- GET /api/versions -> rows with fields: id, versionNumber, deliveryDate, status, prodOnayDate, vendorId, vendorName, models (comma list), modelIds (comma list)
- POST /api/versions expects modelIds as an array in JSON body (server inserts into VersionModel)
- GET /api/bulgular -> bulgu records where client expects `modelIds` as comma list from DB but frontend transforms form data to `modelIds` array when POST/PUT

Important: Client-side forms send JSON with `Content-Type: application/json`. Many server endpoints validate required fields and return 400/409/500 accordingly (see `server.js` for exact messages).

## Project-specific conventions & gotchas

- No frontend build: edit `public/script.js` directly. Keep functions single-file and synchronous with the DOM structure in `index.html`.
- DB file (`dev.db`) is tracked. On Windows it may be locked; stop the Node process before replacing/merging the file. When merging branches, stash or back up `dev.db` first to avoid "unable to unlink" errors.
- Static files are served with caching disabled in `server.js` (etag/lastModified disabled, Cache-Control: no-store). Safe for development but note behaviour when testing caching-related bugs.
- The server many times uses `db.run` with manual transactions for multi-step updates (see PUT /api/versions and PUT /api/bulgular). Be cautious when changing these flows; follow the existing BEGIN/COMMIT/ROLLBACK pattern.

## Integration points and dependencies

- External: none (no 3rd-party APIs). Only npm packages: `express` and `sqlite3` (see `package.json`).
- The frontend expects same-origin API calls to `/api/*` — if you add a proxy or CORS, update `public/script.js` accordingly.

## Recommended initial tasks for an AI coding agent

- Inspect `server.js` endpoints first to learn data shapes and validations.
- Inspect `public/script.js` to see client expectations, especially `apiRequest`, form payload construction (FormData -> JSON), and how modal listeners build `modelIds` arrays.
- Avoid modifying `dev.db` directly; if a change requires DB reset, coordinate with the maintainer or back up `dev.db.bak` first.

If anything here is unclear or you want me to expand a specific section (example requests, schema extraction from `dev.db`, or adding a short CONTRIBUTING snippet), tell me which part to expand.
