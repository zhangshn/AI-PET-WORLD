import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  CURRENT_EXECUTION_REGISTRY_PATH,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const projectRoot = process.cwd()
const projectionPath = "src/server/ai-console/ai-painter-current-execution-projection.ts"
const apiPath = "src/app/api/ai-console/observability/current-execution/route.ts"
const pageStatusPath = "src/app/ai-console/ai-console-current-execution-status.tsx"

const [projectionSource, apiSource, pageStatusSource] = await Promise.all([
  readText(projectionPath),
  readText(apiPath),
  readText(pageStatusPath),
])

assert.match(projectionSource, /readCurrentExecutionRegistry/u)
assert.match(projectionSource, /CURRENT_EXECUTION_REGISTRY_PATH/u)
assert.match(projectionSource, /currentProjectTask/u)
assert.match(projectionSource, /activeExecution/u)
assert.match(projectionSource, /latestTrainingTerminal/u)
assert.match(projectionSource, /selectedHistoricalRun/u)
assert.match(projectionSource, /machine_review_timeline_sha256_mismatch/u)
assert.doesNotMatch(projectionSource, /readdir|globSync|fast-glob|mtimeMs|birthtime/u)
assert.match(apiSource, /readAiPainterCurrentExecutionSnapshot/u)
assert.match(apiSource, /Cache-Control/u)
assert.match(pageStatusSource, /\/api\/ai-console\/observability\/current-execution/u)
assert.match(pageStatusSource, /refreshIntervalMs = 1_000/u)

const registryRead = await readCurrentExecutionRegistry(projectRoot)
assert.equal(registryRead.ok, true, registryRead.errorCode ?? "current registry must verify")
const registry = registryRead.registry
assert.ok(registry && typeof registry === "object")
assert.equal(registry.registryIdentity, "ai-painter-current-execution")
assert.ok(Number.isInteger(registry.registryRevision))
assert.equal(typeof registry.taskId, "string")
assert.equal(typeof registry.runId, "string")
assert.equal(typeof registry.lifecycleStage, "string")
assert.equal(typeof registry.executionState, "string")
assert.ok(Object.prototype.hasOwnProperty.call(registry, "activeExecution"))
assert.ok(Object.prototype.hasOwnProperty.call(registry, "latestTrainingTerminal"))
assert.ok(Object.prototype.hasOwnProperty.call(registry, "selectedHistoricalRun"))

const latest = registry.latestTrainingTerminal
assert.ok(latest && typeof latest === "object")
const timelineBinding = latest.evidence?.machineReviewTimeline
assert.ok(timelineBinding && typeof timelineBinding === "object")
const timelineBytes = await readProjectFile(timelineBinding.path)
assert.equal(sha256(timelineBytes), timelineBinding.sha256)
const timeline = JSON.parse(timelineBytes.toString("utf8"))
assert.equal(timeline.runId, latest.runId)
assert.equal(timeline.reviews.length, timeline.completedReviewCount)
assert.equal(timeline.previewPassCount + timeline.previewFailCount, timeline.completedReviewCount)
assert.ok(timeline.completedReviewCount <= timeline.targetReviewCount)
assert.notEqual(sha256(Buffer.concat([timelineBytes, Buffer.from("\n", "utf8")])), timelineBinding.sha256)
await assert.rejects(() => readProjectFile("../outside-current-execution.json"))

console.log(JSON.stringify({
  status: "passed",
  sourcePath: CURRENT_EXECUTION_REGISTRY_PATH,
  registryRevision: registry.registryRevision,
  taskId: registry.taskId,
  runId: registry.runId,
  activeExecution: registry.activeExecution !== null,
  latestTrainingStatus: latest.status,
  machineReview: {
    passed: timeline.previewPassCount,
    failed: timeline.previewFailCount,
    target: timeline.targetReviewCount,
    evidenceSha256: timelineBinding.sha256,
  },
}, null, 2))

async function readText(relativePath) {
  return readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8")
}

async function readProjectFile(relativePath) {
  assert.equal(typeof relativePath, "string")
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"))
  assert.equal(path.posix.isAbsolute(normalized), false)
  assert.equal(normalized === ".." || normalized.startsWith("../"), false)
  const absoluteRoot = path.resolve(projectRoot)
  const absolutePath = path.resolve(absoluteRoot, ...normalized.split("/"))
  const relative = path.relative(absoluteRoot, absolutePath)
  assert.equal(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), false)
  return readFile(absolutePath)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}
