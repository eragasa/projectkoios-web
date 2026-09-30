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
When the optional default public course or project catalog is absent, startup creates
an ignored empty runtime catalog in `.run/` so local control startup can continue.
Explicit `KOIOS_COURSE_CATALOG` and `KOIOS_PROJECT_CATALOG` paths are never replaced,
and existing files are never overwritten. The script refuses to use a port occupied by
an unmanaged process.

Equation-owner packages are not required or added to `PYTHONPATH` during ordinary
startup. To enable the private `pizzi2020` equation-review owner, explicitly provide an
absolute existing document-package directory:

```bash
KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT=/absolute/path/to/document-package \
  npm run start:local
```

Only this opt-in mode resolves and requires the applications, ingestion, and references
Python source trees. Their sibling defaults can be overridden with
`KOIOS_APPLICATIONS_REPO`, `KOIOS_INGESTION_REPO`, and `KOIOS_REFERENCES_REPO`. Paths
containing spaces are supported. Startup does not supply a default document root and
does not search for one.

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
`/equation-reviews`, `/organizer`, `/transcripts`, `/transcript-reviews`,
`/literature-review`, `/docs`,
and `/openapi.json` to the local API, avoiding a
development CORS dependency.

The control header reports whether the API is available. The public profile does not
display operational health.

## Startup configuration

The scripts accept these optional environment variables:

| Variable                                        | Default                                 |
| ----------------------------------------------- | --------------------------------------- |
| `KOIOS_API_HOST`                                | `127.0.0.1`                             |
| `KOIOS_API_PORT`                                | `8000`                                  |
| `KOIOS_WEB_HOST`                                | `127.0.0.1`                             |
| `KOIOS_WEB_PORT`                                | `5173`                                  |
| `KOIOS_RUN_DIR`                                 | `.run` inside this repository           |
| `KOIOS_API_REPO`                                | sibling `projectkoios-api`              |
| `KOIOS_CORE_REPO`                               | sibling `projectkoios`                  |
| `KOIOS_COURSE_CATALOG`                          | core catalog, or empty runtime fallback |
| `KOIOS_PROJECT_CATALOG`                         | core catalog, or empty runtime fallback |
| `KOIOS_SEARCH_REPO`                             | sibling `projectkoios-search`           |
| `KOIOS_OBSIDIAN_REPO`                           | sibling `projectkoios-obsidian`         |
| `KOIOS_APPLICATIONS_REPO`                       | sibling `projectkoios-applications`     |
| `KOIOS_INGESTION_REPO`                          | sibling `projectkoios-ingestion`        |
| `KOIOS_REFERENCES_REPO`                         | sibling `projectkoios-references`       |
| `KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT` | unset; equation owner disabled          |
| `KOIOS_GITHUB_REPOSITORIES`                     | API and web repositories                |
| `KOIOS_OPEN_BROWSER`                            | `0`                                     |

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

## Note-review prototype

From **Control center**, open **Note review** to inspect the fixture-backed design for
reviewing proposed reference and research notes. The queue distinguishes new notes,
managed-section updates, and precondition conflicts. Each proposal exposes its target
path, citekey, batch identity, expected content hash, proposed frontmatter,
machine-managed sections, preserved human-owned sections, and a line-oriented diff.

Review dispositions remain browser-local and disappear when the page reloads. The
prototype cannot create, edit, approve, or apply a vault note. A future integration must
consume the note-owning domain's catalog, keep review from apply, and revalidate the
precondition hash immediately before any explicit materializer write.

## Parsed transcripts

From **Control center**, open **Parsed transcripts**, then choose one document. The
catalog and document detail are supplied only by the control API. Each document is
clearly labeled **Automated · unreviewed** and shows its opaque, path-free identity.

The detail route renders the complete transcript in the owner's canonical page order.
Every page shows its opaque page ID, zero-based page index, one-based physical page, and
exact nullable printed-page label. Transcript text is escaped and displayed verbatim,
including whitespace and a valid empty string; the browser does not parse it as HTML or
Markdown. Reading a transcript cannot review, accept, edit, or mutate evidence.

An empty catalog is distinct from an unavailable provider. Missing documents, malformed
owner projections, unavailable providers, and unexpected provider failures are displayed
as read-only failure states without exposing owner internals. The public build does not
include either transcript route. The separate `/transcript-reviews` API remains a
different workflow and is not used by this display.

## Equation review

