# Project Koios web architecture

## Status

Dual-surface foundation implemented: public publishing, a local single-operator
control center, API health status, global search, scientific review workspaces,
and a typed API client.

## Purpose

`projectkoios-web` is the reusable browser interface for Project Koios. It
presents application capabilities exposed by `projectkoios-api` and keeps human
review visible at system boundaries.

```text
Browser
    -> projectkoios-web
    -> HTTP / WebSocket contracts
    -> projectkoios-api
    -> Project Koios application services
```

The browser never reads a vault, SQLite database, extraction cache, or local
source file directly.

## Scope

The repository owns:

- browser routes and interaction design;
- reusable visual components;
- browser-side API clients and boundary types;
- server-state caching and request lifecycle display;
- accessibility and responsive behavior;
- browser unit, integration, and end-to-end tests.

It does not own:

- search, ingestion, publication, workflow, or vault semantics;
- direct filesystem access;
- backend persistence;
- deployment-specific directory names or lecture policy;
- canonical API schemas;
- authentication policy beyond implementing API contracts.

## Deployment profiles

The frontend has two build-time profiles:

- `public` is the fail-closed default. It contains the public home and publication
  catalog routes only.
- `control` contains those public routes plus the single-operator control center,
  private search, citation review, and literature review.

The profiles share a design system and public read models, but they are separate
deployment artifacts. Route omission in the public bundle is defense in depth, not
a substitute for the API boundary. The public API profile independently omits every
control endpoint and must be deployed separately from the loopback/private control
API.

## Technology

- TypeScript with strict type checking;
- React for UI composition;
- Vite for development and production builds;
- React Router for browser navigation;
- TanStack Query for server state;
- Vitest and Testing Library for component tests;
- Playwright for browser acceptance tests;
- `openapi-typescript` for generated boundary types when the API schema is
  available.

Local component state remains in React. Server state remains in TanStack Query.
A global client-state framework is not introduced until a concrete requirement
justifies it.

## Current modules

```text
src/
├── api/
│   └── client.ts
├── app/
│   ├── App.tsx
│   ├── AppProviders.tsx
│   ├── AppShell.tsx
│   └── deploymentProfile.ts
├── components/
│   └── HealthIndicator.tsx
├── features/
│   ├── citation-review/
│   ├── dashboard/
│   ├── literature-review/
│   ├── publishing/
│   └── search/
├── test/
└── main.tsx
```

Features depend on the API client and reusable components. The API client does
not depend on React. Components do not import backend implementation packages.

## Local development process management

`scripts/startup.sh` and `scripts/shutdown.sh` supervise the local development
API and web processes. They keep PID files and append-only logs in ignored
`.run/` state.

The startup script:

- resolves sibling Project Koios repositories or explicit environment overrides;
- starts the API with an explicit Python namespace path;
- starts Vite directly rather than through an extra npm process;
- rejects ports occupied by unmanaged processes;
- waits for health readiness;
- reuses already managed processes;
- cleans up only processes started by a failed invocation.

Shutdown validates the observed command before signaling a stored PID and stops
web before API. These scripts are development conveniences, not production
service supervision.

## API boundary

The development server proxies relative API paths to
`http://127.0.0.1:8000`. Production deployments should provide the API through
the same origin or configure `VITE_KOIOS_API_BASE_URL` at build time.

The public API contracts are:

```text
GET /health
GET /api/publications
GET /openapi.json
```

The control API additionally exposes private search, citation-review, and
literature-review contracts. `src/api/schema.generated.ts` is generated from the
control OpenAPI document so one typed client can support the superset while profile
routing prevents public UI access.

`src/api/schema.generated.ts` is generated from the backend OpenAPI document,
and `src/api/client.ts` consumes its request and response types. The API schema
remains authoritative; browser types are projections. A small refinement is
used for `/health` because the current backend schema exposes a generic string
mapping rather than a named health model.

## Routing

```text
/                            public home
/publications                public publication catalog
/control                     private single-operator dashboard
/control/search              private retrieval UI
/control/citation-review     private citation-review workspace
/control/literature-review   private literature-review workspace
```

The `/control` routes exist only in the control build. Planned control routes include
repository health, tasks, decisions, agent runs, workflows, and release operations.
A route should be added only when its backend contract exists or when it is explicitly
a read-only prototype using fixtures.

## Local-first behavior

- The default API endpoint is same-origin.
- Development traffic remains on loopback.
- No third-party analytics or font requests are included.
- User content is not sent to external services by the web application.
- Offline assets are bundled into the build.

## Deployment configuration

Reusable code does not contain personal profiles. A deployment may provide:

- API base URL;
- profile identifier;
- enabled feature flags;
- presentation preferences.

Private workspace configuration remains outside this repository. The API, not
the browser bundle, is responsible for resolving local vault paths.

## Error and loading states

Every server-backed view must expose:

- initial loading;
- successful empty result;
- successful populated result;
- recoverable API error;
- mutation-in-progress state;
- explicit confirmation before destructive actions.

A future write operation must display the target resource and server-side
validation before submission.

## Accessibility

- Routes use semantic headings and landmarks.
- Forms have programmatic labels.
- asynchronous status uses live regions where appropriate;
- keyboard navigation is supported;
- color is not the only status indicator;
- reduced-motion preferences are respected.

## Testing strategy

1. API-client tests verify HTTP contracts and errors.
2. Component tests verify rendering and interaction without a live backend.
3. Playwright tests exercise user-visible flows with controlled API responses.
4. TypeScript compilation validates internal and generated boundary types.
5. Production builds verify bundling and asset resolution.

Live API compatibility should later run as a separate contract test against
`projectkoios-api` OpenAPI output.

## Security boundary

The web application must treat API content as untrusted data. React escaping is
retained by default. Rendering raw HTML, Markdown, PDF links, or local paths
requires explicit sanitization and policy review.

The first control deployment is single-operator and local/private. It is not an
internet authentication system: the API and web server bind to loopback during local
startup, and the public deployment uses a separate public-profile API. A future
remote control deployment requires an explicit authentication, session, CSRF, CORS,
and audit design before exposure.

Browser profile checks are not authorization. Backend route omission and deployment
isolation enforce the current capability boundary.
