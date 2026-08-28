import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const projectRoot = process.cwd()
const registryPath = path.join(projectRoot, "data", "ai-console", "registry", "primary-registry-v1.json")
const schemaPath = path.join(projectRoot, "data", "ai-console", "schemas", "ai-console-primary-registry-v1.schema.json")
const storePath = path.join(projectRoot, "src", "server", "ai-console", "registry-store.ts")
const expectedWorkspaceIdentities = [
  "training/overview", "training/plans", "training/models", "training/checkpoints", "training/runs",
  "reviews/current", "reviews/results", "reviews/evidence", "reviews/contracts", "reviews/failures",
  "archive/search", "archive/training", "archive/reviews", "archive/generations", "archive/contracts",
].sort()
const failures = []

for (const requiredPath of [registryPath, schemaPath, storePath]) {
  if (!fs.existsSync(requiredPath)) failures.push(`missing:${path.relative(projectRoot, requiredPath)}`)
}

if (failures.length === 0) {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"))
  const { registrySha256, ...unsignedRegistry } = registry
  const calculatedSha256 = createHash("sha256").update(JSON.stringify(unsignedRegistry), "utf8").digest("hex")
  if (registrySha256 !== calculatedSha256) failures.push("registry_sha256_mismatch")
  if (registry.schemaVersion !== "ai_console_primary_registry_v1") failures.push("schema_version_mismatch")
  if (registry.registryIdentity !== "ai_console_primary_registry") failures.push("registry_identity_mismatch")
  if (registry.sourceBoundary !== "new_ai_console_only") failures.push("source_boundary_mismatch")
  const actualWorkspaceIdentities = Object.keys(registry.recordSets ?? {}).sort()
  if (JSON.stringify(actualWorkspaceIdentities) !== JSON.stringify(expectedWorkspaceIdentities)) failures.push("workspace_set_mismatch")
  for (const workspaceIdentity of expectedWorkspaceIdentities) {
    if (!Array.isArray(registry.recordSets?.[workspaceIdentity])) failures.push(`record_set_invalid:${workspaceIdentity}`)
  }

  const isolatedSources = `${fs.readFileSync(registryPath, "utf8")}\n${fs.readFileSync(storePath, "utf8")}`
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(isolatedSources)) failures.push("legacy_source_coupling")
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  registryIdentity: "ai_console_primary_registry",
  workspaceCount: expectedWorkspaceIdentities.length,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1
