import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const AUTHORIZATION_ID = "owner-authorized-v7-remaining-104-continuous-batch-20260723"
const CAPACITY_POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const TASK_ROOT = ".runtime/ai-painter/ai-assisted-v7-data-tasks"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-continuous-data-batches/preflights"

const startedAtUtc = new Date().toISOString()
const runId = `ai-assisted-v7-continuous-data-preflight-${startedAtUtc.replace(/[:.]/g, "-")}`
const pointer = readJson(CAPACITY_POINTER_PATH)
verifyHash(pointer.gapListPath, pointer.gapListSha256, "V7 gap-list hash mismatch")
const gapList = readJson(pointer.gapListPath)
const slots = (gapList.plannedSlots ?? []).filter((slot) => slot.continuousBatchAuthorizationId === AUTHORIZATION_ID)
assert(slots.length === 104, `V7 continuous preflight expected 104 slots, got ${slots.length}`)

const results = []
for (const slot of slots) {
  let manifest = null
  try {
    manifest = findTaskManifest(slot.slotId)
    if (!manifest) {
      runNode("scripts/build-ai-assisted-conditional-world-fact-blueprints.mjs", ["--v7-slot-id", slot.slotId])
      manifest = findTaskManifest(slot.slotId)
    }
    assert(manifest, `V7 task manifest missing after preparation: ${slot.slotId}`)
    const checked = runNode("scripts/check-ai-assisted-v7-data-task.mjs", ["--slot-id", slot.slotId])
    assert(checked.status === "passed", `V7 task check did not pass: ${slot.slotId}`)
    results.push({
      slotId: slot.slotId,
      status: "preflight_passed",
      split: slot.split,
      regionalLandscapeType: slot.regionalLandscapeType,
      monsoonSeason: slot.monsoonSeason,
      manifestPath: manifest.manifestPath,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    })
  } catch (error) {
    if (manifest?.manifestPath) {
      const manifestPath = resolveProjectPath(manifest.manifestPath)
      const failedManifest = {
        ...manifest,
        status: "failed_before_rgb_generation",
        failedAtUtc: new Date().toISOString(),
        failedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
        failureCode: "v7_continuous_batch_slot_preflight_failed",
        failureDetail: error instanceof Error ? error.message : "unknown_v7_preflight_error",
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
      }
      delete failedManifest.manifestPath
      writeAndIndex(manifestPath, failedManifest)
    }
    results.push({
      slotId: slot.slotId,
      status: "preflight_failed",
      split: slot.split,
      regionalLandscapeType: slot.regionalLandscapeType,
      monsoonSeason: slot.monsoonSeason,
      error: error instanceof Error ? error.message : "unknown_v7_preflight_error",
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    })
  }
}

const completedAtUtc = new Date().toISOString()
const failures = results.filter((entry) => entry.status === "preflight_failed")
const report = {
  schemaVersion: "ai-assisted-v7-continuous-data-preflight-v1",
  runId,
  status: failures.length === 0 ? "all_104_slots_preflight_passed" : "continuous_batch_blocked_by_preflight_failures",
  authorizationId: AUTHORIZATION_ID,
  capacityPlanRunId: pointer.runId,
  startedAtUtc,
  startedAtAsiaShanghai: formatShanghai(startedAtUtc),
  completedAtUtc,
  completedAtAsiaShanghai: formatShanghai(completedAtUtc),
  slotCount: slots.length,
  passedCount: results.length - failures.length,
  failedCount: failures.length,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
  ownerApprovalAutomatic: false,
  results,
  automaticStorage: true,
}
const reportPath = path.join(ROOT, OUTPUT_ROOT, runId, "preflight-report.json")
writeAndIndex(reportPath, report)
const latestPath = path.join(ROOT, OUTPUT_ROOT, "latest.json")
const latest = {
  schemaVersion: "ai-assisted-v7-continuous-data-preflight-latest-v1",
  runId,
  status: report.status,
  updatedAtUtc: completedAtUtc,
  updatedAtAsiaShanghai: report.completedAtAsiaShanghai,
  reportPath: projectPath(reportPath),
  reportSha256: sha256(fs.readFileSync(reportPath)),
  passedCount: report.passedCount,
  failedCount: report.failedCount,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
}
writeAndIndex(latestPath, latest)
closeStorageCatalog()
appendAiPainterProgramEvent({
  runId,
  status: failures.length === 0 ? "success" : "blocked",
  stage: "ai_assisted_v7_continuous_batch_preflight",
  action: "preflight_all_authorized_v7_data_slots_without_rgb",
  kind: "v7_continuous_data_batch",
  titleZh: failures.length === 0 ? "V7连续数据批次104槽无图预演全部通过" : "V7连续数据批次被无图预演失败阻断",
  titleEn: failures.length === 0 ? "All 104 V7 continuous data slots passed the no-RGB preflight" : "The V7 continuous data batch was blocked by no-RGB preflight failures",
  summaryZh: `程序检查${slots.length}个授权槽位：通过${report.passedCount}，失败${report.failedCount}。本轮没有生成RGB，没有启动GPU训练。`,
  summaryEn: `The program checked ${slots.length} authorized slots: ${report.passedCount} passed and ${report.failedCount} failed. No RGB was generated and no GPU training was started.`,
  evidence: [projectPath(reportPath)],
  errorCode: failures.length === 0 ? null : "v7_continuous_batch_preflight_failed",
})
console.log(JSON.stringify(latest, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function findTaskManifest(slotId) {
  const manifests = listFiles(resolveProjectPath(TASK_ROOT), "manifest.json")
  for (const filePath of manifests) {
    const manifest = readJsonSafe(filePath)
    if (manifest?.row?.capacitySlotId === slotId && manifest.status !== "failed_before_rgb_generation") {
      return { ...manifest, manifestPath: projectPath(filePath) }
    }
  }
  return null
}

function runNode(script, args) {
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
  if (child.status !== 0) throw new Error((child.stderr || child.stdout || `${script} exited ${child.status}`).trim())
  return JSON.parse(child.stdout)
}

function writeAndIndex(filePath, value) {
  writeJsonAtomic(filePath, value)
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(filePath)),
  })
}

function listFiles(root, fileName) {
  if (!fs.existsSync(root)) return []
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(resolved, fileName))
    else if (entry.isFile() && entry.name === fileName) files.push(resolved)
  }
  return files
}

function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function readJsonSafe(value) { try { return readJson(value) } catch { return null } }
function verifyHash(value, expected, message) { assert(sha256(fs.readFileSync(resolveProjectPath(value))) === expected, message) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
