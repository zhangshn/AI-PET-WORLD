import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const DEFAULT_VJ2_REPORT =
  ".runtime/ai-painter/natural-home-v91-current-mvp-vj2-review/latest.json"
const DEFAULT_RUNTIME_INDEX = "data/world-runtime/latest-world.json"
const DEFAULT_OUTPUT_ROOT =
  ".runtime/ai-painter/natural-home-v91-approved-frame-candidate-binding"

const vj2ReportPath = path.resolve(process.argv[2] ?? DEFAULT_VJ2_REPORT)
const runtimeIndexPath = path.resolve(process.argv[3] ?? DEFAULT_RUNTIME_INDEX)
const outputRoot = path.resolve(process.argv[4] ?? DEFAULT_OUTPUT_ROOT)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function sha256String(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath)
  assert(buffer.length >= 24, `PNG file is too small: ${filePath}`)
  assert(buffer.toString("ascii", 1, 4) === "PNG", `Not a PNG file: ${filePath}`)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function normalizeRelative(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/")
}

function safeToken(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
}

function buildSourceFactIds(saveRecord) {
  const homeMapState = saveRecord.homeMapState ?? {}
  const zones = Array.isArray(homeMapState.zones) ? homeMapState.zones : []
  const placements = Array.isArray(homeMapState.placements) ? homeMapState.placements : []
  const constructionPlans = Array.isArray(homeMapState.constructionPlans)
    ? homeMapState.constructionPlans
    : []
  const mapDiffs = Array.isArray(homeMapState.mapDiffs) ? homeMapState.mapDiffs : []
  const recentEvents = Array.isArray(saveRecord.recentEvents) ? saveRecord.recentEvents : []

  return [
    saveRecord.worldId,
    ...zones.map((zone) => zone.id),
    ...placements.map((placement) => placement.id),
    ...constructionPlans.map((plan) => plan.id),
    ...mapDiffs.map((diff) => diff.id),
    ...recentEvents.map((event) => event.id),
  ].filter((id) => typeof id === "string" && id.trim().length > 0)
}

