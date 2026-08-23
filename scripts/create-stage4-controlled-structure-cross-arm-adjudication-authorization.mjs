import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const arg = (name) => {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`)
  return process.argv[index + 1]
}
const runId = arg("--run-id")
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId)) throw new Error("runId is invalid")
const files = {
  contract: absolute(arg("--contract")),
  fusionRoot: absolute(arg("--fusion-root")),
  capacityRoot: absolute(arg("--capacity-root")),
  fusionQualification: absolute(arg("--fusion-qualification")),
  capacityQualification: absolute(arg("--capacity-qualification")),
  runner: absolute("scripts/run-stage4-controlled-structure-cross-arm-adjudication.mjs"),
}
const supersedesArgumentIndex = process.argv.indexOf("--supersedes")
const supersedes = supersedesArgumentIndex >= 0 && process.argv[supersedesArgumentIndex + 1]
  ? absolute(process.argv[supersedesArgumentIndex + 1])
  : null
if (supersedes && !fs.existsSync(supersedes)) throw new Error("superseded adjudication evidence is missing")
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`missing ${name}: ${relative(file)}`)
}
const contract = read(files.contract)
if (
  contract.schemaVersion !== "stage4-controlled-structure-cross-arm-result-adjudication-contract-v1"
  || contract.status !== "compiled_inactive_waiting_two_new_smoke_terminals"
  || JSON.stringify(contract.allowedOutcomes) !== JSON.stringify([
    "condition_fusion_only_priority",
    "capacity_only_priority",
    "both_arms_not_qualified_for_stage0",
    "controlled_arm_evidence_conflict",
  ])
) throw new Error("cross arm contract identity invalid")
const expectedRoots = [
  readAbsolute(contract.smokeContracts.fusion.path).futureEvidenceNamespace.outputDirectory,
  readAbsolute(contract.smokeContracts.capacity.path).futureEvidenceNamespace.outputDirectory,
].map(absolute)
if (files.fusionRoot !== expectedRoots[0] || files.capacityRoot !== expectedRoots[1]) {
  throw new Error("cross arm smoke roots do not match compiled contracts")
}
for (const [name, root] of [["fusion", files.fusionRoot], ["capacity", files.capacityRoot]]) {
  for (const leaf of ["phase-terminal.json", "manifest.json", "machine-review-timeline.json", "finalization/finalization.json", "training-output/manifest.json", "training-output/fixed-preview-reviews.json"]) {
    if (!fs.existsSync(path.join(root, leaf))) throw new Error(`${name} evidence missing: ${leaf}`)
  }
}
for (const name of ["fusionQualification", "capacityQualification"]) {
  if (read(files[name]).status !== "terminal_pass_with_late_convergence_evidence_qualified_closed") {
    throw new Error(`${name} is not qualified`)
  }
}
const output = absolute(`.runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/${runId}`)
const authorizationRoot = absolute(`.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-cross-arm-adjudication-${runId}`)
if (fs.existsSync(output) || fs.existsSync(authorizationRoot)) throw new Error("fresh adjudication namespace required")
const requestId = `owner-authorized-stage4-controlled-structure-cross-arm-adjudication-${runId}`
const authorizationPath = path.join(authorizationRoot, "implementation-authorization.json")
const evidence = {
  contract: bind(files.contract),
  fusion: evidenceBindings(files.fusionRoot),
  capacity: evidenceBindings(files.capacityRoot),
  fusionQualification: bind(files.fusionQualification),
  capacityQualification: bind(files.capacityQualification),
  ...(supersedes ? { supersededAdjudication: bind(supersedes) } : {}),
}
const authorization = {
  schemaVersion: "owner-authorized-stage4-controlled-structure-cross-arm-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  scope: "cpu_readonly_adjudicate_two_completed_controlled_structure_smokes_only",
  allowedOutcomes: contract.allowedOutcomes,
  sourceEvidence: evidence,
  runner: bind(files.runner),
  outputDirectory: relative(output),
  oneTimeConsumption: true,
  explicitlyDeniedActions: ["read_checkpoint_weights", "start_gpu", "create_optimizer", "backward", "train", "start_stage0", "change_thresholds"],
  issuedAtUtc: new Date().toISOString(),
}
fs.mkdirSync(authorizationRoot, { recursive: false })
writeExclusive(authorizationPath, authorization)
console.log(JSON.stringify({ status: "created", authorization: bind(authorizationPath), outputDirectory: relative(output) }, null, 2))

function evidenceBindings(root) {
  return Object.fromEntries([
    ["terminal", "phase-terminal.json"],
    ["manifest", "manifest.json"],
    ["review", "machine-review-timeline.json"],
    ["finalization", "finalization/finalization.json"],
    ["trainerManifest", "training-output/manifest.json"],
    ["trainerReview", "training-output/fixed-preview-reviews.json"],
  ].map(([name, leaf]) => [name, bind(path.join(root, leaf))]))
}
function absolute(value) { return path.resolve(ROOT, value) }
function relative(value) { return path.relative(ROOT, value).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function readAbsolute(value) { const file = absolute(value); if (!fs.existsSync(file)) throw new Error(`missing contract: ${value}`); return read(file) }
function hash(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: relative(value), sha256: hash(value) } }
function writeExclusive(value, body) {
  const handle = fs.openSync(value, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}
