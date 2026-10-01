# Citation-document API contract

The citation-document control UI is generated and implemented against the reviewed
control OpenAPI artifact from `projectkoios-api`:

```text
API commit: 6f6b36f48a6cbbc0678afda39239d971da523f1e
API tree: bb6b460f568b8d668fdd4197b9be448949169c9f
Artifact: openapi/control.openapi.json
SHA-256: c5fe27cc9402b53ff1a5650fe2158e5d4516071d3c648feb1fd5b910c6b58db4
```

`src/api/schema.generated.ts` is generated from that artifact. The browser consumes the
exact `GET /citation-documents`, raw-PDF receipt, synchronous private-processing, and
existing transcript-detail contracts. It does not introduce browser-owned lifecycle
states or infer actions outside response `allowed_actions`.

The control is local/private and represents configured local-operator authority and
admission decisions, not authenticated remote-user identity. Receipt and processing are
separate. Processing has only terminal `SUCCEEDED`, `FAILED`, or `INDETERMINATE` results;
local request-pending presentation is not an owner state. Search indexing and
human/scientific acceptance remain deferred owner fields.

To reproduce type generation:

```bash
KOIOS_OPENAPI_URL=/absolute/path/to/projectkoios-api/openapi/control.openapi.json \
  npm run generate:api
```

Before accepting a regenerated schema, verify the source commit, tree, and artifact hash,
run formatting and type checks, run the focused citation-document tests, and build both
profiles.
