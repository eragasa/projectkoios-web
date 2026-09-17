# projectkoios-web

Reusable browser interface for Project Koios.

The application provides a local-first UI over `projectkoios-api`. It does not
read vaults, databases, or ingestion caches directly and does not contain
user-specific layout policy.

## Start

```bash
npm install
npm run start:local
```

This starts both `projectkoios-api` and the web development server. The web
interface runs at <http://127.0.0.1:5173> and proxies API requests to
<http://127.0.0.1:8000>.

Stop both managed processes with:

```bash
npm run stop:local
```

## Checks

```bash
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Documentation

- [Architecture](docs/architecture.md)
- [User guide](docs/user-guide.md)
- [Repository ADR](docs/adr.establish-web-repository.md)

Repository routing is documented in `projectkoios-bootstrap/maps/repositories.md`.
