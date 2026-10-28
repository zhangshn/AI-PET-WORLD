/**
 * Local runtime-only file store for the live world runtime.
 *
 * Server-side adapter implementation. Formal runtime code should import
 * world-runtime-store-adapter instead of depending on this implementation.
 */

import { mkdir, open, readFile, rename, rm, readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
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


const RUNTIME_DIR = path.join(
  process.cwd(),
  "data",
  "world-runtime"
)
const LATEST_WORLD_FILE = "latest-world.json"

export const localFileRuntimeStore: WorldRuntimeStoreAdapter = {
  kind: "local_file_runtime_store",
  readNatural: (input) => readNaturalWorldRuntimeSaveRecord(input),
  writeNatural: (input) => writeNaturalWorldRuntimeSaveRecord(input),
  read: (input) => readLocalFileWorldRuntimeSaveRecord(input),
  write: (input) => writeLocalFileWorldRuntimeSaveRecord(input),
  getDefaultSavePath: () => getDefaultLocalFileWorldRuntimeSavePath(),
}

export function getDefaultWorldRuntimeSavePath(): string {
  return localFileRuntimeStore.getDefaultSavePath()
}

export async function readWorldRuntimeSaveRecord(
  input?: { filePath?: string; ownerId?: string; worldId?: string }
): Promise<WorldRuntimeStoreReadResult> {
  return localFileRuntimeStore.read(input)
}

export async function writeWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
  expectedTick?: number
}): Promise<WorldRuntimeStoreWriteResult> {
  return localFileRuntimeStore.write(input)
}

function getDefaultLocalFileWorldRuntimeSavePath(): string {
  return path.join(RUNTIME_DIR, LATEST_WORLD_FILE)
}

function readLocalFileWorldRuntimeSaveRecord(input?: LegacyReadInput): Promise<WorldRuntimeStoreReadResult>
function readLocalFileWorldRuntimeSaveRecord(input: NaturalWorldRuntimeReadInput, natural: true): Promise<NaturalWorldRuntimeReadResult>
async function readLocalFileWorldRuntimeSaveRecord(input?: LegacyReadInput & Partial<NaturalWorldRuntimeReadInput>, natural = false): Promise<InternalReadResult> {
  const resolvedFilePath = input?.filePath
    ? await assertRuntimePath(input.filePath, RUNTIME_DIR)
    : input?.ownerId && input?.worldId
      ? await assertRuntimePath(getWorldRuntimeSavePath({ ownerId: input.ownerId, worldId: input.worldId } as WorldRuntimeSaveRecord), RUNTIME_DIR)
      : input?.worldId
        ? await resolveWorldRuntimeSavePathByWorldId(input.worldId)
      : await resolveLatestWorldRuntimeSavePath()

  if (!resolvedFilePath) {
    return {
      status: "empty",
      record: null,
      path: getDefaultLocalFileWorldRuntimeSavePath(),
      message: "No runtime save record found.",
      warnings: [],
      tags: ["world_runtime_store_read", "empty"],
    }
  }

  try {
    const transactionPath = `${resolvedFilePath}.transaction.json`
    const transaction = natural ? null : await readTransactionJournal(transactionPath)
    if (transaction?.state === "prepared") {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save has an unfinished multi-file transaction.",
        warnings: ["runtime_transaction_incomplete"],
        tags: ["world_runtime_store_read", "invalid", "runtime_transaction_incomplete"],
      }
    }
    const naturalFile = natural ? await readNaturalTransactionRecord(resolvedFilePath, input as NaturalWorldRuntimeReadInput) : null
    if (natural && !naturalFile) return {
      status: "empty", record: null, path: resolvedFilePath, message: "No runtime save record found.",
      warnings: [], tags: ["world_runtime_store_read", "empty"],
    }
    const parsed = naturalFile ? naturalFile.record : JSON.parse(await readFile(resolvedFilePath, "utf8")) as WorldRuntimeSaveRecord

    if (!natural && !isWorldRuntimeSaveRecord(parsed)) {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save record exists but is not valid.",
        warnings: ["Invalid runtime save record shape."],
        tags: ["world_runtime_store_read", "invalid"],
      }
    }
    if ((input?.worldId && parsed.worldId !== input.worldId) || (input?.ownerId && parsed.ownerId !== input.ownerId)) {
      return {
        status: "invalid",
        record: null,
        path: resolvedFilePath,
        message: "Runtime save identity does not match the requested world.",
        warnings: ["runtime_requested_identity_mismatch"],
        tags: ["world_runtime_store_read", "invalid", "runtime_requested_identity_mismatch"],
      }
    }

    if (naturalFile) assertNaturalWorldReadMatch(naturalFile.record, input as NaturalWorldRuntimeReadInput, naturalFile.fileSha256)
    return {
      ...(naturalFile ? { fileSha256: naturalFile.fileSha256 } : {}),
      status: "found",
      record: parsed,
      path: resolvedFilePath,
      message: "Runtime save record loaded.",
      warnings: [],
      tags: ["world_runtime_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: resolvedFilePath,
        message: "No runtime save record found.",
        warnings: [],
        tags: ["world_runtime_store_read", "empty"],
      }
    }

    return {
      status: natural ? "invalid" : "failed",
      record: null,
      path: resolvedFilePath,
      message: "Runtime save record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_runtime_store_read", "failed"],
    }
  }
}