From **Control center**, open **Equation review** to request the owner-backed durable
queue for `pizzi2020`. The compact progress summary reports total, decided, and pending
counts. Select an opaque candidate ID from the accessible status list or use
**Previous**/**Next**; the selected ID remains in the URL for reload. The owner controls
the deterministic queue order.

The selected candidate shows its full-width source-region image first, followed by its
deterministic evidence/status, a **Proposed** comparison, and a **Reviewer** comparison.
Each transcription comparison places LaTeX and canonical Obsidian Markdown source beside
a rendered preview. Assisted text is always labeled as an unaccepted proposal. Its raw
immutable source and hash are displayed exactly, even when the proposal already contains
math delimiters. Unassisted candidates retain their evidence but cannot render or accept
a transcription.

For proposed preview and prefill, the browser strips exactly one matching outer `$...$`
or `$$...$$` pair (with only the canonical matching display line feeds) and otherwise
leaves an unwrapped body exact. It never trims or Unicode-normalizes. Mixed, unmatched,
double/nested, empty, edge-whitespace, carriage-return, non-NFC, or asymmetric wrapper
input is flagged and cannot be rendered or accepted. Proposed Markdown wraps only the
derived body, so proposal delimiters are never nested.

Reviewer LaTeX starts from the latest accepted schema-3 reviewer source. A legacy schema-2
acceptance remains visible in stored history but has no accepted source, so the
successfully derived proposal body initializes the editor. The canonical reviewer
Markdown is derived read-only text. KaTeX `0.16.47` renders local previews with trust
disabled and strict errors; those previews do not replace the canonical
Obsidian/MathJax-compatible Markdown.

Choose **Render current correction** after editing. **Accept reviewed transcription**
remains disabled until both exact current representations render successfully and their
SHA-256 confirmation exists. Changing the LaTeX or display mode immediately clears both
reviewer previews and the confirmation. Render errors do not enable acceptance. If the
reviewer source, display mode, or note has changed, candidate navigation pauses until you
stay or explicitly discard the unsubmitted draft.

An acceptance sends the proposal identity, reviewer LaTeX, display mode, exact render
hashes, note, and displayed previous revision. It never sends browser-derived Markdown
as authority or a browser timestamp. Reject and correction-request actions remain
separate and do not claim a successful transcription render. Only a successful
owner-backed response is shown as recorded, with its schema, revision ID/number, status,
and owner time.

The collapsed **Debug & Provenance** pane shows bounded, read-only queue/projection
identity and counts, current index/status, candidate identities, hashes, deterministic
processor and proposal-method fields, proposal-derivation status, revisions, storage
metadata, renderer confirmation, typed error code, and contract JSON. It excludes raw
evidence and transcription bodies, notes, paths, credentials, and secrets.

Noncanonical reviewer LaTeX, stale render, and edit-after-render are distinguished from
stale proposal, evidence, revision, and concurrent-decision conflicts. Partial output,
incomplete or malformed queues, and owner unavailability never imply a save. A 404 means
`pizzi2020` is not configured. The route does not invent fixture data or access corpus
files. See the
[equation-review API contract](equation-review-api-contract.md) for the exact boundary.

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

Generate from the reviewed deterministic control OpenAPI document:

```bash
KOIOS_OPENAPI_URL=/path/to/projectkoios-api/openapi/control.openapi.json \
  npm run generate:api
```

This writes `src/api/schema.generated.ts`. Generated files must be reviewed when API
contracts change. The API client consumes the generated publication and control
contracts. Generate from a control-profile OpenAPI document so the schema contains the
full typed superset.

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

For a repeatable cross-repository transcript-display check, supply the absolute API
worktree, the API-owned control OpenAPI path relative to that worktree, and the exact
reviewed API commit:

```bash
scripts/validate-transcript-display.sh \
  /absolute/path/to/projectkoios-api \
  openapi/control.openapi.json \
  0123456789abcdef0123456789abcdef01234567 \
  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

The final argument is the reviewed artifact's exact SHA-256. The script verifies both
that digest and the API revision, regenerates types only in temporary storage, compares
them with the reviewed Web schema, runs formatting, type checking, unit/startup tests,
the control build, and one sanitized transcript Playwright spec with one worker. It refuses missing dependencies,
revision drift, untracked or linked OpenAPI artifacts, paths outside the supplied API
worktree, schema drift, or any change in
either worktree's tracked/untracked status. Temporary files are removed on exit and the
Playwright-managed server is bounded to the test run. It never starts a transcript owner,
reads corpus data, installs dependencies, or authorizes production readiness.

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
