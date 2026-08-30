import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const aiConsoleTrainingTelemetrySchemaVersion = "ai_console_training_telemetry_v1" as const
export const aiConsoleTrainingTelemetryWriterIdentity = "ai_console_training_telemetry_writer_v1" as const
export const aiConsoleTrainingTelemetryLogicalPath = ".runtime/ai-console/observability/training-telemetry-v1.sqlite" as const

const expectedColumns = [
  "sample_id",
  "sample_sequence",
  "run_id",
  "execution_id",
  "process_id",
  "training_stage",
  "epoch",
  "batch_index",
  "batch_count",
  "optimization_step",
  "loss",
  "learning_rate",
  "throughput_samples_per_second",
  "estimated_completion_at_utc",
  "checkpoint_identity",
  "heartbeat_at_utc",
  "reported_at_utc",
  "reporter_identity",
  "schema_version",
  "record_sha256",
] as const

export type AiConsoleTrainingTelemetryRecord = {
  sampleId: string
  sampleSequence: number
  runId: string
  executionId: string
  processId: number | null
  trainingStage: string | null
  epoch: number | null
  batchIndex: number | null
  batchCount: number | null
  optimizationStep: number | null
  loss: number | null
  learningRate: number | null
  throughputSamplesPerSecond: number | null
  estimatedCompletionAtUtc: string | null
  checkpointIdentity: string | null
  heartbeatAtUtc: string
  reportedAtUtc: string
  reporterIdentity: string
  schemaVersion: typeof aiConsoleTrainingTelemetrySchemaVersion
  recordSha256: string
}

export type AiConsoleTrainingTelemetryInput = Omit<
  AiConsoleTrainingTelemetryRecord,
  "sampleId" | "sampleSequence" | "reportedAtUtc" | "schemaVersion" | "recordSha256"
>

export type AiConsoleTrainingTelemetryReadResult = {
  status: "connected" | "not_connected" | "unknown_or_stale"
  latest: AiConsoleTrainingTelemetryRecord | null
  reasonCode: string | null
  sourceRevision: number | null
  evidenceReferences: readonly string[]
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function getStorePath(overridePath?: string): string {
  return overridePath ?? path.join(process.cwd(), ...aiConsoleTrainingTelemetryLogicalPath.split("/"))
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.includes("T")
}

function assertSafeIdentity(value: string, field: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,191}$/u.test(value)) {
    throw new Error(`ai_console_training_telemetry_${field}_invalid`)
  }
}

function assertNullableFinite(value: number | null, field: string, minimum = 0) {
  if (value !== null && (!Number.isFinite(value) || value < minimum)) {
    throw new Error(`ai_console_training_telemetry_${field}_invalid`)
  }
}

function validateInput(input: AiConsoleTrainingTelemetryInput) {
  assertSafeIdentity(input.runId, "run_id")
  assertSafeIdentity(input.executionId, "execution_id")
  assertSafeIdentity(input.reporterIdentity, "reporter_identity")
  if (input.trainingStage !== null) assertSafeIdentity(input.trainingStage, "training_stage")
  if (input.checkpointIdentity !== null) assertSafeIdentity(input.checkpointIdentity, "checkpoint_identity")
  assertNullableFinite(input.processId, "process_id", 1)
  assertNullableFinite(input.epoch, "epoch")
  assertNullableFinite(input.batchIndex, "batch_index")
  assertNullableFinite(input.batchCount, "batch_count")
  assertNullableFinite(input.optimizationStep, "optimization_step")
  assertNullableFinite(input.loss, "loss")
  assertNullableFinite(input.learningRate, "learning_rate")
  assertNullableFinite(input.throughputSamplesPerSecond, "throughput")
  if (!isIsoTimestamp(input.heartbeatAtUtc)) throw new Error("ai_console_training_telemetry_heartbeat_invalid")
  if (input.estimatedCompletionAtUtc !== null && !isIsoTimestamp(input.estimatedCompletionAtUtc)) {
    throw new Error("ai_console_training_telemetry_eta_invalid")
  }
  if (input.batchIndex !== null && input.batchCount !== null && input.batchIndex > input.batchCount) {
    throw new Error("ai_console_training_telemetry_batch_relation_invalid")
  }
}