async function resolveWorldRuntimeSavePathByWorldId(worldId: string): Promise<string | null> {
  assertRuntimePathSegment(worldId, "worldId")
  let entries
  try {
    entries = await readdir(RUNTIME_DIR, { withFileTypes: true })
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(RUNTIME_DIR, entry.name, `${worldId}.json`))
    .filter((candidate) => existsSync(candidate))
  if (matches.length > 1) throw new Error("runtime_world_id_ambiguous")
  return matches[0] ? assertRuntimePath(matches[0], RUNTIME_DIR) : null
}

function writeLocalFileWorldRuntimeSaveRecord(input: LegacyWriteInput): Promise<WorldRuntimeStoreWriteResult>
function writeLocalFileWorldRuntimeSaveRecord(input: NaturalWorldRuntimeWriteInput & { record: NaturalWorldRuntimeSaveRecord }, natural: true): Promise<NaturalWorldRuntimeWriteResult>
async function writeLocalFileWorldRuntimeSaveRecord(input: InternalWriteInput, natural = false): Promise<NaturalWorldRuntimeWriteResult> {
  const filePath = await assertRuntimePath(
    input.filePath ?? getWorldRuntimeSavePath(input.record),
    RUNTIME_DIR,
  )
  const lockPath = `${filePath}.lock`
  let lock: Awaited<ReturnType<typeof open>> | null = null
  const lockToken = randomUUID()
  let recordReplaced = false

  try {
    if (natural) decodeNaturalWorldRuntimeRecord(Buffer.from(`${JSON.stringify(input.record, null, 2)}\n`, "utf8"))
    else if (!isWorldRuntimeSaveRecord(input.record)) throw new Error("runtime record schema invalid")
    await mkdir(path.dirname(filePath), { recursive: true })
    try {
      lock = await open(lockPath, "wx")
      await lock.writeFile(`${JSON.stringify({
        schemaVersion: "world-runtime-write-lock-v1",
        pid: process.pid,
        host: hostname(),
        ownerId: input.record.ownerId,
        worldId: input.record.worldId,
        lockToken,
        createdAtUtc: new Date().toISOString(),
      })}\n`, "utf8")
      await lock.sync()
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
        return {
          ok: false,
          code: "conflict",
          path: filePath,
          message: "Another runtime writer currently owns this world.",
          warnings: ["runtime_write_lock_exists"],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict"],
        }
      }
      throw error
    }
    const transactionPath = `${filePath}.transaction.json`
    const transaction = natural ? null : await readTransactionJournal(transactionPath)
    if (transaction?.state === "prepared") throw new Error("runtime_transaction_incomplete")
    const naturalCurrent = natural ? await readNaturalTransactionRecord(filePath, input.record) : null
    const existing = natural ? naturalCurrent?.record ?? null : await readExistingRuntimeRecord(filePath)
    if (natural) {
      const conflict = naturalWorldCasConflict(naturalCurrent?.record ?? null, input.record as NaturalWorldRuntimeSaveRecord,
        input as NaturalWorldRuntimeWriteInput, naturalCurrent?.fileSha256 ?? null)
      if (conflict) return { ok: false, code: "conflict", path: filePath, message: conflict,
        warnings: [conflict], tags: ["world_runtime_store_write", "failed", "natural_world_cas_rejected"] }
    }
    if (input.expectedTick !== undefined) {
      if ((existing?.tick ?? -1) !== input.expectedTick) {
        return {
          ok: false,
          code: "conflict",
          path: filePath,
          message: "Runtime tick compare-and-set rejected the stale writer.",
          warnings: [`expected_tick:${input.expectedTick}`, `actual_tick:${existing?.tick ?? -1}`],
          tags: ["world_runtime_store_write", "failed", "runtime_save_write_conflict", "runtime_tick_cas_rejected"],
        }
      }
    }
    await writeTransactionJournal(transactionPath, {
      ...(natural ? { recordKind: "natural_world", stateVersion: (input.record as NaturalWorldRuntimeSaveRecord).stateVersion,
        recordContentSha256: (input.record as NaturalWorldRuntimeSaveRecord).recordContentSha256 } : {}),
      schemaVersion: "world-runtime-transaction-v1",
      state: "prepared",
      recordPath: filePath,
      latestPath: natural || input.filePath ? null : getDefaultLocalFileWorldRuntimeSavePath(),
      worldId: input.record.worldId,
      tick: input.record.tick,
      createdAtUtc: new Date().toISOString(),
    })
    await writeJsonAtomic(filePath, input.record)
    recordReplaced = true
    if (!natural && !input.filePath) {
      await writeLatestWorldRuntimeIndex({
        record: input.record as WorldRuntimeSaveRecord,
        filePath,
      })
    }
    await writeTransactionJournal(transactionPath, {
      ...(natural ? { recordKind: "natural_world", stateVersion: (input.record as NaturalWorldRuntimeSaveRecord).stateVersion,
        recordContentSha256: (input.record as NaturalWorldRuntimeSaveRecord).recordContentSha256 } : {}),
      schemaVersion: "world-runtime-transaction-v1",
      state: "committed",
      recordPath: filePath,
      latestPath: natural || input.filePath ? null : getDefaultLocalFileWorldRuntimeSavePath(),
      worldId: input.record.worldId,
      tick: input.record.tick,
      committedAtUtc: new Date().toISOString(),
    })
    await rm(transactionPath, { force: true })

    return {
      ...(natural ? naturalWriteReceipt(input.record as NaturalWorldRuntimeSaveRecord) : {}),
      ok: true,
      path: filePath,
      message: "Runtime save record written.",
      warnings: [],
      tags: ["world_runtime_store_write", "ok"],
    }
  } catch (error) {
    return {
      ok: false,
      code: "persistence_error",
      path: filePath,
      message: recordReplaced
        ? "Runtime save record was replaced; transaction finalization failed."
        : "Runtime save record was not overwritten.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_runtime_store_write", "failed", recordReplaced ? "runtime_save_record_replaced" : "old_save_preserved"],
    }
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

