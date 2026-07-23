import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { enrichTrainingProcessLedgerEvent } from "./ai-painter-training-ledger-event-analysis.mjs"
import { indexArtifact, indexProgramEvent } from "./ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const LEDGER_DIR = path.join(ROOT, ".runtime", "ai-painter", "training-process-ledger")
const LEDGER_PATH = path.join(LEDGER_DIR, "events.jsonl")
const LATEST_LEDGER_PATH = path.join(LEDGER_DIR, "latest.json")

export function appendAiPainterProgramEvent(input) {
  const timestamp = input.timestamp ?? new Date().toISOString()
  const event = enrichTrainingProcessLedgerEvent({
    id: input.id ?? randomUUID(),
    timestamp,
    ...input,
  })
  fs.mkdirSync(LEDGER_DIR, { recursive: true })
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(event)}\n`, "utf8")
  const events = readLedgerEvents()
  writeJsonAtomic(LATEST_LEDGER_PATH, {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: events.slice(-120).reverse(),
    summary: buildLedgerSummary(events),
  })
  indexProgramEvent(event)
  indexWrittenArtifact(LEDGER_PATH)
  indexWrittenArtifact(LATEST_LEDGER_PATH)
  return event
}

export function writeImmutableProgramRun({ root, runId, fileName, record, latest = {} }) {
  const runRoot = path.resolve(ROOT, root, runId)
  const runPath = path.join(runRoot, fileName)
  if (fs.existsSync(runPath)) throw new Error(`immutable program run already exists: ${projectPath(runPath)}`)
  writeJsonAtomic(runPath, record)
  writeJsonAtomic(path.resolve(ROOT, root, "latest.json"), {
    schemaVersion: `${record.schemaVersion}-latest-pointer`,
    runId,
    status: record.status,
    updatedAtUtc: record.updatedAtUtc ?? record.createdAtUtc ?? new Date().toISOString(),
    runPath: projectPath(runPath),
    ...latest,
  })
  indexWrittenArtifact(runPath, runId)
  indexWrittenArtifact(path.resolve(ROOT, root, "latest.json"), runId)
  return { runPath: projectPath(runPath), runRoot: projectPath(runRoot) }
}

export function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

export function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
}

export function writeJsonAtomic(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const temp = `${value}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`, "utf8")
  fs.renameSync(temp, value)
}

function readLedgerEvents() {
  if (!fs.existsSync(LEDGER_PATH)) return []
  const raw = fs.readFileSync(LEDGER_PATH, "utf8").trim()
  if (!raw) return []
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
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
    if (Object.prototype.hasOwnProperty.call(summary, event.status)) summary[event.status] += 1
  }
  return summary
}

function indexWrittenArtifact(filePath, runId = null) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
  })
}