function openWritableStore(storePath: string): DatabaseSync {
  mkdirSync(path.dirname(storePath), { recursive: true })
  const database = new DatabaseSync(storePath)
  database.exec("PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA user_version=1;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS training_telemetry (
      sample_id TEXT PRIMARY KEY,
      sample_sequence INTEGER NOT NULL UNIQUE,
      run_id TEXT NOT NULL,
      execution_id TEXT NOT NULL,
      process_id INTEGER,
      training_stage TEXT,
      epoch INTEGER,
      batch_index INTEGER,
      batch_count INTEGER,
      optimization_step INTEGER,
      loss REAL,
      learning_rate REAL,
      throughput_samples_per_second REAL,
      estimated_completion_at_utc TEXT,
      checkpoint_identity TEXT,
      heartbeat_at_utc TEXT NOT NULL,
      reported_at_utc TEXT NOT NULL,
      reporter_identity TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      record_sha256 TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS training_telemetry_run_sequence
      ON training_telemetry(run_id, sample_sequence DESC);
  `)
  verifyStore(database)
  return database
}

function verifyStore(database: DatabaseSync) {
  const integrity = database.prepare("PRAGMA integrity_check").get() as Record<string, unknown> | undefined
  if (!integrity || !Object.values(integrity).includes("ok")) {
    throw new Error("ai_console_training_telemetry_sqlite_integrity_failed")
  }
  const versionRow = database.prepare("PRAGMA user_version").get() as Record<string, unknown>
  if (Number(versionRow.user_version) !== 1) throw new Error("ai_console_training_telemetry_store_version_invalid")
  const actualColumns = (database.prepare("PRAGMA table_info(training_telemetry)").all() as { name: string }[]).map((row) => row.name)
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
    throw new Error("ai_console_training_telemetry_column_set_invalid")
  }
}

function rowToRecord(row: Record<string, unknown>): AiConsoleTrainingTelemetryRecord {
  return {
    sampleId: String(row.sample_id),
    sampleSequence: Number(row.sample_sequence),
    runId: String(row.run_id),
    executionId: String(row.execution_id),
    processId: row.process_id === null ? null : Number(row.process_id),
    trainingStage: row.training_stage === null ? null : String(row.training_stage),
    epoch: row.epoch === null ? null : Number(row.epoch),
    batchIndex: row.batch_index === null ? null : Number(row.batch_index),
    batchCount: row.batch_count === null ? null : Number(row.batch_count),
    optimizationStep: row.optimization_step === null ? null : Number(row.optimization_step),
    loss: row.loss === null ? null : Number(row.loss),
    learningRate: row.learning_rate === null ? null : Number(row.learning_rate),
    throughputSamplesPerSecond: row.throughput_samples_per_second === null ? null : Number(row.throughput_samples_per_second),
    estimatedCompletionAtUtc: row.estimated_completion_at_utc === null ? null : String(row.estimated_completion_at_utc),
    checkpointIdentity: row.checkpoint_identity === null ? null : String(row.checkpoint_identity),
    heartbeatAtUtc: String(row.heartbeat_at_utc),
    reportedAtUtc: String(row.reported_at_utc),
    reporterIdentity: String(row.reporter_identity),
    schemaVersion: String(row.schema_version) as typeof aiConsoleTrainingTelemetrySchemaVersion,
    recordSha256: String(row.record_sha256),
  }
}

function recordPayload(record: Omit<AiConsoleTrainingTelemetryRecord, "sampleId" | "recordSha256">) {
  return JSON.stringify(record)
}

function verifyRecord(record: AiConsoleTrainingTelemetryRecord) {
  const { sampleId, recordSha256, ...unsigned } = record
  const expectedRecordSha256 = sha256(recordPayload(unsigned))
  const expectedSampleId = sha256(`${aiConsoleTrainingTelemetrySchemaVersion}:${record.runId}:${record.sampleSequence}:${expectedRecordSha256}`)
  if (record.schemaVersion !== aiConsoleTrainingTelemetrySchemaVersion || recordSha256 !== expectedRecordSha256 || sampleId !== expectedSampleId) {
    throw new Error("ai_console_training_telemetry_record_integrity_failed")
  }
}

export function recordAiConsoleTrainingTelemetry(
  input: AiConsoleTrainingTelemetryInput,
  options: { storePath?: string } = {},
): AiConsoleTrainingTelemetryRecord {
  validateInput(input)
  const database = openWritableStore(getStorePath(options.storePath))
  try {
    database.exec("BEGIN IMMEDIATE")
    const sequenceRow = database.prepare("SELECT COALESCE(MAX(sample_sequence), 0) AS latest_sequence FROM training_telemetry").get() as Record<string, unknown>
    const sampleSequence = Number(sequenceRow.latest_sequence) + 1
    const reportedAtUtc = new Date().toISOString()
    const unsigned = {
      sampleSequence,
      ...input,
      reportedAtUtc,
      schemaVersion: aiConsoleTrainingTelemetrySchemaVersion,
    }
    const recordSha256 = sha256(recordPayload(unsigned))
    const sampleId = sha256(`${aiConsoleTrainingTelemetrySchemaVersion}:${input.runId}:${sampleSequence}:${recordSha256}`)
    const record: AiConsoleTrainingTelemetryRecord = { sampleId, ...unsigned, recordSha256 }
    database.prepare(`
      INSERT INTO training_telemetry VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      record.sampleId,
      record.sampleSequence,
      record.runId,
      record.executionId,
      record.processId,
      record.trainingStage,
      record.epoch,
      record.batchIndex,
      record.batchCount,
      record.optimizationStep,
      record.loss,
      record.learningRate,
      record.throughputSamplesPerSecond,
      record.estimatedCompletionAtUtc,
      record.checkpointIdentity,
      record.heartbeatAtUtc,
      record.reportedAtUtc,
      record.reporterIdentity,
      record.schemaVersion,
      record.recordSha256,
    )
    database.exec("COMMIT")
    verifyRecord(record)
    return record
  } catch (error) {
    try { database.exec("ROLLBACK") } catch { /* transaction did not start */ }
    throw error
  } finally {
    database.close()
  }
}