async function writeTransactionJournal(filePath: string, value: unknown): Promise<void> {
  await writeJsonAtomic(filePath, value)
}

async function readTransactionJournal(filePath: string): Promise<{ state?: string } | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as { state?: string }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function readExistingRuntimeRecord(filePath: string): Promise<WorldRuntimeSaveRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<WorldRuntimeSaveRecord>
    if (!isWorldRuntimeSaveRecord(parsed)) throw new Error("runtime record schema invalid")
    return parsed
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") return null
    throw error
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await mkdir(path.dirname(filePath), { recursive: true })
  const handle = await open(tempPath, "wx")
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    await handle.sync()
  } finally {
    await handle.close().catch(() => {})
  }
  await rename(tempPath, filePath)
}

function getWorldRuntimeSavePath(record: Pick<WorldRuntimeSaveRecord, "ownerId" | "worldId">): string {
  return path.join(RUNTIME_DIR, record.ownerId, `${record.worldId}.json`)
}

async function resolveLatestWorldRuntimeSavePath(): Promise<string | null> {
  try {
    const indexPath = await assertRuntimePath(
      getDefaultLocalFileWorldRuntimeSavePath(),
      RUNTIME_DIR,
    )
    const raw = await readFile(indexPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<{
      path: string
      ownerId: string
      worldId: string
      tick: number
      recordSha256: string
    }>

    if (
      typeof parsed.path !== "string" ||
      typeof parsed.ownerId !== "string" ||
      typeof parsed.worldId !== "string" ||
      !Number.isInteger(parsed.tick) ||
      !/^[a-f0-9]{64}$/u.test(parsed.recordSha256 ?? "")
    ) return null

    assertRuntimePathSegment(parsed.ownerId, "ownerId")
    assertRuntimePathSegment(parsed.worldId, "worldId")
    const resolved = await assertRuntimePath(parsed.path, RUNTIME_DIR)
    if (resolved !== getWorldRuntimeSavePath({ ownerId: parsed.ownerId, worldId: parsed.worldId } as WorldRuntimeSaveRecord)) return null
    const record = await readExistingRuntimeRecord(resolved)
    if (!record || record.ownerId !== parsed.ownerId || record.worldId !== parsed.worldId || record.tick !== parsed.tick || sha256Json(record) !== parsed.recordSha256) return null
    return resolved
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return null
    }

    throw error
  }
}

