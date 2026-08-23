import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import { runChecks } from "./check-stage4-controlled-three-component-smoke-review-recovery.mjs"
import { reviewFinalPreviews, validateControlledThreeComponentSourceIndex } from "./run-stage4-controlled-three-component-stage0-smoke.mjs"

const ROOT = process.cwd()
const PACKAGE_PARENT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smokes")
const RECOVERY_PARENT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-review-recoveries")
const SOURCE_INDEX = path.resolve(ROOT, "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json")
const CONTRACT = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-contract-compilations/20260824-023500000/controlled-three-component-stage0-smoke-contract.json")
const FINAL_ROLE = "3-global-visual-harmonization-native-complete-rgb-decode"
const EXPECTED_PREVIEW_EPOCHS = [1, 5, 10, 20, 30]

export async function runReviewRecovery(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (!args.packageId || !args.expectedTerminalSha256) throw new Error("package_id_and_expected_terminal_sha256_required")
  if (!/^[a-zA-Z0-9._-]+$/.test(args.packageId)) throw new Error("package_id_invalid")
  if (!/^[0-9a-f]{64}$/.test(args.expectedTerminalSha256)) throw new Error("expected_terminal_sha256_invalid")

  const packageRoot = path.join(PACKAGE_PARENT, args.packageId)
  assertInside(packageRoot, PACKAGE_PARENT)
  const sourceTerminalPath = path.join(packageRoot, "phase-terminal.json")
  assertFileHash(sourceTerminalPath, args.expectedTerminalSha256)
  const sourceTerminal = readJson(sourceTerminalPath)
  if (sourceTerminal.status !== "stage4_controlled_three_component_stage0_smoke_execution_failed_closed" || sourceTerminal.error !== "rows.find is not a function") {
    throw new Error("source_terminal_not_the_bound_review_entry_failure")
  }

  const contract = readJson(CONTRACT)
  const sourceIndexIdentity = validateControlledThreeComponentSourceIndex(readJson(SOURCE_INDEX))
  const finalTrainingOutput = path.join(packageRoot, FINAL_ROLE, "training-output")
  const finalManifestPath = path.join(finalTrainingOutput, "manifest.json")
  const finalManifest = readJson(finalManifestPath)
  validateCompletedTrainingEvidence(packageRoot, finalManifest, finalTrainingOutput)

  const immutableBefore = captureImmutableEvidence(sourceTerminalPath, finalManifestPath, finalTrainingOutput)
  const runId = args.runId ?? timestampId()
  if (!/^[0-9]{8}-[0-9]{9}$/.test(runId)) throw new Error("review_recovery_run_id_invalid")
  fs.mkdirSync(RECOVERY_PARENT, { recursive: true })
  const runRoot = path.join(RECOVERY_PARENT, runId)
  if (fs.existsSync(runRoot)) throw new Error("review_recovery_output_reuse_rejected")
  fs.mkdirSync(runRoot)

  const actionPath = path.join(runRoot, "same-package-readonly-review-action.json")
  writeJsonAtomic(actionPath, {
    schemaVersion: "stage4-controlled-three-component-smoke-same-package-readonly-review-action-v1",
    status: "active_internal_closure_action_not_new_owner_authorization",
    packageId: args.packageId,
    sourceFailureTerminal: bind(sourceTerminalPath),
    scope: "review_five_existing_immutable_fixed_previews_only",
    sourceIndex: bind(SOURCE_INDEX),
    fixedSampleIdentity: { sampleId: sourceIndexIdentity.sample.sampleId, split: sourceIndexIdentity.sample.split },
    ownerSignatureRequiredAgain: false,
    reason: "fixed_preview_machine_review_was_declared_inside_the_original_smoke_package_and_failed_before_visual_adjudication_due_to_a_source_index_reader_defect",
    prohibitions: { checkpointWeightsRead: false, gpuStart: false, optimizerCreate: false, backward: false, training: false, previewRegeneration: false },
    createdAtUtc: new Date().toISOString(),
  })

  let report
  let cpuReport
  try {
    cpuReport = runChecks()
    if (cpuReport.status !== "passed") throw new Error("review_recovery_cpu_contract_failed")
    const cpuReportPath = path.join(runRoot, "cpu-report.json")
    writeJsonAtomic(cpuReportPath, cpuReport)
    report = await reviewFinalPreviews(finalTrainingOutput, contract, path.join(runRoot, "machine-review"))
    assertImmutableEvidenceUnchanged(immutableBefore)
    return finalize({ runId, runRoot, packageRoot, sourceTerminalPath, finalManifestPath, finalTrainingOutput, actionPath, cpuReportPath, report })
  } catch (error) {
    assertImmutableEvidenceUnchanged(immutableBefore)
    const failurePath = path.join(runRoot, "failure-report.json")
    writeJsonAtomic(failurePath, {
      schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-failure-v1",
      status: "failed_closed",
      error: String(error?.message ?? error),
      packageId: args.packageId,
      sourceFailureTerminal: bind(sourceTerminalPath),
      trainingRestarted: false,
      checkpointWeightsRead: false,
      recordedAtUtc: new Date().toISOString(),
    })
    const terminalPath = path.join(runRoot, "phase-terminal.json")
    writeJsonAtomic(terminalPath, { schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-terminal-v1", status: "review_recovery_failed_closed", failureReport: bind(failurePath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: new Date().toISOString() })
    indexRunArtifacts(runRoot, runId)
    appendAiPainterProgramEvent({ id: `stage4-controlled-three-component-smoke-review-recovery-${runId}`, timestamp: new Date().toISOString(), action: "stage4_controlled_three_component_smoke_review_recovery", runId, kind: "cpu_machine_review", status: "failed", title: "Stage4 controlled three-component Smoke review recovery", titleZh: "Stage4受控三组件Smoke机器审核恢复", detailZh: "只读审核恢复发生基础设施失败并安全关闭；训练未重启。", evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
    throw error
  }
}

function finalize({ runId, runRoot, packageRoot, sourceTerminalPath, finalManifestPath, finalTrainingOutput, actionPath, cpuReportPath, report }) {
  const allPassed = report.previewCount === 5 && report.previewPassCount === 5
  const ownerRequestPath = path.join(runRoot, "owner-action-request.json")
  writeJsonAtomic(ownerRequestPath, {
    schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-owner-action-request-v1",
    status: allPassed ? "owner_action_requested" : "route_decision_requested_after_real_visual_failure",
    nextAction: allPassed ? "cpu_readonly_late_stability_qualification_for_controlled_three_component_smoke" : "owner_route_decision_after_controlled_three_component_smoke_real_visual_failure",
    automaticStage0Authorized: false,
    automaticTrainingRetryAuthorized: false,
    machineReview: { path: report.path, sha256: report.sha256 },
    createdAtUtc: new Date().toISOString(),
  })
  const finalizationPath = path.join(runRoot, "finalization.json")
  writeJsonAtomic(finalizationPath, {
    schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-finalization-v1",
    status: allPassed ? "machine_review_completed_all_fixed_previews_passed" : "machine_review_completed_real_visual_failure",
    sourcePackageRoot: relative(packageRoot),
    sourceFailureTerminal: bind(sourceTerminalPath),
    sourceManifest: bind(finalManifestPath),
    samePackageReadonlyReviewAction: bind(actionPath),
    cpuReport: bind(cpuReportPath),
    machineReview: { path: report.path, sha256: report.sha256 },
    sourceTrainingOutput: relative(finalTrainingOutput),
    trainingRestarted: false,
    checkpointWeightsRead: false,
    previewRegenerated: false,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: new Date().toISOString(),
  })
  const terminalPath = path.join(runRoot, "phase-terminal.json")
  writeJsonAtomic(terminalPath, {
    schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-terminal-v1",
    status: allPassed ? "machine_review_passed_pending_cpu_readonly_late_stability_qualification" : "machine_review_real_visual_failure_failed_closed",
    finalization: bind(finalizationPath),
    machineReview: { path: report.path, sha256: report.sha256 },
    ownerActionRequest: bind(ownerRequestPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: new Date().toISOString(),
  })
  const capsulePath = path.join(runRoot, "local-task-capsule.json")
  writeJsonAtomic(capsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter R5",
    currentStage: "Stage4 controlled three-component Stage0 Smoke machine review",
    status: allPassed ? "machine_review_passed_pending_late_stability" : "real_visual_failure_failed_closed",
    latestTerminal: bind(terminalPath),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: allPassed ? "cpu_readonly_late_stability_qualification" : "owner_route_decision_only",
    recordedAtUtc: new Date().toISOString(),
  })
  updatePlan(allPassed, report)
  const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const planSyncPath = path.join(runRoot, "plan-sync-record.json")
  writeJsonAtomic(planSyncPath, { schemaVersion: "stage4-controlled-three-component-smoke-review-recovery-plan-sync-v1", status: "synced", plan: bind(planPath), terminal: bind(terminalPath), recordedAtUtc: new Date().toISOString() })
  indexRunArtifacts(runRoot, runId)
  appendAiPainterProgramEvent({ id: `stage4-controlled-three-component-smoke-review-recovery-${runId}`, timestamp: new Date().toISOString(), action: "stage4_controlled_three_component_smoke_review_recovery", runId, kind: "cpu_machine_review", status: allPassed ? "success" : "failed", title: "Stage4 controlled three-component Smoke machine review", titleZh: "Stage4受控三组件Smoke机器审核", detailZh: allPassed ? "五张固定预览全部通过；等待CPU只读后期稳定资格。" : `五张固定预览通过 ${report.previewPassCount}/5；已保存真实视觉失败并关闭。`, evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  process.stdout.write(`${JSON.stringify({ status: readJson(terminalPath).status, terminal: bind(terminalPath), finalization: bind(finalizationPath), machineReview: { path: report.path, sha256: report.sha256, passed: report.previewPassCount, failed: report.previewFailCount }, nextAction: readJson(ownerRequestPath).nextAction }, null, 2)}\n`)
  return allPassed ? 0 : 2
}

function validateCompletedTrainingEvidence(packageRoot, finalManifest, finalTrainingOutput) {
  const roleManifests = [
    path.join(packageRoot, "1-terrain-route-hydrology-spatial-realization/training-output/manifest.json"),
    path.join(packageRoot, "2-per-class-object-semantic-realization/training-output/manifest.json"),
    path.join(packageRoot, `${FINAL_ROLE}/training-output/manifest.json`),
  ].map(readJson)
  if (roleManifests.some((manifest) => manifest.status !== "component_smoke_training_completed" || manifest.epochCount !== 30 || !Array.isArray(manifest.metrics) || manifest.metrics.length !== 30 || manifest.modelStateHashes?.weightsChanged !== true)) throw new Error("three_component_training_completion_evidence_invalid")
  if (!Array.isArray(finalManifest.fixedPreviews) || finalManifest.fixedPreviews.length !== 5) throw new Error("final_component_fixed_preview_manifest_invalid")
  const epochs = finalManifest.fixedPreviews.map((row) => Number(path.basename(row.path).match(/^epoch-(\d+)/)?.[1]))
  if (JSON.stringify(epochs) !== JSON.stringify(EXPECTED_PREVIEW_EPOCHS)) throw new Error("final_component_preview_schedule_invalid")
  for (const preview of finalManifest.fixedPreviews) {
    const previewPath = path.resolve(ROOT, preview.path)
    assertInside(previewPath, path.join(finalTrainingOutput, "fixed-epoch-previews"))
    assertFileHash(previewPath, preview.sha256)
    if (preview.byteExactReproduced !== true) throw new Error("fixed_preview_byte_reproduction_invalid")
  }
}

function captureImmutableEvidence(sourceTerminalPath, finalManifestPath, finalTrainingOutput) {
  const previewRoot = path.join(finalTrainingOutput, "fixed-epoch-previews")
  return [sourceTerminalPath, finalManifestPath, ...fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort().map((name) => path.join(previewRoot, name))].map((filePath) => ({ path: filePath, sha256: sha(filePath) }))
}

function assertImmutableEvidenceUnchanged(evidence) {
  for (const item of evidence) assertFileHash(item.path, item.sha256)
}

function updatePlan(allPassed, report) {
  const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  let text = fs.readFileSync(planPath, "utf8")
  const currentStatus = allPassed ? "五张固定预览机器审核全部通过，等待CPU只读后期稳定资格" : `五张固定预览机器审核通过${report.previewPassCount}/5，真实视觉失败已关闭`
  text = text.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(new Date().toISOString()).replace("T", " ").replace("+08:00", " +08:00")}`)
  text = text.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4受控三组件Stage 0 Smoke${currentStatus}`)
  const recent = allPassed
    ? "受控三组件Stage 0 Smoke的三个组件均已自然完成30 Epoch，五张既有固定预览已经由同包本地机器审核全部验证通过。原训练失败终态保持不可变；本次只读恢复未重跑训练、读取Checkpoint或重新生成预览。"
    : `受控三组件Stage 0 Smoke的三个组件均已自然完成30 Epoch。本地机器审核已完成，五张既有固定预览通过${report.previewPassCount}/5；该结果属于真实视觉失败，训练与审核证据均保持不可变。`
  const next = allPassed
    ? "当前唯一下一动作是对已完成的五节点审核时间线执行CPU只读后期稳定资格；通过后才能形成新的Stage 0动作请求，不能自动启动训练。"
    : "当前Smoke已因真实视觉失败关闭。唯一下一动作是Owner路线决策；不得自动重跑、调参、降低阈值或启动Stage 0/1/2。"
  text = text.replace(/## 4\. 最近一次模块终态[\s\S]*?## 5\. 当前阻断与唯一下一动作[\s\S]*?(?=## 6\.)/, `## 4. 最近一次模块终态\n\n${recent}\n\n## 5. 当前阻断与唯一下一动作\n\n${next}\n\n`)
  const temp = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temp, text, "utf8"); fs.renameSync(temp, planPath)
}

function indexRunArtifacts(runRoot, runId) {
  for (const filePath of walkFiles(runRoot)) {
    const info = fs.statSync(filePath)
    indexArtifact({ logicalPath: logicalProjectPath(filePath), physicalUri: fs.realpathSync(filePath), storageLayer: "hot", runId, byteSize: info.size, modifiedAtUtc: info.mtime.toISOString(), sha256: sha(filePath) })
  }
}

function walkFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walkFiles(path.join(root, entry.name)) : [path.join(root, entry.name)])
}

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--package-id") result.packageId = argv[++index]
    else if (argv[index] === "--expected-terminal-sha256") result.expectedTerminalSha256 = argv[++index]
    else if (argv[index] === "--run-id") result.runId = argv[++index]
    else throw new Error(`unknown_argument:${argv[index]}`)
  }
  return result
}

function assertInside(candidate, parent) {
  const relativePath = path.relative(path.resolve(parent), path.resolve(candidate))
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) throw new Error("path_outside_registered_project_namespace")
}
function assertFileHash(filePath, expected) { if (!fs.existsSync(filePath) || sha(filePath) !== expected.toLowerCase()) throw new Error(`immutable_evidence_hash_mismatch:${relative(filePath)}`) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function relative(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function bind(value) { return { path: relative(value), sha256: sha(value) } }
function timestampId() { const now = new Date(); const formatted = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now).replace(/[- :]/g, ""); return `${formatted.slice(0, 8)}-${formatted.slice(8)}${String(now.getMilliseconds()).padStart(3, "0")}` }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)))) {
  try { process.exit(await runReviewRecovery(process.argv.slice(2))) }
  catch (error) { console.error(error?.stack ?? String(error)); process.exit(1) }
}
