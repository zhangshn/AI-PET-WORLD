import { mkdir, readFile, open, rename, rm, lstat } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { dirname, join, resolve } from "node:path"

import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import { isGameMapRuntimeFrame } from "./game-map-runtime-frame-schema"
import { assertRuntimePathSegment } from "../runtime/runtime-path-security"

export type GameMapRuntimeFrameRecord = {
  recordId: string
  ownerId: string
  worldId: string
  tick: number
  sourceFactIds: string[]
  createdAt: string
  runtimeFrame: GameMapRuntimeFrame
  canShowInWorld: boolean
  tags: string[]
}

export type GameMapRuntimeFrameReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: GameMapRuntimeFrameRecord | null
  path: string
  warnings: string[]
  tags: string[]
}

export type GameMapRuntimeFrameWriteResult = {
  status: "written" | "blocked_invalid_runtime_frame" | "failed"
  record: GameMapRuntimeFrameRecord | null
  recordPath: string | null
  latestPath: string
  warnings: string[]
  tags: string[]
}

export async function writeGameMapRuntimeFrameRecord(input: {
  runtimeFrame: GameMapRuntimeFrame
  createdAt?: string
  outputRoot?: string
}): Promise<GameMapRuntimeFrameWriteResult> {
  const latestPath = getLatestGameMapRuntimeFramePath(input.outputRoot)
  if (!isGameMapRuntimeFrame(input.runtimeFrame)) {
    return {
      status: "blocked_invalid_runtime_frame",
      record: null,
      recordPath: null,
      latestPath,
      warnings: ["runtime_frame_schema_invalid"],
      tags: ["game_map_runtime_frame_write", "blocked"],
    }
  }

  // Freeze this call's payload before the first asynchronous filesystem step.
  const runtimeFrame = structuredClone(input.runtimeFrame)
  const createdAt = input.createdAt ?? new Date().toISOString()
  const record: GameMapRuntimeFrameRecord = {
    recordId: `game-map-runtime-frame-record-${runtimeFrame.worldId}-${runtimeFrame.tick}-${safeTimestamp(createdAt)}-${randomUUID()}`,
    ownerId: runtimeFrame.ownerId,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    sourceFactIds: runtimeFrame.sourceFactIds,
    createdAt,
    runtimeFrame,
    canShowInWorld: runtimeFrame.worldPageContract.canShowInWorld,
    tags: [
      "game_map_runtime_frame_record",
      runtimeFrame.worldPageContract.canShowInWorld
        ? "world_page_ready"
        : "world_page_blocked_until_composite_map",
      "written_from_game_map_runtime_frame",
    ],
  }

  let recordPath: string | null = null
  let lock: Awaited<ReturnType<typeof open>> | null = null
  let lockPath = ""
  let lockBytes = ""
  let prepared = false
  const warnings: string[] = []
  try {
    const worldLatestPath = getWorldLatestGameMapRuntimeFramePath(record.worldId, input.outputRoot)
    const transactionPath = `${worldLatestPath}.transaction.json`
    lockPath = `${worldLatestPath}.lock`
    await mkdir(dirname(worldLatestPath), { recursive: true })
    // Exclusive creation works across calls, module instances and processes.
    // Existing locks are never inferred stale from a PID or a timestamp.
    lock = await open(lockPath, "wx")
    const transactionId = randomUUID()
    lockBytes = jsonBytes({ transactionId, worldId: record.worldId, pid: process.pid })
    await lock.writeFile(lockBytes, "utf8")
    await lock.sync()

    const publication = await readPublicationState(record.worldId, input.outputRoot)
    if (publication.warning) throw storeError(publication.warning)
    const previousRaw = await readOptionalFile(worldLatestPath)
    if (previousRaw !== null) {
      const previous = normalizeGameMapRuntimeFrameRecord(JSON.parse(previousRaw))
      if (!previous || previous.worldId !== record.worldId) {
        throw storeError("game_map_runtime_frame_previous_record_invalid")
      }
      await assertCommittedRecord(publication.journal, previous, previousRaw, input.outputRoot)
      if (record.tick < previous.tick) {
        throw storeError("game_map_runtime_frame_stale_tick")
      }
    } else if (publication.journal !== null) {
      throw storeError("game_map_runtime_frame_previous_record_missing")
    }

    recordPath = getGameMapRuntimeFrameRecordPath(record, input.outputRoot)
    await mkdir(getGameMapRuntimeFrameRecordDir(record, input.outputRoot), { recursive: true })
    const transactionDir = join(dirname(worldLatestPath), "transactions")
    await mkdir(transactionDir, { recursive: true })
    const recordBytes = jsonBytes(record)
    const intent = {
      schemaVersion: "game-map-runtime-frame-transaction-v1",
      transactionId, state: "prepared", recordPath, latestPath, worldLatestPath,
      recordId: record.recordId, recordSha256: sha256(recordBytes),
      worldId: record.worldId, tick: record.tick,
      previousRecordSha256: previousRaw === null ? null : sha256(previousRaw),
      createdAtUtc: new Date().toISOString(),
    }
    // Preserve the original intent even after the active journal commits.
    // Any failure from here retains this call's lock and all written bytes.
    prepared = true
    await writeExclusive(join(transactionDir, `${transactionId}.prepared.json`), jsonBytes(intent))
    await writeAtomic(transactionPath, intent)
    await writeExclusive(recordPath, recordBytes)
    await writeAtomic(worldLatestPath, record)
    const committed = {
      ...intent, state: "committed",
      committedAtUtc: new Date().toISOString(),
    }
    await writeExclusive(join(transactionDir, `${transactionId}.committed.json`), jsonBytes(committed))
    await writeAtomic(transactionPath, committed)

    // Root latest is a best-effort diagnostic only, outside the world commit.
    // A diagnostic failure must not invalidate another world's publication.
    try {
      await writeAtomic(latestPath, record)
    } catch (error) {
      warnings.push(`game_map_runtime_frame_diagnostic_write_failed:${readErrorCode(error) ?? "unknown"}`)
    }
    await releaseOwnedLock(lock, lockPath, lockBytes)
    lock = null

    return {
      status: "written",
      record,
      recordPath,
      latestPath,
      warnings,
      tags: ["game_map_runtime_frame_write", "written"],
    }
  } catch (error) {
    // A preflight refusal created no publication intent. Release only the
    // lease acquired by this live call; unknown or replaced locks stay intact.
    if (lock && !prepared) {
      try {
        await releaseOwnedLock(lock, lockPath, lockBytes)
        lock = null
      } catch (releaseError) {
        warnings.push(`game_map_runtime_frame_lock_release_failed:${readErrorCode(releaseError) ?? "unknown"}`)
      }
    }
    if (lock) await lock.close().catch(() => undefined)
    return {
      status: "failed",
      record,
      recordPath,
      latestPath,
      warnings: [...warnings, `game_map_runtime_frame_write_failed:${readErrorCode(error) ?? "unknown"}`],
      tags: ["game_map_runtime_frame_write", "failed"],
    }
  }
}