export function readLatestAiConsoleTrainingTelemetry(
  options: { storePath?: string; staleAfterMs?: number } = {},
): AiConsoleTrainingTelemetryReadResult {
  const storePath = getStorePath(options.storePath)
  if (!existsSync(storePath)) {
    return {
      status: "not_connected",
      latest: null,
      reasonCode: "new_platform_training_telemetry_not_reported",
      sourceRevision: null,
      evidenceReferences: [aiConsoleTrainingTelemetryLogicalPath],
    }
  }

  let database: DatabaseSync | null = null
  try {
    database = new DatabaseSync(storePath, { open: true, readOnly: true })
    verifyStore(database)
    const row = database.prepare("SELECT * FROM training_telemetry ORDER BY sample_sequence DESC LIMIT 1").get() as Record<string, unknown> | undefined
    if (!row) {
      return {
        status: "not_connected",
        latest: null,
        reasonCode: "new_platform_training_telemetry_registry_empty",
        sourceRevision: 0,
        evidenceReferences: [aiConsoleTrainingTelemetryLogicalPath],
      }
    }
    const latest = rowToRecord(row)
    verifyRecord(latest)
    const staleAfterMs = options.staleAfterMs ?? 15_000
    const isStale = Date.now() - Date.parse(latest.heartbeatAtUtc) > staleAfterMs
    return {
      status: isStale ? "unknown_or_stale" : "connected",
      latest,
      reasonCode: isStale ? "new_platform_training_telemetry_heartbeat_stale" : null,
      sourceRevision: latest.sampleSequence,
      evidenceReferences: [aiConsoleTrainingTelemetryLogicalPath],
    }
  } catch (error) {
    return {
      status: "unknown_or_stale",
      latest: null,
      reasonCode: error instanceof Error ? error.message : "ai_console_training_telemetry_read_failed",
      sourceRevision: null,
      evidenceReferences: [aiConsoleTrainingTelemetryLogicalPath],
    }
  } finally {
    database?.close()
  }
}
