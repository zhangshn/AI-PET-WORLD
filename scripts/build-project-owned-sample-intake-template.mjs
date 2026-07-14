import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-sample-intake")
const pointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
assert(pointer?.taskPath, "current world visual task package is missing")
const task = readJson(pointer.taskPath)
const conditionPackPath = path.join(path.dirname(resolveProjectPath(pointer.taskPath)), "compiled-conditions", "condition-pack.json")
assert(fs.existsSync(conditionPackPath), "current 23-channel condition pack is missing")
const conditionPack = JSON.parse(fs.readFileSync(conditionPackPath, "utf8"))
assert(conditionPack.taskId === task.taskId, "condition pack is not bound to current task")

const timestamp = new Date().toISOString()
const intakeId = `project-owned-sample-intake-${timestamp.replace(/[:.]/g, "-")}`
const intakeDir = path.join(OUTPUT_ROOT, intakeId)
const templatePath = path.join(intakeDir, "registration-request-template.json")
const template = {
  schemaVersion: "complete-map-sample-registration-request-v1",
  templateStatus: "requires_original_rgb_review_and_ip_evidence",
  sampleType: "complete_map_positive",
  sourceType: "owner_created",
  imagePath: "REQUIRED_PROJECT_OWNED_COMPLETE_MAP_RGB.png",
  sourcePath: "REQUIRED_ORIGINAL_LAYERED_SOURCE_FILE.psd",
  sourceLicense: {
    status: "project_owned",
    rightsHolderId: "REQUIRED_LEGAL_RIGHTS_HOLDER_ID",
  },
  dictionaryVersionId: task.dictionaryVersionId,
  split: "train",
  blueprintHash: task.taskSha256,
  conditionHashes: conditionPack.channels.map((channel) => channel.sha256),
  conditionPackPath: projectPath(conditionPackPath),
  directorPlanId: task.directorPlan?.planId ?? task.taskId,
  taskPackageId: task.taskId,
  trainingUsage: "positive",
  machineReviewStatus: "pending_machine_review",
  ownerReviewStatus: "pending_owner_review",
  ownerApproval: { status: "pending_owner_review" },
  visualTags: ["REQUIRED_AFTER_VISUAL_REVIEW"],
  qualityTags: ["REQUIRED_AFTER_VISUAL_REVIEW"],
  independentTrainingEligible: true,
  trainingDataProvenance: "independent-training-eligible",
  ipProvenance: {
    policyVersion: "strict-project-owned-training-data-v1",
    rightsHolderId: "REQUIRED_LEGAL_RIGHTS_HOLDER_ID",
    creationMethod: "project_owner_original_human_created",
    thirdPartyContentUsed: false,
    thirdPartyGenerativeModelUsed: false,
    copiedFromExistingWork: false,
    worldwideCommercialRights: true,
    modelTrainingRights: true,
    derivativeWorksRights: true,
    transferAndSublicenseRights: true,
    evidencePaths: ["REQUIRED_ORIGINAL_CREATION_EVIDENCE_FILE"],
    reviewStatus: "pending_owner_ip_review",
    reviewedBy: "REQUIRED_OWNER_REVIEWER_ID",
    reviewedAtUtc: null,
  },
  requiredBeforeRegistration: [
    "replace all REQUIRED_* placeholders with project files or legal identities",
    "complete machine review",
    "complete owner visual review",
    "complete owner IP provenance review",
    "do not change third-party flags to false unless evidence proves the claim",
  ],
  generatedAtUtc: timestamp,
  generatedAtAsiaShanghai: formatShanghai(timestamp),
  automaticStorage: true,
}

fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(intakeDir, { recursive: false })
writeJson(templatePath, template)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "project-owned-sample-intake-latest-v1",
  intakeId,
  status: template.templateStatus,
  taskId: task.taskId,
  conditionPackId: conditionPack.conditionPackId,
  templatePath: projectPath(templatePath),
  generatedAtUtc: timestamp,
  generatedAtAsiaShanghai: template.generatedAtAsiaShanghai,
  automaticStorage: true,
})

console.log(JSON.stringify({
  status: template.templateStatus,
  intakeId,
  taskId: task.taskId,
  conditionPackId: conditionPack.conditionPackId,
  templatePath: projectPath(templatePath),
  registeredSampleCreated: false,
}, null, 2))

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
