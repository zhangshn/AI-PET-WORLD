import fs from "node:fs"
import path from "node:path"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  buildStage4EvidenceEligibilityRegistry,
  discoverStage4HistoricalEvidence,
  materializeStage4EvidenceRegistry,
} from "./lib/ai-painter-stage4-evidence-eligibility.mjs"

const ROOT = process.cwd()
const definitionArg = process.argv.indexOf("--definition")
if (definitionArg < 0 || !process.argv[definitionArg + 1]) throw new Error("--definition is required")
const definitionPath = resolveInsideRoot(process.argv[definitionArg + 1])
const definition = JSON.parse(fs.readFileSync(definitionPath, "utf8"))
const discoveredHistoricalEvidence = definition.discoverHistoricalEvidence === true
  ? discoverStage4HistoricalEvidence({ root: ROOT, searchRoots: definition.historicalSearchRoots })
  : []
const registry = buildStage4EvidenceEligibilityRegistry({ root: ROOT, ...definition, discoveredHistoricalEvidence })
const registryPath = `.runtime/ai-painter/stage4-execution-evidence-eligibility/${definition.registryId}/registry.json`
const result = materializeStage4EvidenceRegistry({ root: ROOT, registry, registryPath })
for (const value of [result.path, ...Object.values(registry.roles).map((entry) => entry.canonicalPath)]) {
  const absolute = resolveInsideRoot(value)
  const info = fs.statSync(absolute)
  indexArtifact({
    logicalPath: logicalProjectPath(absolute),
    physicalUri: fs.realpathSync(absolute),
    storageLayer: "hot",
    runId: definition.registryId,
    artifactType: "stage4_execution_evidence_eligibility",
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: registry.roles
      ? Object.values(registry.roles).find((entry) => entry.canonicalPath === value)?.sha256
        ?? result.sha256
      : result.sha256,
  })
}
process.stdout.write(`${JSON.stringify({ status: registry.status, registry: result }, null, 2)}\n`)

function resolveInsideRoot(value) {
  if (path.isAbsolute(value)) throw new Error("absolute definition path is forbidden")
  const resolved = path.resolve(ROOT, value)
  const relative = path.relative(ROOT, resolved)
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("definition path escapes project")
  }
  return resolved
}
