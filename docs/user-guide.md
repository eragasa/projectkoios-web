# Project Koios web user guide

## Requirements

- Node.js 22 or later
- npm
- a Project Koios API available for live search

## Install

```bash
npm install
```

## Start the local stack

The managed startup script expects the Project Koios repositories to be sibling
directories and `projectkoios-api/.venv` to exist.

```bash
npm run start:local
```

It starts:

- `projectkoios-api` on <http://127.0.0.1:8000>;
- the Vite web server on <http://127.0.0.1:5173>.

It waits for both services to become ready and stores PID files and logs in
`.run/`. Repeating the command is safe: already managed processes are reused.
The script refuses to use a port occupied by an unmanaged process.

To open the browser automatically on macOS:

```bash
KOIOS_OPEN_BROWSER=1 npm run start:local
```

## Stop the local stack

```bash
npm run stop:local
```

Shutdown occurs in reverse order: web first, then API. The script validates each
PID's command before sending a signal, waits up to ten seconds, and only then
uses a forced stop.

Logs remain available after shutdown:

```text
.run/api.log
.run/web.log
```

## Run only the web application

If the API is already managed separately:

```bash
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/health`, `/search`, `/docs`, and
`/openapi.json` to the local API, avoiding a development CORS dependency.

The header reports whether the API is available.

## Startup configuration

The scripts accept these optional environment variables:

| Variable              | Default                         |
| --------------------- | ------------------------------- |
| `KOIOS_API_HOST`      | `127.0.0.1`                     |
| `KOIOS_API_PORT`      | `8000`                          |
| `KOIOS_WEB_HOST`      | `127.0.0.1`                     |
| `KOIOS_WEB_PORT`      | `5173`                          |
| `KOIOS_RUN_DIR`       | `.run` inside this repository   |
| `KOIOS_API_REPO`      | sibling `projectkoios-api`      |
| `KOIOS_CORE_REPO`     | sibling `projectkoios`          |
| `KOIOS_SEARCH_REPO`   | sibling `projectkoios-search`   |
| `KOIOS_OBSIDIAN_REPO` | sibling `projectkoios-obsidian` |
| `KOIOS_OPEN_BROWSER`  | `0`                             |

The shell scripts target macOS and Unix-like development systems. Production
process supervision should use the deployment platform's service manager.

## Search

1. Open **Search**.
2. Enter a concept, source, or technical term.
3. Choose a result limit.
4. Submit the search.
5. Inspect the result type, score, source path, and text excerpt.

An empty result is distinct from an unavailable API. The current backend uses an
in-memory index, so results depend on how the API process was initialized.

## Configure another API endpoint

Create an ignored `.env.local`:

```dotenv
VITE_KOIOS_API_BASE_URL=http://127.0.0.1:8000
```

Restart Vite after changing environment variables. Do not place credentials or
private vault paths in `VITE_*` values: Vite embeds those variables into the
browser bundle.

## Generate OpenAPI types

With the API running:

```bash
npm run generate:api
```

This writes `src/api/schema.generated.ts`. Generated files must be reviewed when
API contracts change. The API client consumes the generated search contracts.

## Run checks

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

Install the Playwright browser once:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:e2e
```

The end-to-end test controls API responses and does not require access to a
private vault.

## Production preview

```bash
npm run build
npm run preview
```

The static build is written to `dist/`. A production server must route API
requests appropriately or the build must be created with a suitable
`VITE_KOIOS_API_BASE_URL`.

## Privacy

- The application has no analytics.
- It loads no third-party fonts.
- It does not directly access local files.
- Search terms are sent only to the configured Project Koios API.
- Browser-visible environment variables are not secrets.

## Troubleshooting

### API shows offline

Confirm the API is running and that `/health` is reachable. If using a custom
endpoint, check `.env.local` and restart Vite.

### Search returns no results

Confirm the backend index contains documents. An HTTP 200 response with an empty
array means the API is available but found no matches.

### Browser requests return CORS errors

Use the development proxy with relative API URLs, configure same-origin
production routing, or configure CORS in the API deployment. Do not disable
browser security.

### Type generation fails

Confirm `http://127.0.0.1:8000/openapi.json` is available or set
`KOIOS_OPENAPI_URL` to the schema URL before running `npm run generate:api`.
