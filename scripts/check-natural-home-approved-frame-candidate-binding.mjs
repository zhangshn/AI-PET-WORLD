import fs from "node:fs"
import path from "node:path"

const reportRoot = path.resolve(
  process.argv[2] ?? ".runtime/ai-painter/natural-home-v91-approved-frame-candidate-binding",
)
const expectedStageId =
  process.argv[3] ?? "natural-home-v91-approved-frame-candidate-binding"
const reportPath = path.join(reportRoot, "latest.json")
const previewPath = path.join(reportRoot, "candidate-preview.png")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
}

const report = readJson(reportPath)

assert(
  report.schemaVersion === "natural-home-approved-frame-candidate-binding-v1",
  "unexpected binding schema",
)
assert(report.stageId === expectedStageId, "unexpected binding stageId")
assert(report.status === "approved_frame_candidate_bound", "candidate binding did not complete")
assert(report.displayAllowed === false, "candidate binding must not be display allowed")
assert(report.canShowToPlayer === false, "candidate binding must not be player visible")
assert(report.canPromoteToWorld === false, "candidate binding must not promote directly to world")
assert(
  report.approvedFrameStatus === "candidate_binding_review_only",
  "binding report must not claim ApprovedFrame has been written",
)
assert(fs.existsSync(previewPath), "missing candidate preview image")

assert(report.worldBinding && typeof report.worldBinding === "object", "missing world binding")
assert(typeof report.worldBinding.ownerId === "string", "missing ownerId")
assert(typeof report.worldBinding.worldId === "string", "missing worldId")
assert(typeof report.worldBinding.tick === "number", "missing tick")
assert(Array.isArray(report.worldBinding.sourceFactIds), "missing sourceFactIds")
assert(report.worldBinding.sourceFactIds.length > 0, "sourceFactIds cannot be empty")
assert(
  report.worldBinding.sourceFactIdCount === report.worldBinding.sourceFactIds.length,
  "sourceFactIdCount mismatch",
)
assert(isSha256(report.worldBinding.runtimeSaveSha256), "invalid runtime save sha256")

assert(report.visualCandidate && typeof report.visualCandidate === "object", "missing visual candidate")
assert(report.visualCandidate.vj2Status === "vj_2_passed_minimal", "candidate must pass minimal VJ-2")
assert(report.visualCandidate.imageContentType === "image/png", "candidate must be PNG")
assert(report.visualCandidate.width > 0 && report.visualCandidate.height > 0, "invalid PNG size")
assert(report.visualCandidate.imageByteLength > 0, "invalid image byte length")
assert(isSha256(report.visualCandidate.imageSha256), "invalid image sha256")
assert(isSha256(report.visualCandidate.blueprintSha256), "invalid blueprint sha256")
assert(
  typeof report.visualCandidate.generatedImagePath === "string" &&
    fs.existsSync(path.resolve(report.visualCandidate.generatedImagePath)),
  "generated image path is not readable",
)
assert(
  typeof report.visualCandidate.blueprintPath === "string" &&
    fs.existsSync(path.resolve(report.visualCandidate.blueprintPath)),
  "blueprint path is not readable",
)

assert(report.reviewBinding && typeof report.reviewBinding === "object", "missing review binding")
assert(isSha256(report.reviewBinding.vj2ReportSha256), "invalid VJ-2 review sha256")
assert(report.reviewBinding.sourceStageId === "natural-home-v91-current-mvp-vj2-review", "unexpected VJ-2 source stage")
assert(report.reviewBinding.summary?.vj2PassedCount > 0, "VJ-2 passed count must be positive")

assert(
  Array.isArray(report.tags) &&
    report.tags.includes("not_display_allowed") &&
    report.tags.includes("approved_frame_not_written"),
  "binding tags must preserve non-display boundary",
)

console.log(
  `ApprovedFrame candidate binding check passed: ${report.candidateId}, ${report.worldBinding.sourceFactIdCount} source facts.`,
)