export async function readLatestGameMapRuntimeFrameRecord(input?: {
  ownerId?: string
  worldId?: string
  currentTick?: number
  currentSourceFactIds?: string[]
  filePath?: string
  outputRoot?: string
}): Promise<GameMapRuntimeFrameReadResult> {
  if (!input?.filePath && !input?.worldId) {
    return invalid(getLatestGameMapRuntimeFramePath(input?.outputRoot), ["world_id_required_for_runtime_frame_read"])
  }
  let filePath: string
  try {
    filePath = input?.filePath ?? getWorldLatestGameMapRuntimeFramePath(input!.worldId!, input?.outputRoot)
  } catch {
    return invalid(getLatestGameMapRuntimeFramePath(), ["world_id_invalid"])
  }

  try {
    let before = input?.worldId
      ? await readPublicationState(input.worldId, input.outputRoot, filePath)
      : null
    if (before?.warning) return invalid(filePath, [before.warning])
    const raw = await readOptionalFile(filePath)
    if (raw === null) {
      if (before?.journal) {
        return invalid(filePath, ["game_map_runtime_frame_committed_record_missing"])
      }
      return {
        status: "empty", record: null, path: filePath,
        warnings: ["game_map_runtime_frame_record_missing"],
        tags: ["game_map_runtime_frame_read", "empty"],
      }
    }
    const parsed = JSON.parse(raw) as Partial<GameMapRuntimeFrameRecord>
    const record = normalizeGameMapRuntimeFrameRecord(parsed)

    if (!record) {
      return invalid(filePath, ["game_map_runtime_frame_record_schema_invalid"])
    }

    // Explicit historical reads may omit worldId. Once it is known, bracket
    // a second read with journal snapshots instead of trusting the first one.
    if (!before) {
      before = await readPublicationState(record.worldId, input?.outputRoot, filePath)
      if (before.warning) return invalid(filePath, [before.warning])
      if (await readOptionalFile(filePath) !== raw) {
        return invalid(filePath, ["game_map_runtime_frame_record_changed_during_read"])
      }
    }
    const publication = await readPublicationState(input?.worldId ?? record.worldId, input?.outputRoot, filePath)
    if (publication.warning) return invalid(filePath, [publication.warning])
    if (before && before.fingerprint !== publication.fingerprint) {
      return invalid(filePath, ["game_map_runtime_frame_transaction_changed_during_read"])
    }
    if (resolve(filePath) === resolve(getWorldLatestGameMapRuntimeFramePath(record.worldId, input?.outputRoot))) {
      await assertCommittedRecord(publication.journal, record, raw, input?.outputRoot)
    }

    const warnings = validateCurrentRuntimeFrameRecord(record, input)
    if (warnings.length > 0) {
      return {
        status: "invalid",
        record,
        path: filePath,
        warnings,
        tags: ["game_map_runtime_frame_read", "invalid"],
      }
    }

    return {
      status: "found",
      record,
      path: filePath,
      warnings: [],
      tags: ["game_map_runtime_frame_read", "found"],
    }
  } catch (error) {
    const code = readErrorCode(error)
    if (code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: filePath,
        warnings: ["game_map_runtime_frame_record_missing"],
        tags: ["game_map_runtime_frame_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: filePath,
      warnings: [`game_map_runtime_frame_read_failed:${code ?? "unknown"}`],
      tags: ["game_map_runtime_frame_read", "failed"],
    }
  }
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await writeExclusive(temporaryPath, jsonBytes(value))
  await rename(temporaryPath, filePath)
}

async function writeExclusive(filePath: string, bytes: string): Promise<void> {
  const handle = await open(filePath, "wx")
  try {
    await handle.writeFile(bytes, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function releaseOwnedLock(
  handle: Awaited<ReturnType<typeof open>>, filePath: string, bytes: string
): Promise<void> {
  const owned = await handle.stat()
  const current = await lstat(filePath)
  if (!current.isFile() || current.isSymbolicLink() || owned.dev !== current.dev || owned.ino !== current.ino ||
      await readFile(filePath, "utf8") !== bytes) {
    throw storeError("game_map_runtime_frame_lock_identity_conflict")
  }
  await rm(filePath)
  await handle.close()
}

type TransactionJournal = {
  schemaVersion: string
  state: "prepared" | "committed"
  worldId: string
  tick: number
  transactionId?: string
  recordId?: string
  recordSha256?: string
  recordPath?: string
  worldLatestPath?: string
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(/* turbopackIgnore: true */ filePath, "utf8")
  } catch (error) {
    if (readErrorCode(error) === "ENOENT") return null
    throw error
  }
}

async function readPublicationState(worldId: string, outputRoot?: string, filePath?: string): Promise<{
  journal: TransactionJournal | null; fingerprint: string; warning: string | null
}> {
  const worldPath = `${getWorldLatestGameMapRuntimeFramePath(worldId, outputRoot)}.transaction.json`
  const worldRaw = await readOptionalFile(worldPath)
  const rootPath = `${getLatestGameMapRuntimeFramePath(outputRoot)}.transaction.json`
  const rootRaw = await readOptionalFile(rootPath)
  const explicitPath = filePath ? `${filePath}.transaction.json` : null
  const explicitRaw = explicitPath && resolve(explicitPath) !== resolve(worldPath) && resolve(explicitPath) !== resolve(rootPath)
    ? await readOptionalFile(explicitPath) : null
  let journal: TransactionJournal | null = null
  let warning: string | null = null
  let matchingRootRaw: string | null = null
  for (const [raw, scope] of [[worldRaw, "world"], [rootRaw, "root"], [explicitRaw, "explicit"]] as const) {
    if (raw === null) continue
    const value = JSON.parse(raw) as TransactionJournal | null
    if (!value || value.schemaVersion !== "game-map-runtime-frame-transaction-v1" ||
        (value.state !== "prepared" && value.state !== "committed") ||
        typeof value.worldId !== "string" || !Number.isInteger(value.tick)) {
      warning = "game_map_runtime_frame_transaction_identity_unknown"
      break
    }
    try {
      assertRuntimePathSegment(value.worldId, "worldId")
    } catch {
      warning = "game_map_runtime_frame_transaction_identity_unknown"
      break
    }
    if (scope !== "root" && value.worldId !== worldId) {
      warning = "game_map_runtime_frame_transaction_world_mismatch"
      break
    }
    // The legacy root journal cannot impose world A's transaction on world B.
    // It remains untouched, including when a new scoped journal exists.
    if (value.worldId !== worldId) continue
    if (scope === "root") matchingRootRaw = raw
    if (value.state === "prepared") {
      warning = "game_map_runtime_frame_transaction_incomplete"
      break
    }
    if (scope === "world") journal = value
  }
  return { journal, fingerprint: jsonBytes([worldRaw, matchingRootRaw, explicitRaw]), warning }
}

async function assertCommittedRecord(
  journal: TransactionJournal | null, record: GameMapRuntimeFrameRecord, raw: string, outputRoot?: string
): Promise<void> {
  if (!journal) return // Legacy world indexes had no scoped journal.
  const recordPath = getGameMapRuntimeFrameRecordPath(record, outputRoot)
  if (journal.tick !== record.tick || typeof journal.transactionId !== "string" || journal.transactionId.length === 0 ||
      journal.recordId !== record.recordId || journal.recordSha256 !== sha256(raw) ||
      journal.recordPath !== recordPath || journal.worldLatestPath !== getWorldLatestGameMapRuntimeFramePath(record.worldId, outputRoot)) {
    throw storeError("game_map_runtime_frame_committed_record_conflict")
  }
  // Recompute from the immutable record as well as the index copy; a valid
  // digest string in a journal alone is not publication evidence.
  const immutableRaw = await readOptionalFile(recordPath)
  if (immutableRaw === null || immutableRaw !== raw) {
    throw storeError("game_map_runtime_frame_committed_record_conflict")
  }
}

function storeError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code })
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeGameMapRuntimeFrameRecord(
  value: Partial<GameMapRuntimeFrameRecord> | null
): GameMapRuntimeFrameRecord | null {
  if (
    !value ||
    typeof value.recordId !== "string" ||
    typeof value.ownerId !== "string" ||
    typeof value.worldId !== "string" ||
    !Number.isInteger(value.tick) ||
    !Array.isArray(value.sourceFactIds) ||
    typeof value.createdAt !== "string" ||
    typeof value.canShowInWorld !== "boolean" ||
    !Array.isArray(value.tags) ||
    !isGameMapRuntimeFrame(value.runtimeFrame) ||
    value.ownerId !== value.runtimeFrame.ownerId ||
    value.worldId !== value.runtimeFrame.worldId ||
    value.tick !== value.runtimeFrame.tick ||
    !sameStringSet(value.sourceFactIds, value.runtimeFrame.sourceFactIds) ||
    value.canShowInWorld !== value.runtimeFrame.worldPageContract.canShowInWorld
  ) {
    return null
  }

  return value as GameMapRuntimeFrameRecord
}

function validateCurrentRuntimeFrameRecord(
  record: GameMapRuntimeFrameRecord,
  input?: {
    ownerId?: string
    worldId?: string
    currentTick?: number
    currentSourceFactIds?: string[]
  }
): string[] {
  const warnings: string[] = []
  if (input?.ownerId && record.ownerId !== input.ownerId) {
    warnings.push("owner_id_mismatch")
  }
  if (input?.worldId && record.worldId !== input.worldId) {
    warnings.push("world_id_mismatch")
  }
  if (typeof input?.currentTick === "number" && record.tick !== input.currentTick) {
    warnings.push("tick_mismatch")
  }
  if (
    input?.currentSourceFactIds &&
    !sameStringSet(record.sourceFactIds, input.currentSourceFactIds)
  ) {
    warnings.push("source_fact_ids_mismatch")
  }
  if (!record.runtimeFrame.worldPageContract.canShowInWorld) {
    warnings.push("world_page_contract_blocked")
  }
  if (!record.runtimeFrame.tags.includes("composite_game_map_runtime_frame")) {
    warnings.push("composite_game_map_runtime_frame_tag_missing")
  }
  if (!record.runtimeFrame.composition.compositionStatus.canEnterWorld) {
    warnings.push("composition_status_blocks_world")
  }
  if (
    !record.runtimeFrame.composition.tags.includes("composite_game_map_runtime_frame")
  ) {
    warnings.push("composition_manifest_world_tag_missing")
  }
  if (record.runtimeFrame.composition.compositeOutput === null) {
    warnings.push("composition_composite_output_missing")
  }
  if (record.runtimeFrame.worldPageContract.page !== "/world") {
    warnings.push("world_page_contract_mismatch")
  }
  return warnings
}

function invalid(filePath: string, warnings: string[]): GameMapRuntimeFrameReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    warnings,
    tags: ["game_map_runtime_frame_read", "invalid"],
  }
}

