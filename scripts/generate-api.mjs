import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const apiRevision = "cee214ab2207e47e7b7696d772b3f3d5c0fc6bff";
const apiSchemaSha256 =
  "a8128d46b62651aec77510a66309022b842668b6c5c76c0bc874db474a06eb09";
const defaultSchemaUrl =
  `https://raw.githubusercontent.com/eragasa/projectkoios-api/${apiRevision}/` +
  "openapi/control.openapi.json";
const schemaLocation = process.env.KOIOS_OPENAPI_URL ?? defaultSchemaUrl;
const expectedSha256 = process.env.KOIOS_OPENAPI_SHA256 ?? apiSchemaSha256;
const maximumSchemaBytes = 10_000_000;
const output = path.join("src", "api", "schema.generated.ts");
const check = process.argv.slice(2).includes("--check");
const executable = path.join(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "openapi-typescript.cmd" : "openapi-typescript",
);

async function schemaBytes() {
  if (/^https?:\/\//u.test(schemaLocation)) {
    const response = await fetch(schemaLocation, {
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(`OpenAPI download failed with HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFileSync(schemaLocation);
}

const bytes = await schemaBytes();
if (bytes.length < 1 || bytes.length > maximumSchemaBytes) {
  throw new Error("OpenAPI document is empty or exceeds the byte limit");
}
const observedSha256 = createHash("sha256").update(bytes).digest("hex");
if (observedSha256 !== expectedSha256) {
  throw new Error(
    `OpenAPI SHA-256 mismatch: expected ${expectedSha256}, observed ${observedSha256}`,
  );
}

const temporary = mkdtempSync(path.join(tmpdir(), "projectkoios-web-openapi-"));
try {
  const schema = path.join(temporary, "control.openapi.json");
  const generated = path.join(temporary, "schema.generated.ts");
  writeFileSync(schema, bytes, { flag: "wx" });
  const result = spawnSync(executable, [schema, "-o", generated], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `openapi-typescript failed with status ${result.status ?? "unknown"}`,
    );
  }

  const candidate = readFileSync(generated);
  if (check) {
    const current = readFileSync(output);
    if (!candidate.equals(current)) {
      throw new Error("Generated API types differ from src/api/schema.generated.ts");
    }
  } else {
    writeFileSync(output, candidate);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
