# Project Koios web user guide

## Requirements

- Node.js 22 or later
- npm
- a Project Koios API for live publications or control workspaces

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

The default development profile is public:

```bash
npm run dev
```

Run the private control profile explicitly when its API is already managed:

```bash
npm run dev:control
```

Open <http://127.0.0.1:5173>. Vite proxies `/health`, `/api/courses`,
`/api/projects`, `/api/publications`, `/github/tasks`, `/search`, `/citation-reviews`,
`/literature-review`, `/docs`, and `/openapi.json` to the local API, avoiding a
development CORS dependency.

The control header reports whether the API is available. The public profile does not
display operational health.

## Startup configuration

The scripts accept these optional environment variables:

| Variable                    | Default                         |
| --------------------------- | ------------------------------- |
| `KOIOS_API_HOST`            | `127.0.0.1`                     |
| `KOIOS_API_PORT`            | `8000`                          |
| `KOIOS_WEB_HOST`            | `127.0.0.1`                     |
| `KOIOS_WEB_PORT`            | `5173`                          |
| `KOIOS_RUN_DIR`             | `.run` inside this repository   |
| `KOIOS_API_REPO`            | sibling `projectkoios-api`      |
| `KOIOS_CORE_REPO`           | sibling `projectkoios`          |
| `KOIOS_COURSE_CATALOG`      | core public-safe course catalog |
| `KOIOS_PROJECT_CATALOG`     | core public project catalog     |
| `KOIOS_SEARCH_REPO`         | sibling `projectkoios-search`   |
| `KOIOS_OBSIDIAN_REPO`       | sibling `projectkoios-obsidian` |
| `KOIOS_GITHUB_REPOSITORIES` | API and web repositories        |
| `KOIOS_OPEN_BROWSER`        | `0`                             |

The shell scripts target macOS and Unix-like development systems. They explicitly
start both processes in the `control` profile and bind them to loopback by default.
Production process supervision should use the deployment platform's service manager.

## Public publishing

The public home, **Projects**, **Courses**, and **Publications** pages are present in
both profiles. Course records come only from `GET /api/courses`; they expose safe
identity and migration-status metadata, never course files or private student state.
`inventory-only`, `review-candidate`, and `published` remain distinct, and a review
candidate is not publication approval. Project records come only from
`GET /api/projects`; the configured, product-owned catalog distinguishes available
capabilities from in-development or planned work, attaches stable review evidence, and
keeps limitations visible. Publication records come only from
`GET /api/publications`; drafts and private control state are not inferred as public
content. Each publication can expose a type, version, authors, publication date,
citation, topics, reviewed claims, explicit limitations, and public links.

An empty catalog is displayed honestly as no public records. An unavailable catalog
is distinct from an empty one. Empty publication results direct visitors to project
evidence and the course inventory rather than ending the public journey. Public pages
also provide route-specific titles and descriptions plus shared source, architecture,
and license links.

## Control center

The control profile adds `/control` routes for the single operator. The first local
deployment relies on loopback/private-network isolation and is not approved for
direct public-internet exposure. The public build has no control routes, and the
public API profile independently omits all control endpoints.

## GitHub tasks

From **Control center**, open **GitHub tasks** to inspect each configured repository's
open pull requests and latest ordered CI sequence. The view reads live GitHub authority
through the local API and does not store a task queue or workflow history.

Only steps explicitly named `GitHubTask …` appear in the sequence. Repository failures
are isolated and shown using bounded categories such as `authentication`,
`rate_limited`, or `not_found`; raw CLI output is not sent to the browser. The view has
no merge, retry, dispatch, deployment, or publication action.

The managed local startup configures the API and web repositories by default. Override
the comma-separated allowlist when needed:

```bash
KOIOS_GITHUB_REPOSITORIES=eragasa/projectkoios-api,eragasa/projectkoios-web \
  npm run start:local
```

The local API process uses the existing authenticated `gh` CLI. GitHub credentials are
never placed in `VITE_*` variables or returned to the browser.

## Search

1. Open **Control center**, then **Search**.
2. Enter a concept, source, or technical term.
3. Choose a result limit.
4. Submit the search.
5. Inspect the result type, score, source path, and text excerpt.

An empty result is distinct from an unavailable API. The current backend uses an
in-memory index, so results depend on how the API process was initialized.

## Citation review

From **Control center**, open **Citation review** to inspect the configured private
review bundle. Each
claim shows its manuscript context with locally rendered equations, the exact
TeX excerpt, the automated recommendation, and reference-only candidate
passages. Use **Preview PDF page** to inspect equations and notation in the
original source, or open the source PDF at its physical page in a separate tab.

Choose a human disposition, select citation keys when accepting or recording
partial support, and optionally add a note. Saving updates the private local
decision store only; it never edits the manuscript or accepts a citation
implicitly.

The API defaults to these private paths:

```text
~/.local/share/projectkoios/citation-review/bundle.json
~/.local/share/projectkoios/citation-review/decisions.sqlite3
~/projectkoios/assets/references/ksdft2effmass/
```

The decision database is created with user-only (`0600`) permissions. The web
application receives evidence through the API and does not read those paths
directly.

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
API contracts change. The API client consumes the generated publication and control contracts. Generate
from a control-profile OpenAPI document so the schema contains the full typed
superset.

## Run checks

```bash
npm run format:check
npm run typecheck
npm test
npm run build:public
npm run build:control
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

Public deployment:

```bash
npm run build:public
npm run preview
```

Private control deployment:

```bash
npm run build:control
npm run preview
```

Each static build is written to `dist/`; building one profile replaces the other.
A production server must route API requests appropriately or the build must use a
suitable `VITE_KOIOS_API_BASE_URL`. A public web build must connect only to a
public-profile API. A control build must remain on loopback or a separately protected
private network until remote authentication is designed and reviewed.

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
