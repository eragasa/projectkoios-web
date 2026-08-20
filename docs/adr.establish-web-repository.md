# ADR: Establish the Project Koios web repository

## Status

Accepted

## Context

Project Koios needs a reusable browser interface. Placing browser code in the
API, Obsidian, ingestion, or a private deployment workspace would mix interface
concerns with backend domain logic or user-specific policy.

The Project Koios repositories already separate API, ingestion, search,
workflow, references, and Obsidian capabilities.

## Decision

Establish `projectkoios-web` as the canonical repository for the reusable
browser interface.

The repository will:

- use TypeScript and React;
- consume `projectkoios-api` through HTTP and WebSocket contracts;
- generate boundary types from OpenAPI;
- remain independent of Python implementation packages;
- contain no private vault paths or deployment-specific content;
- use read-only inspection as the first product slice;
- require explicit confirmation and backend validation for future writes.

## Consequences

- Frontend and backend can evolve behind explicit contracts.
- Browser code has an independent build and test lifecycle.
- Deployment profiles remain outside the reusable repository.
- API compatibility must be tested when either side changes.
- Same-origin routing or explicit CORS configuration is required in deployment.
