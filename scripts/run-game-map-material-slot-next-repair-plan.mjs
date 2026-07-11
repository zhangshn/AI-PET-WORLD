import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  completeTrainingControlRun,
  failTrainingControlRun,
  startTrainingControlRun,
  updateTrainingControlStep,
} from "./lib/ai-painter-training-control.mjs"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const cwd = process.cwd()
const defaultPlanPath = ".runtime/ai-painter/game-map-material-slot-next-repair-plan/latest.json"
const cliArgs = process.argv.slice(2)
const dryRun = cliArgs.includes("--dry-run")
const planArg = cliArgs.find((arg) => !arg.startsWith("--"))
const planPath = path.resolve(planArg ?? defaultPlanPath)
const outputRoot = path.resolve(".runtime/ai-painter/game-map-material-slot-next-repair-plan-runs")
const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"))
const packageScripts = packageJson.scripts ?? {}
const archiveExistingCommand = "node scripts/run-current-game-map-material-slot-v46-runtime-pipeline.mjs --archive-existing"
const ledgerDir = path.resolve(".runtime/ai-painter/training-process-ledger")
const ledgerPath = path.join(ledgerDir, "events.jsonl")
const latestLedgerPath = path.join(ledgerDir, "latest.json")

const allowedNpmScripts = new Set([
  "prepare:game-map-material-slot-v47-visual-delta",
  "train:game-map-material-slot-v47-grass",
  "train:game-map-material-slot-v47-road",
  "train:game-map-material-slot-v47-water",
  "train:game-map-material-slot-v47-shoreline",
  "train:game-map-material-slot-v47-tree",
  "train:game-map-material-slot-v47-tree-object",
  "train:game-map-material-slot-v47-rock-object",
  "train:game-map-material-slot-v49-grass-contrast",
  "train:game-map-material-slot-v50-grass",
  "train:game-map-material-slot-v50-road",
  "train:game-map-material-slot-v50-shoreline",
  "train:game-map-material-slot-v50-water",
  "train:game-map-material-slot-v51-grass",
  "train:game-map-material-slot-v51-road",
  "prepare:game-map-material-slot-v52-strict-grass-purity",
  "train:game-map-material-slot-v52-grass",
  "assemble:game-map-material-slot-v47-model-root",
  "assemble:game-map-material-slot-v49-model-root",
  "assemble:game-map-material-slot-v50-model-root",
  "assemble:game-map-material-slot-v51-model-root",
  "assemble:game-map-material-slot-v52-model-root",
  "run:game-map-material-slot-inference:v47-local",
  "run:game-map-material-slot-inference:v49-local",
  "run:game-map-material-slot-inference:v50-local",
  "run:game-map-material-slot-inference:v51-local",
  "run:game-map-material-slot-inference:v52-local",
  "judge:game-map-material-quality",
  "build:game-map-approved-material-pack",
  "write:game-map-composite-runtime-frame",
  "check:ai-painter-training-run-archive",
])

const allowedNodeCommands = new Set([archiveExistingCommand])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function readLedgerEvents() {
  if (!fs.existsSync(ledgerPath)) return []
  const raw = fs.readFileSync(ledgerPath, "utf8").trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function buildLedgerSummary(events) {
  const summary = {
    total: events.length,
    running: 0,
    success: 0,
    failed: 0,
    error: 0,
    blocked: 0,
    info: 0,
    lastEvent: events.at(-1) ?? null,
  }
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(summary, event.status)) {
      summary[event.status] += 1
    }
  }
  return summary
}

function appendRepairRunnerLedgerEvent(event) {
  fs.mkdirSync(ledgerDir, { recursive: true })
  const stampedEvent = enrichTrainingProcessLedgerEvent({
    id: randomUUID(),
    timestamp: nowIso(),
    action: "run_game_map_material_slot_next_repair_plan",
    script: "scripts/run-game-map-material-slot-next-repair-plan.mjs",
    ...event,
  })
  fs.appendFileSync(ledgerPath, `${JSON.stringify(stampedEvent)}\n`, "utf8")
  const events = readLedgerEvents()
  writeJson(latestLedgerPath, {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: events.slice(-120).reverse(),
    summary: buildLedgerSummary(events),
  })
  refreshAutoVisualJudgeLearning(stampedEvent)
}