function getGameMapRuntimeFrameRoot(outputRoot?: string): string {
  return outputRoot
    ? outputRoot
    : join(
        /* turbopackIgnore: true */ process.cwd(),
        ".runtime",
        "game-map-runtime-frame"
      )
}

function getLatestGameMapRuntimeFramePath(outputRoot?: string): string {
  return join(
    getGameMapRuntimeFrameRoot(outputRoot),
    "latest-runtime-frame.json"
  )
}

function getWorldLatestGameMapRuntimeFramePath(worldId: string, outputRoot?: string): string {
  assertRuntimePathSegment(worldId, "worldId")
  return join(getGameMapRuntimeFrameRoot(outputRoot), "worlds", worldId, "latest-runtime-frame.json")
}

function getGameMapRuntimeFrameRecordDir(
  record: Pick<GameMapRuntimeFrameRecord, "worldId" | "tick">,
  outputRoot?: string
): string {
  assertRuntimePathSegment(record.worldId, "worldId")
  return join(getGameMapRuntimeFrameRoot(outputRoot), "records", record.worldId, String(record.tick))
}

function getGameMapRuntimeFrameRecordPath(
  record: Pick<GameMapRuntimeFrameRecord, "worldId" | "tick" | "recordId">,
  outputRoot?: string
): string {
  if (/[\\/\0]/u.test(record.recordId)) {
    throw storeError("game_map_runtime_frame_record_id_path_invalid")
  }
  return join(getGameMapRuntimeFrameRecordDir(record, outputRoot), `${record.recordId}.json`)
}

function readErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : null
  }
  return null
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function safeTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}
