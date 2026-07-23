import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const validationRoot = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-conditional-inference-validation")
const failureRoot = path.join(validationRoot, "failures")
let indexed = 0

for (const entry of readEntries(validationRoot)) {
  const entryPath = path.join(validationRoot, entry.name)
  if (entry.isDirectory() && entry.name !== "failures") {
    indexTree(entryPath, entry.name)
  } else if (entry.isFile() && entry.name === "latest.json") {
    indexFile(entryPath, readRunId(entryPath))
  }
}

for (const entry of readEntries(failureRoot)) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue
  const entryPath = path.join(failureRoot, entry.name)
  indexFile(entryPath, readRunId(entryPath))
}

closeStorageCatalog()
console.log(JSON.stringify({
  status: "ai_assisted_inference_validation_catalog_backfill_completed",
  validationRoot: logicalProjectPath(validationRoot),
  indexed,
}, null, 2))

function indexTree(rootPath, runId) {
  for (const entry of readEntries(rootPath)) {
    const entryPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) indexTree(entryPath, runId)
    else if (entry.isFile()) indexFile(entryPath, runId)
  }
}

function indexFile(filePath, runId) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
  })
  indexed += 1
}

function readRunId(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"))
    return typeof value?.runId === "string" ? value.runId : null
  } catch {
    return null
  }
}

function readEntries(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}