function refreshAutoVisualJudgeLearning(event) {
  try {
    refreshGameMapAutoVisualJudgeLearning({
      trigger: "training_process_ledger_event",
      triggerEventId: event.id,
    })
  } catch (error) {
    console.warn(
      `[auto-visual-judge-learning] refresh failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function projectRelative(filePath) {
  const relative = path.relative(cwd, filePath)
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, "/")
    : filePath
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeCommand(command) {
  return String(command ?? "").replace(/\s+/g, " ").trim()
}

function commandToSpawn(command) {
  const normalized = normalizeCommand(command)
  if (normalized.startsWith("npm run ")) {
    const scriptName = normalized.slice("npm run ".length).trim()
    if (!allowedNpmScripts.has(scriptName)) {
      throw new Error(`command is not allowed by repair runner: ${normalized}`)
    }
    if (!packageScripts[scriptName]) {
      throw new Error(`package script missing for repair runner: ${scriptName}`)
    }
    if (process.platform === "win32") {
      return {
        normalized,
        executable: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/s", "/c", "npm", "run", scriptName],
        scriptName,
      }
    }
    return {
      normalized,
      executable: "npm",
      args: ["run", scriptName],
      scriptName,
    }
  }

  if (!allowedNodeCommands.has(normalized)) {
    throw new Error(`node command is not allowed by repair runner: ${normalized}`)
  }

  return {
    normalized,
    executable: process.execPath,
    args: ["scripts/run-current-game-map-material-slot-v46-runtime-pipeline.mjs", "--archive-existing"],
    scriptName: "archive-existing-game-map-material-slot-runtime-pipeline",
  }
}

function validatePlan(plan) {
  if (plan?.schemaVersion !== "game-map-material-slot-next-repair-plan-v1") {
    throw new Error("invalid repair plan schemaVersion")
  }
  if (typeof plan.runId !== "string" || !plan.runId) {
    throw new Error("repair plan runId missing")
  }
  if (!Array.isArray(plan.recommendedCommands) || plan.recommendedCommands.length === 0) {
    throw new Error("repair plan recommendedCommands missing")
  }
  if (plan.acceptance?.materialQualityMustPass !== true) {
    throw new Error("repair plan must require material quality pass")
  }
  if (plan.acceptance?.archiveMustIncludeVisualDeltaReview !== true) {
    throw new Error("repair plan must require archive visual delta review")
  }
  if (plan.acceptance?.ownerReviewRequired !== true) {
    throw new Error("repair plan must keep owner review gate")
  }
}

function runSpawnCommand(command, result) {
  const spawned = spawnSync(command.executable, command.args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: process.env,
  })

  result.finishedAt = nowIso()
  result.exitCode = spawned.status
  result.signal = spawned.signal
  result.status = spawned.status === 0 ? "success" : "failed"
  if (spawned.error) {
    result.error = spawned.error.message
  }
  return spawned
}

function runFailureRetentionArchive(report, reportPath, failedCommand) {
  if (failedCommand === archiveExistingCommand) return

  const archiveCommand = commandToSpawn(archiveExistingCommand)
  const result = {
    command: archiveCommand.normalized,
    scriptName: "archive-existing-after-failure",
    reason: "failed_command_retention",
    startedAt: nowIso(),
    finishedAt: null,
    status: "running",
    exitCode: null,
    signal: null,
  }
  report.failureRetention = result
  writeJson(reportPath, report)
  writeJson(path.join(outputRoot, "latest.json"), report)

  runSpawnCommand(archiveCommand, result)
  writeJson(reportPath, report)
  writeJson(path.join(outputRoot, "latest.json"), report)
}

function main() {
  const controlRun = startTrainingControlRun(
    "run_game_map_material_slot_next_repair_plan",
    "repair_plan_runner_loading_plan",
  )
  if (!fs.existsSync(planPath)) {
    const error = new Error(`repair plan missing: ${planPath}`)
    failTrainingControlRun(controlRun, "repair_plan_runner_plan_missing", error)
    throw error
  }

  const startedAt = nowIso()
  const plan = readJson(planPath)
  try {
    validatePlan(plan)
  } catch (error) {
    failTrainingControlRun(controlRun, "repair_plan_runner_plan_invalid", error)
    throw error
  }

  const runId = `${plan.runId}-auto-run-${startedAt.replace(/[:.]/g, "-")}`
  const runRoot = path.join(outputRoot, runId)
  const reportPath = path.join(runRoot, "run-report.json")
  let commands = []
  try {
    commands = plan.recommendedCommands.map(commandToSpawn)
  } catch (error) {
    failTrainingControlRun(controlRun, "repair_plan_runner_command_invalid", error)
    throw error
  }

  if (dryRun) {
    completeTrainingControlRun(controlRun, "repair_plan_runner_dry_run_passed")
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: "game_map_material_slot_next_repair_plan_runner_dry_run_passed",
          sourcePlanRunId: plan.runId,
          sourcePlanPath: projectRelative(planPath),
          commandCount: commands.length,
          commands: commands.map((command) => command.normalized),
        },
        null,
        2,
      ),
    )
    return
  }

  updateTrainingControlStep(controlRun, "repair_plan_runner_started")
  const report = {
    schemaVersion: "game-map-material-slot-next-repair-plan-run-v1",
    runId,
    sourcePlanRunId: plan.runId,
    sourcePlanPath: projectRelative(planPath),
    createdByProgram: true,
    manualEdited: false,
    codexGenerated: false,
    startedAt,
    finishedAt: null,
    status: "running",
    commands: [],
  }

  writeJson(reportPath, report)
  writeJson(path.join(outputRoot, "latest.json"), report)
  appendRepairRunnerLedgerEvent({
    runId,
    kind: "repair_plan_run_started",
    status: "info",
    title: "Next repair plan runner started",
    titleZh: "下一轮修复训练控制器已启动",
    detail: `sourcePlanRunId=${plan.runId} / commandCount=${commands.length}`,
    detailZh: `来源计划=${plan.runId} / 命令数量=${commands.length}`,
    currentStep: "repair_plan_runner_started",
    archiveId: projectRelative(reportPath),
    evidencePath: projectRelative(reportPath),
  })

  for (const command of commands) {
    updateTrainingControlStep(controlRun, command.scriptName)
    const commandStartedAt = nowIso()
    const result = {
      command: command.normalized,
      scriptName: command.scriptName,
      startedAt: commandStartedAt,
      finishedAt: null,
      status: "running",
      exitCode: null,
      signal: null,
    }
    report.commands.push(result)
    writeJson(reportPath, report)
    writeJson(path.join(outputRoot, "latest.json"), report)
    appendRepairRunnerLedgerEvent({
      runId,
      kind: "repair_plan_command_started",
      status: "info",
      title: "Repair plan command started",
      titleZh: "修复训练命令已启动",
      detail: `command=${command.normalized}`,
      detailZh: `命令=${command.normalized}`,
      currentStep: command.scriptName,
      archiveId: projectRelative(reportPath),
      evidencePath: projectRelative(reportPath),
    })

    const spawned = runSpawnCommand(command, result)

    writeJson(reportPath, report)
    writeJson(path.join(outputRoot, "latest.json"), report)
    appendRepairRunnerLedgerEvent({
      runId,
      kind: spawned.status === 0 && !spawned.error ? "repair_plan_command_completed" : "repair_plan_command_failed",
      status: spawned.status === 0 && !spawned.error ? "success" : "failed",
      title:
        spawned.status === 0 && !spawned.error
          ? "Repair plan command completed"
          : "Repair plan command failed",
      titleZh:
        spawned.status === 0 && !spawned.error
          ? "修复训练命令已完成"
          : "修复训练命令失败",
      detail: `command=${command.normalized} / exitCode=${result.exitCode} / signal=${result.signal ?? "none"}`,
      detailZh: `命令=${command.normalized} / 退出码=${result.exitCode} / 信号=${result.signal ?? "无"}`,
      currentStep: command.scriptName,
      error: spawned.error ? spawned.error.message : spawned.status === 0 ? null : `exitCode=${spawned.status}`,
      errorZh: spawned.error ? `启动错误：${spawned.error.message}` : spawned.status === 0 ? null : `命令退出码=${spawned.status}`,
      archiveId: projectRelative(reportPath),
      evidencePath: projectRelative(reportPath),
    })

    if (spawned.status !== 0 || spawned.error) {
      report.status = "failed"
      report.finishedAt = nowIso()
      report.failedCommand = command.normalized
      writeJson(reportPath, report)
      writeJson(path.join(outputRoot, "latest.json"), report)
      runFailureRetentionArchive(report, reportPath, command.normalized)
      report.finishedAt = nowIso()
      writeJson(reportPath, report)
      writeJson(path.join(outputRoot, "latest.json"), report)
      appendRepairRunnerLedgerEvent({
        runId,
        kind: "repair_plan_run_failed",
        status: "failed",
        title: "Next repair plan runner failed",
        titleZh: "下一轮修复训练控制器失败",
        detail: `failedCommand=${command.normalized}`,
        detailZh: `失败命令=${command.normalized}`,
        currentStep: "repair_plan_runner_failed",
        error: report.failedCommand,
        errorZh: `修复训练在该命令失败：${command.normalized}`,
        archiveId: projectRelative(reportPath),
        evidencePath: projectRelative(reportPath),
      })
      failTrainingControlRun(controlRun, command.scriptName, spawned.error ?? `exitCode=${spawned.status}`)
      process.exitCode = spawned.status || 1
      return
    }
  }

  report.status = "success"
  report.finishedAt = nowIso()
  writeJson(reportPath, report)
  writeJson(path.join(outputRoot, "latest.json"), report)
  appendRepairRunnerLedgerEvent({
    runId,
    kind: "repair_plan_run_completed",
    status: "success",
    title: "Next repair plan runner completed",
    titleZh: "下一轮修复训练控制器已完成",
    detail: `sourcePlanRunId=${plan.runId} / commandCount=${commands.length}`,
    detailZh: `来源计划=${plan.runId} / 命令数量=${commands.length}`,
    currentStep: "repair_plan_runner_completed",
    archiveId: projectRelative(reportPath),
    evidencePath: projectRelative(reportPath),
  })
  completeTrainingControlRun(controlRun, "repair_plan_runner_completed")
  console.log(JSON.stringify(report, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
