import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const RUN_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-game-world-main-runs")
const LEDGER_ROOT = path.join(ROOT, ".runtime", "ai-painter", "training-process-ledger")
const checkOnly = process.argv.includes("--check")
const planOnly = process.argv.includes("--plan") || process.argv.includes("--dry-run")

const timestamp = new Date().toISOString()
const runId = `complete-game-world-main-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(RUN_ROOT, runId)

if (!checkOnly && !planOnly) fs.mkdirSync(runDir, { recursive: true })

const plan = [
  {
    id: "world_visual_dictionary",
    title: "World Visual Data Dictionary",
    command: ["npm", ["run", "check:world-visual-data-dictionary"]],
  },
  {
    id: "complete_map_data_blueprint",
    title: "Complete Map Data Blueprint",
    command: ["npm", ["run", "build:complete-map-data-blueprint"]],
  },
  {
    id: "complete_map_data_sufficiency_audit",
    title: "Complete Map Data Sufficiency Audit",
    command: ["npm", ["run", "audit:complete-map-data-sufficiency"]],
  },
  {
    id: "automatic_visual_judge_learning",
    title: "Automatic Visual Judge Learning Refresh",
    command: ["npm", ["run", "learn:game-map-auto-visual-judge"]],
  },
  {
    id: "visual_learning_feedback_consumer",
    title: "Visual Learning Feedback Consumer",
    command: ["npm", ["run", "consume:game-map-visual-learning-feedback"]],
  },
  {
    id: "world_visual_fact_manifest",
    title: "Current World Visual Fact Manifest",
    command: ["npm", ["run", "build:current-world-visual-fact-manifest"]],
  },
  {
    id: "world_visual_generation_task_package",
    title: "Current World Visual Generation Task Package",
    command: ["npm", ["run", "build:current-world-visual-task-package"]],
  },
  {
    id: "model_training_alignment",
    title: "Model Training Architecture Alignment",
    command: ["npm", ["run", "check:ai-painter-model-training-alignment"]],
  },
  {
    id: "training_data_persistence",
    title: "Training Data Persistence",
    command: ["npm", ["run", "check:ai-painter-training-data-persistence"]],
  },
  {
    id: "admin_backend_automation",
    title: "Admin Backend Automation",
    command: ["npm", ["run", "check:ai-painter-admin-backend-automation"]],
  },
  {
    id: "game_map_runtime_frame_contract",
    title: "Game Map RuntimeFrame Contract",
    command: ["npm", ["run", "check:game-map-frame"]],
  },
]

const readOnlyCheckIds = new Set([
  "world_visual_dictionary",
  "model_training_alignment",
  "training_data_persistence",
  "admin_backend_automation",
  "game_map_runtime_frame_contract",
])
const executionPlan = checkOnly ? plan.filter((step) => readOnlyCheckIds.has(step.id)) : plan

if (planOnly) {
  console.log(JSON.stringify({
    schemaVersion: "complete-game-world-plan-v1",
    mode: "plan_only",
    entrypoint: "npm run run:complete-game-world",
    commandsExecuted: false,
    steps: plan.map((step) => ({
      id: step.id,
      title: step.title,
      command: [step.command[0], ...step.command[1]].join(" "),
      status: "planned_not_executed",
      exitCode: null,
    })),
  }, null, 2))
  process.exit(0)
}

const steps = []
let blocked = false

for (const step of executionPlan) {
  const result = runCommand(step.command[0], step.command[1])
  const passed = result.status === 0
  if (!passed) blocked = true
  steps.push({
    id: step.id,
    title: step.title,
    status: passed ? "passed" : "failed",
    command: [step.command[0], ...step.command[1]].join(" "),
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  })
}

const latestRuntimeFrame = readJson(path.join(ROOT, ".runtime", "game-map-runtime-frame", "latest-runtime-frame.json"))
const runtimeFrame = latestRuntimeFrame?.runtimeFrame ?? null
const compositeOutput = runtimeFrame?.composition?.compositeOutput ?? null
const ownerGate = readOwnerReviewGate(runtimeFrame?.runtimeFrameId, compositeOutput?.imageSha256)
const formalGate = readFormalGate(runtimeFrame)
const dataGapReport = readDataGapReport()
const latestTaskPackage = readJson(
  path.join(ROOT, ".runtime", "ai-painter", "world-visual-generation-task-packages", "latest.json"),
)
const generationPipeline = {
  status: "not_implemented",
  passed: false,
  reason: "complete_world_visual_inference_not_implemented",
  taskPackage: latestTaskPackage
    ? {
        status: "implemented",
        taskId: latestTaskPackage.taskId,
        taskPath: latestTaskPackage.taskPath,
        dictionaryVersionId: latestTaskPackage.dictionaryVersionId,
        inferenceStatus: latestTaskPackage.inferenceStatus,
      }
    : { status: "missing" },
  requiredNextArtifact: "complete_world_visual_inference_runner",
}

if (ownerGate.status !== "passed") blocked = true
if (formalGate.status !== "passed") blocked = true
if (dataGapReport.status !== "sufficient") blocked = true
if (generationPipeline.status !== "implemented") blocked = true

const report = {
  schemaVersion: "complete-game-world-main-run-v1",
  runId,
  timestampUtc: timestamp,
  timestampAsiaShanghai: formatShanghai(timestamp),
  mode: checkOnly ? "read_only_check" : "run",
  dryRun: checkOnly,
  objective: "single_complete_game_world_generation_orchestration",
  entrypoint: "npm run run:complete-game-world",
  targetPipeline: [
    "world_visual_data_dictionary",
    "world_director_layer",
    "map_structure_semantic_layer",
    "material_transition_layer",
    "object_placement_layer",
    "complete_map_composite",
    "machine_review",
    "failure_backwrite",
    "next_training_round",
  ],
  executedStages: steps.map((step) => ({ id: step.id, status: step.status, command: step.command })),
  status: blocked ? "blocked_preflight_or_generation" : "generated_waiting_owner_final_acceptance",
  canEnterWorld: !blocked && ownerGate.status === "passed" && generationPipeline.status === "implemented",
  blockers: collectBlockers(steps, ownerGate, formalGate, dataGapReport, generationPipeline),
  checks: steps,
  gates: {
    formalGate,
    ownerGate,
    dataGapReport,
    generationPipeline,
  },
  latestRuntimeFrame: {
    recordId: latestRuntimeFrame?.recordId ?? null,
    runtimeFrameId: runtimeFrame?.runtimeFrameId ?? null,
    imageSha256: compositeOutput?.imageSha256 ?? null,
    imageUrl: compositeOutput?.imageUrl ?? null,
    canShowInWorld: latestRuntimeFrame?.canShowInWorld === true && ownerGate.status === "passed",
    source: "existing_runtime_frame_evidence_not_generated_by_this_run",
  },
  persistentOutputs: checkOnly
    ? null
    : {
        runDir: projectRelative(runDir),
        report: projectRelative(path.join(runDir, "run-report.json")),
        latest: projectRelative(path.join(RUN_ROOT, "latest.json")),
        ledger: projectRelative(path.join(LEDGER_ROOT, "events.jsonl")),
      },
}

if (!checkOnly) {
  writeJson(path.join(runDir, "run-report.json"), report)
  writeJson(path.join(RUN_ROOT, "latest.json"), report)
  appendLedger(report)
}

console.log(JSON.stringify(report, null, 2))
process.exit(blocked ? 1 : 0)

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function readOwnerReviewGate(runtimeFrameId, imageSha256) {
  if (!runtimeFrameId || !imageSha256) {
    return {
      status: "missing_identity",
      passed: false,
      reason: "runtime_frame_or_image_identity_missing",
    }
  }

  const ledgerPath = path.join(LEDGER_ROOT, "events.jsonl")
  try {
    const events = fs.readFileSync(ledgerPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseJsonLine)
      .filter((event) => {
        return (
          event?.action === "owner_review_game_map_runtime_frame" &&
          event?.archiveId === runtimeFrameId &&
          event?.resourceSessionId === imageSha256
        )
      })
    const latestDecision = events.at(-1)
    if (!latestDecision) {
      return {
        status: "pending",
        passed: false,
        reason: "owner_review_required_before_world_display",
      }
    }
    if (
      latestDecision.status === "success" ||
      latestDecision.status === "passed" ||
      latestDecision.status === "approved"
    ) {
      return {
        status: "passed",
        passed: true,
        reason: "owner_review_passed",
        decisionTimestamp: latestDecision.timestamp ?? null,
      }
    }
    return {
      status: "rejected",
      passed: false,
      reason: latestDecision.error ?? "owner_review_failed_visual_not_final",
      decisionTimestamp: latestDecision.timestamp ?? null,
    }
  } catch {
    return {
      status: "ledger_unreadable",
      passed: false,
      reason: "owner_review_ledger_unreadable",
    }
  }
}

function readFormalGate(runtimeFrame) {
  const imageUrl = runtimeFrame?.composition?.compositeOutput?.imageUrl
  if (!imageUrl || !imageUrl.endsWith("-composite-output.png")) {
    return {
      status: "missing",
      passed: false,
      reason: "formal_visual_judge_report_missing",
    }
  }
  const reportPath = imageUrl.replace(/-composite-output\.png$/, "-formal-visual-judge.json")
  const report = readJson(path.resolve(ROOT, reportPath))
  if (!report) {
    return {
      status: "missing",
      passed: false,
      reason: "formal_visual_judge_report_unreadable",
      reportPath: projectRelative(reportPath),
    }
  }
  const expected = {
    schemaVersion: "game-map-formal-visual-judge-report-v1",
    manifestId: runtimeFrame?.composition?.manifestId ?? null,
    worldId: runtimeFrame?.worldId ?? null,
    tick: runtimeFrame?.tick ?? null,
    outputSha256: runtimeFrame?.composition?.compositeOutput?.imageSha256 ?? null,
  }
  const identityIssues = [
    report.schemaVersion === expected.schemaVersion ? null : "formal_report_schema_version_mismatch",
    report.manifestId === expected.manifestId ? null : "formal_report_manifest_id_mismatch",
    report.worldId === expected.worldId ? null : "formal_report_world_id_mismatch",
    report.tick === expected.tick ? null : "formal_report_tick_mismatch",
    report.outputSha256 === expected.outputSha256 ? null : "formal_report_image_sha256_mismatch",
  ].filter(Boolean)
  const passed = report.passed === true && report.canEnterWorld === true && identityIssues.length === 0
  return {
    status: passed ? "passed" : "failed",
    passed,
    reason: passed ? "formal_visual_judge_passed" : "formal_visual_judge_failed_or_identity_mismatch",
    reportPath: projectRelative(reportPath),
    issueCount: Array.isArray(report.issues) ? report.issues.length : null,
    identityIssues,
    expectedIdentity: expected,
  }
}

function readDataGapReport() {
  const pointerPath = path.join(
    ROOT,
    "data",
    "world-samples",
    "dataset-blueprints",
    "latest-natural-home-complete-map-audit.json",
  )
  const pointer = readJson(pointerPath)
  const currentDictionary = readJson(path.join(ROOT, "data", "world-visual-data-dictionary", "latest.json"))
  const reportPath = pointer?.auditPath ? path.resolve(ROOT, pointer.auditPath) : null
  const audit = reportPath ? readJson(reportPath) : null
  if (!pointer || !audit || !currentDictionary) {
    return {
      status: "missing",
      passed: false,
      reason: "structured_data_sufficiency_audit_missing",
      reportPath: reportPath ? projectRelative(reportPath) : null,
    }
  }
  const auditDictionaryVersion = audit.blueprint?.dictionaryVersionId ?? null
  const currentDictionaryVersion = currentDictionary.dictionaryVersionId ?? null
  const dictionaryCurrent = auditDictionaryVersion === currentDictionaryVersion
  const sufficient =
    audit.status === "training_data_sufficient" &&
    Array.isArray(audit.blockingGates) &&
    audit.blockingGates.length === 0 &&
    dictionaryCurrent
  return {
    status: sufficient ? "sufficient" : dictionaryCurrent ? "insufficient" : "stale_dictionary_version",
    passed: sufficient,
    reason: sufficient
      ? "structured_data_sufficiency_audit_passed"
      : dictionaryCurrent
        ? "structured_data_sufficiency_audit_blocked"
        : "structured_data_sufficiency_audit_uses_stale_dictionary",
    reportPath: projectRelative(reportPath),
    auditId: audit.auditId ?? null,
    generatedAt: audit.generatedAt ?? null,
    blockingGates: audit.blockingGates ?? [],
    auditDictionaryVersion,
    currentDictionaryVersion,
  }
}

function collectBlockers(steps, ownerGate, formalGate, dataGapReport, generationPipeline) {
  return [
    ...steps.filter((step) => step.status === "failed").map((step) => `${step.id}_failed`),
    ownerGate.status === "passed" ? null : `owner_review_${ownerGate.status}`,
    formalGate.status === "passed" ? null : `formal_gate_${formalGate.status}`,
    dataGapReport.status === "sufficient" ? null : `data_gap_${dataGapReport.status}`,
    generationPipeline.status === "implemented" ? null : generationPipeline.reason,
  ].filter(Boolean)
}

function appendLedger(report) {
  fs.mkdirSync(LEDGER_ROOT, { recursive: true })
  const event = {
    schemaVersion: "ai-painter-training-process-ledger-event-v1",
    timestamp: report.timestampUtc,
    timestampAsiaShanghai: report.timestampAsiaShanghai,
    status: report.status.startsWith("blocked") ? "blocked" : "success",
    kind: report.status.startsWith("blocked") ? "pipeline_blocked" : "pipeline_completed",
    action: "complete_game_world_main_entry",
    title: "Complete game world main entry run",
    titleZh: "完整游戏世界唯一主入口运行",
    summary: `pipelineStatus=${report.status}; finalGameMapSuccess=${report.canEnterWorld}; blockers=${report.blockers.join(",") || "none"}`,
    summaryZh: `流水线状态=${report.status}; 最终游戏地图成功=${report.canEnterWorld}; 阻断=${report.blockers.join(",") || "无"}`,
    finalGameMapSuccess: report.canEnterWorld,
    canEnterWorld: report.canEnterWorld,
    archiveId: report.runId,
    resourceSessionId: report.latestRuntimeFrame.imageSha256,
    script: "scripts/run-complete-game-world-generation.mjs",
    evidence: [report.persistentOutputs.report],
  }
  fs.appendFileSync(path.join(LEDGER_ROOT, "events.jsonl"), `${JSON.stringify(event)}\n`)
  writeJson(path.join(LEDGER_ROOT, "latest.json"), event)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function projectRelative(filePath) {
  return path.relative(ROOT, path.resolve(ROOT, filePath)).replace(/\\/g, "/")
}

function formatShanghai(isoTimestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(isoTimestamp))
}
