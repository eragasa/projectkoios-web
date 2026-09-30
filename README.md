# projectkoios-web

Reusable publishing and control interface for Project Koios.

The application has a public publishing profile and a local/private,
single-operator control profile over `projectkoios-api`. It does not read vaults,
databases, or ingestion caches directly and does not contain user-specific layout
policy.

## Start

```bash
npm install
npm run start:local
```

This starts both `projectkoios-api` and the web development server. The web
interface runs at <http://127.0.0.1:5173> and proxies API requests to
<http://127.0.0.1:8000>. If the optional default course or project catalog is absent,
startup uses an ignored empty runtime catalog from `.run/`; explicit catalog paths and
existing files are never overwritten.

The private `pizzi2020` equation owner is disabled by default. Opt in only with an
absolute existing document-package directory:

```bash
KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT=/absolute/path/to/document-package \
  npm run start:local
```

In that mode startup also requires sibling `projectkoios-applications`,
`projectkoios-ingestion`, and `projectkoios-references` source trees (or explicit
`KOIOS_APPLICATIONS_REPO`, `KOIOS_INGESTION_REPO`, and `KOIOS_REFERENCES_REPO` values).
Startup never guesses, defaults, or scans for a corpus path.

Stop both managed processes with:

```bash
npm run stop:local
```

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
- [GitHubTask CI sequence](docs/ci.md)

Repository routing is documented in `projectkoios-bootstrap/maps/repositories.md`.