async function writeLatestWorldRuntimeIndex(input: {
  record: WorldRuntimeSaveRecord
  filePath: string
}): Promise<void> {
  const indexPath = await assertRuntimePath(
    getDefaultLocalFileWorldRuntimeSavePath(),
    RUNTIME_DIR,
  )
  const index = {
    schemaVersion: "world-runtime-latest-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    path: input.filePath,
    recordSha256: sha256Json(input.record),
    updatedAt: input.record.savedAt,
  }

  await writeJsonAtomic(indexPath, index)
}

function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    .digest("hex")
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

export async function readNaturalWorldRuntimeSaveRecord(input: NaturalWorldRuntimeReadInput): Promise<NaturalWorldRuntimeReadResult> {
  try {
    assertNaturalWorldReadInput(input)
    const fixed = structuredClone(input)
    assertRuntimePathSegment(fixed.ownerId, "ownerId"); assertRuntimePathSegment(fixed.worldId, "worldId")
    return await readLocalFileWorldRuntimeSaveRecord(fixed, true)
  } catch (error) { return naturalReadFailure(error) }
}
export async function writeNaturalWorldRuntimeSaveRecord(input: NaturalWorldRuntimeWriteInput): Promise<NaturalWorldRuntimeWriteResult> {
  try {
    const fixed = snapshotNaturalWorldWrite(input)
    assertRuntimePathSegment(fixed.record.ownerId, "ownerId"); assertRuntimePathSegment(fixed.record.worldId, "worldId")
    return await writeLocalFileWorldRuntimeSaveRecord(fixed, true)
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
async function readNaturalTransactionRecord(filePath: string, identity: { ownerId: string; worldId: string }) {
  let rawJournal: Buffer | null = null
  const journalPath = `${filePath}.transaction.json`
  try {
    await assertRuntimePath(journalPath, RUNTIME_DIR)
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
