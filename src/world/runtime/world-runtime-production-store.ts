/**
 * Explicit production Runtime Store.
 *
 * This adapter is file-backed on purpose: the physical root is supplied by
 * deployment configuration, while all callers still use the Runtime Store
 * protocol. It provides exclusive per-world writes, compare-and-set ticks,
 * atomic fsync+rename records and a hash-bound latest index.
 */
import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { mkdir, open, readFile, rename, rm, readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

import type {
  WorldRuntimeSaveRecord,
  NaturalWorldRuntimeSaveRecord, NaturalWorldRuntimeReadInput, NaturalWorldRuntimeReadResult,
  NaturalWorldRuntimeWriteInput, NaturalWorldRuntimeWriteResult,
  WorldRuntimeStoreAdapter,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"
import {
  assertRuntimePath,
  assertRuntimePathSegment,
} from "./runtime-path-security"
import { isWorldRuntimeSaveRecord } from "./world-runtime-record-validation"
import {
  NATURAL_WORLD_MAX_BYTES, decodeNaturalWorldRuntimeRecord, assertNaturalWorldReadInput,
  assertNaturalWorldReadMatch, snapshotNaturalWorldWrite, naturalWorldCasConflict,
  validateNaturalWorldTransactionJournal, assertNaturalWorldTransactionRecord,
} from "./world-runtime-record-validation"
type LegacyReadInput = { filePath?: string; ownerId?: string; worldId?: string }
type LegacyWriteInput = { record: WorldRuntimeSaveRecord; filePath?: string; expectedTick?: number }
type StoredRecord = WorldRuntimeSaveRecord | NaturalWorldRuntimeSaveRecord
type InternalReadResult = Omit<WorldRuntimeStoreReadResult, "record"> & { record: StoredRecord | null; fileSha256?: string }
type InternalWriteInput = { record: StoredRecord; filePath?: string; expectedTick?: number; expectedStateVersion?: number; expectedFileSha256?: string | null }


const LATEST_FILE = "latest-world.json"

export function createProductionWorldRuntimeStore(runtimeRoot: string): WorldRuntimeStoreAdapter {
  const root = path.resolve(runtimeRoot)
  return {
    kind: "configured_file_runtime_store",
    readNatural: (input) => readNaturalRecord(root, input),
    writeNatural: (input) => writeNaturalRecord(root, input),
    getDefaultSavePath: () => path.join(root, LATEST_FILE),
    read: async (input) => readRecord(root, input),
    write: async (input) => writeRecord(root, input),
  }
}

function readRecord(root: string, input?: LegacyReadInput): Promise<WorldRuntimeStoreReadResult>
function readRecord(root: string, input: NaturalWorldRuntimeReadInput, natural: true): Promise<NaturalWorldRuntimeReadResult>
async function readRecord(root: string, input?: LegacyReadInput & Partial<NaturalWorldRuntimeReadInput>, natural = false): Promise<InternalReadResult> {
  const requestedPath = input?.filePath
  let recordPath: string | null
  try {
    recordPath = requestedPath
      ? await assertRuntimePath(requestedPath, root)
      : input?.ownerId && input?.worldId
      ? await assertRuntimePath(recordPathFor(root, { ownerId: input.ownerId, worldId: input.worldId }), root)
        : input?.worldId
          ? await resolveWorldRuntimeSavePathByWorldId(root, input.worldId)
      : await readLatestPath(root)
  } catch (error) {
    return failureRead(requestedPath ?? path.join(root, LATEST_FILE), "invalid", "runtime_path_rejected", error)
  }
  if (!recordPath) {
    return {
      status: "empty", record: null, path: path.join(root, LATEST_FILE),
      message: "No runtime save record found.", warnings: [],
      tags: ["world_runtime_store_read", "empty"],
    }
  }
  try {
    const transaction = natural ? null : await readTransactionJournal(`${recordPath}.transaction.json`)
    if (transaction?.state === "prepared") {
      return failureRead(recordPath, "invalid", "runtime_transaction_incomplete")
    }
    const naturalFile = natural ? await readNaturalTransactionRecord(root, recordPath, input as NaturalWorldRuntimeReadInput) : null
    if (natural && !naturalFile) return { status: "empty", record: null, path: recordPath,
      message: "No runtime save record found.", warnings: [], tags: ["world_runtime_store_read", "empty"] }
    const parsed = naturalFile ? naturalFile.record : JSON.parse(await readFile(recordPath, "utf8")) as WorldRuntimeSaveRecord
    if (!natural && !isWorldRuntimeSaveRecord(parsed)) {
      return failureRead(recordPath, "invalid", "runtime_record_schema_invalid")
    }
    if ((input?.worldId && parsed.worldId !== input.worldId) || (input?.ownerId && parsed.ownerId !== input.ownerId)) {
      return failureRead(recordPath, "invalid", "runtime_requested_identity_mismatch")
    }
    if (naturalFile) assertNaturalWorldReadMatch(naturalFile.record, input as NaturalWorldRuntimeReadInput, naturalFile.fileSha256)
    return {
      ...(naturalFile ? { fileSha256: naturalFile.fileSha256 } : {}),
      status: "found", record: parsed, path: recordPath,
      message: "Runtime save record loaded from configured production store.", warnings: [],
      tags: ["world_runtime_store_read", "found", "configured_production_store"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return { status: "empty", record: null, path: recordPath, message: "No runtime save record found.", warnings: [], tags: ["world_runtime_store_read", "empty"] }
    }
    return failureRead(recordPath, natural ? "invalid" : "failed", "runtime_store_read_failed", error)
  }
}

async function resolveWorldRuntimeSavePathByWorldId(root: string, worldId: string): Promise<string | null> {
  assertRuntimePathSegment(worldId, "worldId")
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, `${worldId}.json`))
    .filter((candidate) => existsSync(candidate))
  if (matches.length > 1) throw new Error("runtime_world_id_ambiguous")
  return matches[0] ? assertRuntimePath(matches[0], root) : null
}

function writeRecord(root: string, input: LegacyWriteInput): Promise<WorldRuntimeStoreWriteResult>
function writeRecord(root: string, input: NaturalWorldRuntimeWriteInput & { record: NaturalWorldRuntimeSaveRecord }, natural: true): Promise<NaturalWorldRuntimeWriteResult>
async function writeRecord(root: string, input: InternalWriteInput, natural = false): Promise<NaturalWorldRuntimeWriteResult> {
  // Resolve both explicit and derived paths through the same physical-root
  // guard.  The derived per-world path is also attacker-controlled through
  // persisted identity fields, and must not bypass symlink/reparse checks.
  const candidatePath = input.filePath
    ? input.filePath
    : recordPathFor(root, input.record)
  const recordPath = await assertRuntimePath(candidatePath, root)
  const lockPath = `${recordPath}.lock`
  let lock: Awaited<ReturnType<typeof open>> | null = null
  const lockToken = randomUUID()
  let recordReplaced = false
  try {
    if (natural) decodeNaturalWorldRuntimeRecord(Buffer.from(`${JSON.stringify(input.record, null, 2)}\n`, "utf8"))
    else if (!isWorldRuntimeSaveRecord(input.record)) throw new Error("runtime record schema invalid")
    await mkdir(path.dirname(recordPath), { recursive: true })
    try {
      lock = await open(lockPath, "wx")
      await lock.writeFile(`${JSON.stringify({
        schemaVersion: "world-runtime-write-lock-v1", pid: process.pid,
        host: hostname(), worldId: input.record.worldId, ownerId: input.record.ownerId,
        lockToken,
        createdAtUtc: new Date().toISOString(),
      })}\n`, "utf8")
      await lock.sync()
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
        return { ok: false, code: "conflict", path: recordPath,
          message: "Another runtime writer owns this world.", warnings: ["runtime_write_lock_exists"],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict"] }
      }
      throw error
    }
    const transactionPath = `${recordPath}.transaction.json`
    const transaction = natural ? null : await readTransactionJournal(transactionPath)
    if (transaction?.state === "prepared") throw new Error("runtime_transaction_incomplete")
    const naturalCurrent = natural ? await readNaturalTransactionRecord(root, recordPath, input.record) : null
    const current = natural ? naturalCurrent?.record ?? null : await readExisting(recordPath)
    if (natural) {
      const conflict = naturalWorldCasConflict(naturalCurrent?.record ?? null, input.record as NaturalWorldRuntimeSaveRecord,
        input as NaturalWorldRuntimeWriteInput, naturalCurrent?.fileSha256 ?? null)
      if (conflict) return { ok: false, code: "conflict", path: recordPath, message: conflict,
        warnings: [conflict], tags: ["world_runtime_store_write", "failed", "natural_world_cas_rejected"] }
    }
    if (input.expectedTick !== undefined) {
      if ((current?.tick ?? -1) !== input.expectedTick) {
        return { ok: false, code: "conflict", path: recordPath,
          message: "Runtime tick compare-and-set rejected a stale writer.",
          warnings: [`expected_tick:${input.expectedTick}`, `actual_tick:${current?.tick ?? -1}`],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict", "runtime_tick_cas_rejected"] }
      }
    }
    await writeAtomic(transactionPath, {
      ...(natural ? { recordKind: "natural_world", stateVersion: (input.record as NaturalWorldRuntimeSaveRecord).stateVersion,
        recordContentSha256: (input.record as NaturalWorldRuntimeSaveRecord).recordContentSha256 } : {}),
      schemaVersion: "world-runtime-transaction-v1", state: "prepared",
      recordPath, latestPath: natural || input.filePath ? null : path.join(root, LATEST_FILE),
      worldId: input.record.worldId, tick: input.record.tick,
      createdAtUtc: new Date().toISOString(),
    })
    await writeAtomic(recordPath, input.record)
    recordReplaced = true
    if (!natural && !input.filePath) await writeAtomic(path.join(root, LATEST_FILE), {
      schemaVersion: "world-runtime-latest-index-v1", ownerId: input.record.ownerId,
      worldId: input.record.worldId, tick: input.record.tick,
      path: recordPath, recordSha256: sha256Json(input.record), updatedAtUtc: input.record.savedAt,
    })
    await writeAtomic(transactionPath, {
      ...(natural ? { recordKind: "natural_world", stateVersion: (input.record as NaturalWorldRuntimeSaveRecord).stateVersion,
        recordContentSha256: (input.record as NaturalWorldRuntimeSaveRecord).recordContentSha256 } : {}),
      schemaVersion: "world-runtime-transaction-v1", state: "committed",
      recordPath, latestPath: natural || input.filePath ? null : path.join(root, LATEST_FILE),
      worldId: input.record.worldId, tick: input.record.tick,
      committedAtUtc: new Date().toISOString(),
    })
    await rm(transactionPath, { force: true })
    return { ...(natural ? naturalWriteReceipt(input.record as NaturalWorldRuntimeSaveRecord) : {}),
      ok: true, path: recordPath, message: "Runtime save record written.", warnings: [], tags: ["world_runtime_store_write", "ok", "configured_production_store"] }
  } catch (error) {
    return { ok: false, code: "persistence_error", path: recordPath,
      message: recordReplaced
        ? "Runtime save record was replaced; transaction finalization failed."
        : "Runtime save record was not written.",
      warnings: [message(error)],
      tags: ["world_runtime_store_write", "failed", recordReplaced ? "runtime_save_record_replaced" : "old_save_preserved"] }
  } finally {
    if (lock) await lock.close().catch(() => {})
    if (lock) await releaseOwnedLock(lockPath, lockToken)
  }
}

async function releaseOwnedLock(lockPath: string, lockToken: string): Promise<void> {
  try {
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as { lockToken?: unknown }
    if (lock.lockToken === lockToken) await rm(lockPath, { force: true })
  } catch (error) {
    if (!(isNodeFileError(error) && error.code === "ENOENT")) return
  }
}

async function readTransactionJournal(filePath: string): Promise<{ state?: string } | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as { state?: string }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function readLatestPath(root: string): Promise<string | null> {
  try {
    const index = JSON.parse(await readFile(path.join(root, LATEST_FILE), "utf8")) as Partial<{
      path: string; ownerId: string; worldId: string; tick: number; recordSha256: string
    }>
    if (typeof index.path !== "string" || typeof index.ownerId !== "string" || typeof index.worldId !== "string" || !/^[a-f0-9]{64}$/u.test(index.recordSha256 ?? "")) return null
    const target = await assertRuntimePath(index.path, root)
    if (target !== recordPathFor(root, { ownerId: index.ownerId, worldId: index.worldId } as WorldRuntimeSaveRecord)) throw new Error("latest index identity mismatch")
    const parsed = await readExisting(target)
    if (!parsed || sha256Json(parsed) !== index.recordSha256 || parsed.tick !== index.tick) throw new Error("latest index record hash mismatch")
    return target
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function readExisting(filePath: string): Promise<WorldRuntimeSaveRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    if (!isWorldRuntimeSaveRecord(parsed)) throw new Error("runtime record schema invalid")
    return parsed
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  const handle = await open(temp, "wx")
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8"); await handle.sync() }
  finally { await handle.close().catch(() => {}) }
  await rename(temp, filePath)
}

function recordPathFor(root: string, record: Pick<WorldRuntimeSaveRecord, "ownerId" | "worldId">): string {
  assertRuntimePathSegment(record.ownerId, "ownerId"); assertRuntimePathSegment(record.worldId, "worldId")
  return path.resolve(root, record.ownerId, `${record.worldId}.json`)
}

function sha256Json(value: unknown): string { return createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`, "utf8").digest("hex") }
function failureRead(filePath: string, status: "invalid" | "failed", tag: string, error?: unknown): WorldRuntimeStoreReadResult { return { status, record: null, path: filePath, message: tag, warnings: error ? [message(error)] : [], tags: ["world_runtime_store_read", status, tag] } }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function isNodeFileError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error }

async function readNaturalRecord(root: string, input: NaturalWorldRuntimeReadInput): Promise<NaturalWorldRuntimeReadResult> {
  try {
    assertNaturalWorldReadInput(input)
    const fixed = structuredClone(input)
    assertRuntimePathSegment(fixed.ownerId, "ownerId"); assertRuntimePathSegment(fixed.worldId, "worldId")
    return await readRecord(root, fixed, true)
  } catch (error) { return naturalReadFailure(error) }
}
async function writeNaturalRecord(root: string, input: NaturalWorldRuntimeWriteInput): Promise<NaturalWorldRuntimeWriteResult> {
  try {
    const fixed = snapshotNaturalWorldWrite(input)
    assertRuntimePathSegment(fixed.record.ownerId, "ownerId"); assertRuntimePathSegment(fixed.record.worldId, "worldId")
    return await writeRecord(root, fixed, true)
  } catch (error) { return naturalWriteFailure(error) }
}

async function readNaturalFile(filePath: string) {
  if ((await stat(filePath)).size > NATURAL_WORLD_MAX_BYTES) throw new Error("natural_world_invalid:size")
  return decodeNaturalWorldRuntimeRecord(await readFile(filePath))
}
async function readExistingNaturalFile(filePath: string) {
  try { return await readNaturalFile(filePath) }
  catch (error) { if (isNodeFileError(error) && error.code === "ENOENT") return null; throw error }
}
async function readNaturalTransactionRecord(root: string, filePath: string, identity: { ownerId: string; worldId: string }) {
  let rawJournal: Buffer | null = null
  const journalPath = `${filePath}.transaction.json`
  try {
    await assertRuntimePath(journalPath, root)
    if ((await stat(journalPath)).size > NATURAL_WORLD_MAX_BYTES) throw new Error("natural_world_invalid:transaction_size")
    rawJournal = await readFile(journalPath)
  } catch (error) { if (!(isNodeFileError(error) && error.code === "ENOENT")) throw error }
  const journal = rawJournal === null ? null : validateNaturalWorldTransactionJournal(
    JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(rawJournal)), filePath, identity.worldId)
  const current = await readExistingNaturalFile(filePath)
  if (journal) assertNaturalWorldTransactionRecord(journal, current?.record ?? null, identity)
  return current
}
function naturalWriteReceipt(record: NaturalWorldRuntimeSaveRecord) {
  return { fileSha256: sha256Json(record), recordContentSha256: record.recordContentSha256,
    tick: record.tick, stateVersion: record.stateVersion }
}
function naturalReadFailure(error: unknown): NaturalWorldRuntimeReadResult {
  return { status: "invalid", record: null, path: "", message: "Natural world read rejected.",
    warnings: [error instanceof Error ? error.message : String(error)], tags: ["natural_world_read", "failed"] }
}
function naturalWriteFailure(error: unknown): NaturalWorldRuntimeWriteResult {
  return { ok: false, code: "persistence_error", path: "", message: "Natural world was not written.",
    warnings: [error instanceof Error ? error.message : String(error)], tags: ["natural_world_write", "old_save_preserved"] }
}
