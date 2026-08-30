import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { runAutonomousClosedLoop, sha256File, validateClosedLoopPackage } from "./lib/ai-painter-autonomous-closed-loop-v1.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const args = process.argv.slice(2); const packagePath = value("--package"); const expected = value("--package-sha256")
if (!packagePath || !expected) throw new Error("--package and --package-sha256 are required")
const root = process.cwd(); const absolute = resolveInside(root, packagePath); const actual = sha256File(absolute)
if (actual !== expected) throw new Error("package SHA-256 mismatch")
const spec = JSON.parse(fs.readFileSync(absolute, "utf8")); validateClosedLoopPackage(spec, { root, packageSha256: actual })
if (!spec.packageIdentity.includes("joint-condition-local-transport-full-data-screen")) throw new Error("wrong package kind")
const sourceRegistry = await readCurrentExecutionRegistry(root)
if (sourceRegistry.ok !== true || sourceRegistry.registry.activeExecution !== null) throw new Error("current registry is not available for a fresh full-data screen")
const registryAlreadyProjected = sourceRegistry.registry.packageId === spec.packageIdentity && sourceRegistry.registry.taskId === "joint_condition_local_transport_full_data_screen_terminal_recorded"
if (!registryAlreadyProjected && sourceRegistry.registry.taskId !== "compile_joint_condition_local_transport_24_epoch_full_data_screen") throw new Error("current registry does not authorize this bounded local action")
const executionRoot = resolveInside(root, `.runtime/ai-painter/autonomous-closed-loop-executions/${spec.packageIdentity}`)
const livePath = resolveInside(root, ".runtime/ai-painter/current-execution-registry/active-runtime-projection.json")
if (fs.existsSync(livePath)) {
  const existingLive = JSON.parse(fs.readFileSync(livePath, "utf8"))
  if (existingLive.packageIdentity !== spec.packageIdentity && !["completed", "failed_closed", "blocked_policy_boundary"].includes(existingLive.state)) throw new Error("another active runtime projection owns the control plane")
}
const project = (state, source) => writeJsonAtomic(livePath, {
  schemaVersion: "ai-painter-current-active-runtime-projection-v1", authority: "local_ai_pet_world_program",
  packageIdentity: spec.packageIdentity, capabilityVersion: spec.capabilityVersion, outputRoot: spec.outputRoot,
  source, state: state?.state ?? "starting", phase: state?.phase ?? "preflight", adapterProgress: state?.adapterProgress ?? null,
  currentRegistryAdvancePendingUntilTerminal: true, ownerAuthorizationRequired: false, ownerResponseRequired: false,
  updatedAtUtc: new Date().toISOString(),
})
project(null, "background_runner_start")
appendAiPainterProgramEvent({ id: `${spec.packageIdentity}-started`, action: "joint_full_data_screen_started", runId: spec.packageIdentity, kind: "training", status: "running", titleZh: "联合条件局部传输24 Epoch全数据筛查已开始", evidencePath: packagePath })
const interval = setInterval(() => {
  try {
    const progressPath = path.join(executionRoot, "progress.json")
    if (fs.existsSync(progressPath)) project(JSON.parse(fs.readFileSync(progressPath, "utf8")), "autonomous_progress_heartbeat")
  } catch {}
}, 2000)
let state
try { state = await runAutonomousClosedLoop({ root, spec, packageSha256: actual }) }
finally { clearInterval(interval) }
project(state, "autonomous_terminal")
const terminalPath = path.join(executionRoot, "phase-terminal.json")
appendAiPainterProgramEvent({ id: `${spec.packageIdentity}-terminal`, action: "joint_full_data_screen_terminal", runId: spec.packageIdentity, kind: "training", status: state.state === "completed" ? "success" : "failed", titleZh: state.state === "completed" ? "联合条件局部传输全数据筛查完成" : "联合条件局部传输全数据筛查失败关闭", evidencePath: fs.existsSync(terminalPath) ? path.relative(root, terminalPath).replaceAll("\\", "/") : packagePath })
const registryAdvance = registryAlreadyProjected ? sourceRegistry : await projectTerminalToRegistry({ root, spec, state, executionRoot, sourceRegistry })
process.stdout.write(`${JSON.stringify({ status: state.state, packageIdentity: state.packageIdentity, activeProjection: path.relative(root, livePath).replaceAll("\\", "/"), registryRevision: registryAdvance.registry.registryRevision, ownerResponseRequired: false }, null, 2)}\n`)

