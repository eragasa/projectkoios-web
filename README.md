# projectkoios-web

Reusable publishing and control interface for Project Koios.

The application has a public publishing profile and a local/private,
single-operator control profile over `projectkoios-api`. It does not read vaults,
databases, or ingestion caches directly and does not contain user-specific layout
policy.

## Managed deployment surfaces

Install dependencies once, then start either explicit loopback surface:

```bash
npm install
npm run start:www
npm run start:web
```

`www` is the public publishing surface. It starts a PUBLIC API on
<http://127.0.0.1:8100> and a PUBLIC Web process on <http://127.0.0.1:4173>, with
managed records under `.run/www/`. Its API environment removes project-reference,
private reference-library, and equation-review configuration, and startup verifies
that the API OpenAPI document omits project-reference intake.

`web` is the private single-operator control surface. It starts a CONTROL API on
<http://127.0.0.1:8000> and a CONTROL Web process on <http://127.0.0.1:5173>, with
managed records under `.run/web/`. Startup verifies that its OpenAPI document includes
project-reference intake. The distinct defaults allow both surfaces to run
concurrently.

Stop the matching surface with:

```bash
npm run stop:www
npm run stop:web
```

`npm run start:local` and `npm run stop:local` remain compatibility aliases for the
private `web` surface only. Unknown surfaces and explicit API or Vite profiles that
conflict with the selected surface fail closed. Caller-exported `KOIOS_*`,
`PROJECTKOIOS_*`, and `VITE_KOIOS_*` values take precedence over optional ignored
`.env.local` fallbacks. Port and run-directory overrides must be supplied to both the
matching start and stop command.

If the optional default course or project catalog is absent, each surface creates an
ignored empty runtime catalog in its own run directory; explicit catalogs are never
overwritten.

The private `pizzi2020` equation owner is available only on `web` and is disabled by
default. Opt in only with an absolute existing document-package directory:

```bash
KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT=/absolute/path/to/document-package \
  npm run start:web
```

In that mode startup also requires sibling `projectkoios-applications`,
`projectkoios-ingestion`, and `projectkoios-references` source trees (or explicit
`KOIOS_APPLICATIONS_REPO`, `KOIOS_INGESTION_REPO`, and `KOIOS_REFERENCES_REPO` values).
Startup never guesses, defaults, or scans for a corpus path.

## Build profiles

The fail-closed default build is public:

```bash
npm run build:public
```

Build the private control interface separately:

```bash
npm run build:control
```

The public API deployment must also use its public profile; browser route omission
alone is not authorization.

## Checks

```bash
npm run format:check
npm run typecheck
npm test
npm run build:public
npm run build:control
npm run test:e2e
```

`npm test` includes the bounded managed-startup shell smoke suite. Run it alone with
`npm run test:startup`.

## Documentation

- [Architecture](docs/architecture.md)
- [User guide](docs/user-guide.md)
- [Citation-document API contract](docs/citation-document-api-contract.md)
- [GitHubTask CI sequence](docs/ci.md)

Repository routing is documented in `projectkoios-bootstrap/maps/repositories.md`.
