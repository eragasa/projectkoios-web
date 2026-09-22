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

This starts both `projectkoios-api` and the web development server. Set
`KOIOS_ORGANIZER_ENABLED=1` with `KOIOS_ORGANIZER_MODEL_DIGEST` to add the
PID-managed metadata-only organization worker. The web interface runs at <http://127.0.0.1:5173> and proxies API requests to
<http://127.0.0.1:8000>.

Stop all managed processes with:

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

## Documentation

- [Architecture](docs/architecture.md)
- [User guide](docs/user-guide.md)
- [GitHubTask CI sequence](docs/ci.md)
- [Repository ADR](docs/adr.establish-web-repository.md)

Repository routing is documented in `projectkoios-bootstrap/maps/repositories.md`.