function buildBindingReport() {
  const generatedAt = new Date().toISOString()
  const vj2ReportRaw = fs.readFileSync(vj2ReportPath, "utf8")
  const vj2Report = JSON.parse(vj2ReportRaw)
  const runtimeIndex = readJson(runtimeIndexPath)
  const runtimeSavePath = path.resolve(runtimeIndex.path)
  const runtimeSaveRaw = fs.readFileSync(runtimeSavePath, "utf8")
  const runtimeSaveRecord = JSON.parse(runtimeSaveRaw)
  const bestCandidate = vj2Report.bestCandidate
  const generatedImagePath = path.resolve(bestCandidate?.generated ?? "")
  const blueprintPath = path.resolve(bestCandidate?.blueprint ?? "")
  const targetPath = bestCandidate?.target ? path.resolve(bestCandidate.target) : null

  assert(vj2Report.schemaVersion === "natural-home-current-mvp-vj2-review-v1", "unexpected VJ-2 schema")
  assert(vj2Report.status === "vj_2_passed_candidate_available", "VJ-2 report has no passed candidate")
  assert(vj2Report.displayAllowed === false, "VJ-2 report must not be display allowed")
  assert(vj2Report.canPromoteToWorld === false, "VJ-2 report must not promote directly to world")
  assert(bestCandidate?.vj2Status === "vj_2_passed_minimal", "best candidate must pass minimal VJ-2")
  assert(fs.existsSync(generatedImagePath), "missing generated candidate image")
  assert(fs.existsSync(blueprintPath), "missing candidate blueprint")
  assert(runtimeSaveRecord.version === "v2.6-runtime-00", "unexpected runtime save version")
  assert(runtimeSaveRecord.worldId === runtimeIndex.worldId, "runtime worldId index mismatch")
  assert(runtimeSaveRecord.ownerId === runtimeIndex.ownerId, "runtime ownerId index mismatch")
  assert(typeof runtimeSaveRecord.tick === "number", "runtime tick missing")

  const imageSize = getPngSize(generatedImagePath)
  const imageStats = fs.statSync(generatedImagePath)
  const blueprintRaw = fs.readFileSync(blueprintPath, "utf8")
  const sourceFactIds = buildSourceFactIds(runtimeSaveRecord)
  assert(sourceFactIds.length > 0, "sourceFactIds cannot be empty")

  const candidateId = [
    "natural-home-v91-approved-candidate",
    safeToken(runtimeSaveRecord.worldId),
    String(runtimeSaveRecord.tick),
    safeToken(bestCandidate.sampleId),
  ].join("-")

  const candidatePreviewPath = path.join(outputRoot, "candidate-preview.png")
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.copyFileSync(generatedImagePath, candidatePreviewPath)

  const reviewReportSha256 = sha256String(vj2ReportRaw)
  const runtimeSaveSha256 = sha256String(runtimeSaveRaw)
  const binding = {
    schemaVersion: "natural-home-approved-frame-candidate-binding-v1",
    stageId: "natural-home-v91-approved-frame-candidate-binding",
    generatedAt,
    status: "approved_frame_candidate_bound",
    displayAllowed: false,
    canShowToPlayer: false,
    canPromoteToWorld: false,
    approvedFrameStatus: "candidate_binding_review_only",
    candidateId,
    worldBinding: {
      ownerId: runtimeSaveRecord.ownerId,
      worldId: runtimeSaveRecord.worldId,
      tick: runtimeSaveRecord.tick,
      savedAt: runtimeSaveRecord.savedAt,
      sourceFactIds,
      sourceFactIdCount: sourceFactIds.length,
      runtimeSavePath: normalizeRelative(runtimeSavePath),
      runtimeSaveSha256,
      factSource: "world_runtime_save_record",
    },
    visualCandidate: {
      sampleId: bestCandidate.sampleId,
      score: bestCandidate.score,
      vj2Status: bestCandidate.vj2Status,
      generatedImagePath: normalizeRelative(generatedImagePath),
      targetPath: targetPath ? normalizeRelative(targetPath) : null,
      blueprintPath: normalizeRelative(blueprintPath),
      candidatePreviewPath: normalizeRelative(candidatePreviewPath),
      imageSha256: sha256File(generatedImagePath),
      imageByteLength: imageStats.size,
      imageContentType: "image/png",
      width: imageSize.width,
      height: imageSize.height,
      blueprintSha256: sha256String(blueprintRaw),
      sourceSha256: bestCandidate.sourceSha256,
    },
    reviewBinding: {
      vj2ReportPath: normalizeRelative(vj2ReportPath),
      vj2ReportSha256: reviewReportSha256,
      sourceStageId: vj2Report.stageId,
      summary: vj2Report.summary,
    },
    policy: {
      note:
        "This record only proves that a VJ-2 candidate is bound to the current runtime facts. It does not write ApprovedFrame and must not be displayed in /world.",
      zh:
        "本记录只证明 VJ-2 候选图已绑定当前 runtime 世界事实。它不是正式 ApprovedFrame，不能进入 /world 展示。",
    },
    nextRequiredStep: {
      zh: "下一步必须执行正式 ApprovedFrame 写入闸门，重新校验 image hash、review hash、worldId、tick、sourceFactIds。",
      en:
        "Next, the formal ApprovedFrame write gate must re-check image hash, review hash, worldId, tick, and sourceFactIds.",
    },
    tags: [
      "natural_home_current_mvp",
      "approved_frame_candidate_binding",
      "world_fact_bound",
      "not_display_allowed",
      "approved_frame_not_written",
    ],
  }

  const latestPath = path.join(outputRoot, "latest.json")
  const reportPath = path.join(outputRoot, "binding-report.json")
  fs.writeFileSync(latestPath, `${JSON.stringify(binding, null, 2)}\n`, "utf8")
  fs.writeFileSync(reportPath, `${JSON.stringify(binding, null, 2)}\n`, "utf8")

  return binding
}

const report = buildBindingReport()
console.log(
  [
    "Natural Home ApprovedFrame candidate binding completed.",
    `candidateId=${report.candidateId}`,
    `worldId=${report.worldBinding.worldId}`,
    `tick=${report.worldBinding.tick}`,
    `sourceFactIds=${report.worldBinding.sourceFactIdCount}`,
    `imageSha256=${report.visualCandidate.imageSha256}`,
  ].join("\n"),
)