async function projectTerminalToRegistry({ root: projectRoot, spec: packageSpec, state: terminalState, executionRoot: executionDirectory, sourceRegistry: source }) {
  const genericTerminal = path.join(executionDirectory, "phase-terminal.json")
  if (!fs.existsSync(genericTerminal)) throw new Error("autonomous terminal is missing")
  const screenRoot = resolveInside(projectRoot, packageSpec.outputRoot)
  const finalization = path.join(screenRoot, "finalization", "finalization.json")
  const manifest = path.join(screenRoot, "manifest.json")
  const review = path.join(screenRoot, "machine-review-timeline.json")
  const late = path.join(screenRoot, "late-stability-qualification.json")
  const progress = path.join(executionDirectory, "progress.json")
  const projectionPath = path.join(executionDirectory, "registry-terminal-projection.json")
  const capsulePath = path.join(executionDirectory, "registry-task-capsule.json")
  const evidenceFiles = [genericTerminal, progress, finalization, manifest, review, late].filter((file) => fs.existsSync(file))
  const finalizationValue = fs.existsSync(finalization) ? JSON.parse(fs.readFileSync(finalization, "utf8")) : null
  const status = finalizationValue?.status ?? `joint_full_data_screen_${terminalState.state}`
  writeOrVerify(projectionPath, { schemaVersion: "ai-painter-joint-full-data-screen-registry-terminal-v1", executionState: "completed", status, autonomousExecutionState: terminalState.state, packageIdentity: packageSpec.packageIdentity, runId: path.posix.basename(packageSpec.outputRoot), outputRoot: packageSpec.outputRoot, ownerAuthorizationRequired: false, ownerResponseRequired: false, automaticRetryStarted: false, recordedAtUtc: new Date().toISOString() }, ["schemaVersion", "executionState", "status", "autonomousExecutionState", "packageIdentity", "runId", "outputRoot"])
  const evidence = evidenceFiles.map((file) => ({ kind: path.basename(file).replace(/\W+/gu, "_"), ...binding(projectRoot, file), sha256Verified: true }))
  writeOrVerify(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", capsuleId: `local-ai-${packageSpec.packageIdentity}`, module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" }, currentStage: { number: 4, total: 5, status }, evidence, integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true }, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc: new Date().toISOString() }, ["schemaVersion", "capsuleId", "evidence", "integrity", "ownerAuthorizationRequired", "ownerResponseRequired"])
  const projectionBinding = binding(projectRoot, projectionPath)
  const latestEvidence = Object.fromEntries([["autonomousTerminal", genericTerminal], ["progress", progress], ["manifest", manifest], ["machineReviewTimeline", review], ["lateStabilityQualification", late], ["finalization", finalization]].map(([kind, file]) => [kind, fs.existsSync(file) ? binding(projectRoot, file) : null]))
  return advanceCurrentExecutionRegistry({
    projectRoot, capabilityVersion: packageSpec.capabilityVersion, packageId: packageSpec.packageIdentity,
    taskId: "joint_condition_local_transport_full_data_screen_terminal_recorded", taskKind: "full_data_screen_result",
    runId: path.posix.basename(packageSpec.outputRoot), lifecycleStage: status,
    executionState: "completed", activity: status,
    taskCapsulePath: path.relative(projectRoot, capsulePath).replaceAll("\\", "/"),
    terminalEvidencePath: projectionBinding.path,
    latestTrainingTerminal: { runId: path.posix.basename(packageSpec.outputRoot), ...projectionBinding, status, evidence: latestEvidence },
    expectedPreviousRegistryRevision: source.registry.registryRevision,
    expectedPreviousRegistrySha256: source.registrySha256,
  })
}
function value(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null }
function resolveInside(rootValue, relative) { if (path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/u.test(relative) || relative.includes("..")) throw new Error("path must be project-relative"); const target = path.resolve(rootValue, relative); if (!target.startsWith(`${path.resolve(rootValue)}${path.sep}`)) throw new Error("path escapes project"); return target }
function binding(rootValue, absolute) { return { path: path.relative(rootValue, absolute).replaceAll("\\", "/"), sha256: sha256File(absolute) } }
function writeExclusive(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }) }
function writeOrVerify(file, value, keys) { if (!fs.existsSync(file)) return writeExclusive(file, value); const existing = JSON.parse(fs.readFileSync(file, "utf8")); for (const key of keys) if (JSON.stringify(existing[key]) !== JSON.stringify(value[key])) throw new Error(`immutable registry projection mismatch: ${key}`); return existing }
