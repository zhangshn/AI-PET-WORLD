import fs from "node:fs"
import path from "node:path"
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./ai-pet-world-storage.mjs"

const controlDir = path.resolve(".runtime/ai-painter/training-control")
const statePath = path.join(controlDir, "state.json")
const consoleLogPath = path.join(controlDir, "console.log")

export function startTrainingControlRun(action, currentStep) {
  const startedAt = new Date().toISOString()
  writeTrainingControlState({
    status: "running",
    action,
    currentStep,
    startedAt,
    finishedAt: null,
    error: null,
  })
  appendTrainingControlLog(action, currentStep, "started")
  return { action, startedAt }
}

export function updateTrainingControlStep(run, currentStep) {
  writeTrainingControlState({
    status: "running",
    action: run.action,
    currentStep,
    startedAt: run.startedAt,
    finishedAt: null,
    error: null,
  })
  appendTrainingControlLog(run.action, currentStep, "step")
}

export function completeTrainingControlRun(run, currentStep = "completed") {
  writeTrainingControlState({
    status: "completed",
    action: run.action,
    currentStep,
    startedAt: run.startedAt,
    finishedAt: new Date().toISOString(),
    error: null,
  })
  appendTrainingControlLog(run.action, currentStep, "completed")
}

export function failTrainingControlRun(run, currentStep, error) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown_training_error")
  writeTrainingControlState({
    status: "failed",
    action: run.action,
    currentStep,
    startedAt: run.startedAt,
    finishedAt: new Date().toISOString(),
    error: message,
  })
  appendTrainingControlLog(run.action, `${currentStep} / ${message}`, "failed")
}

function writeTrainingControlState(state) {
  fs.mkdirSync(controlDir, { recursive: true })
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  indexControlArtifact(statePath)
}

function appendTrainingControlLog(action, detail, status) {
  fs.mkdirSync(controlDir, { recursive: true })
  fs.appendFileSync(
    consoleLogPath,
    `${new Date().toISOString()} ${status} ${action} ${detail}\n`,
    "utf8",
  )
  indexControlArtifact(consoleLogPath)
}

function indexControlArtifact(filePath) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
  })
}
