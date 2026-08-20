import { spawnSync } from "node:child_process";
import path from "node:path";

const executable = path.join(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "openapi-typescript.cmd" : "openapi-typescript",
);
const schemaUrl = process.env.KOIOS_OPENAPI_URL ?? "http://127.0.0.1:8000/openapi.json";
const result = spawnSync(executable, [schemaUrl, "-o", "src/api/schema.generated.ts"], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
