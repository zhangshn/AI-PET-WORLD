import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  WorldVisualFactManifest,
  WorldVisualFixPlan,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

const VISUAL_FIX_PLAN_DIR = path.join(
  process.cwd(),
  "data",
  "world-visual-fix-plans"
)

export type WorldVisualFixPlanRecord = {
  version: "world-visual-fix-plan-v1"
  ownerId: string
  worldId: string
  tick: number
  savedAt: string
  fixPlan: WorldVisualFixPlan
  reviewReport: WorldVisualReviewReport
  sourceFactIds: string[]
  canShowToPlayer: false
  tags: string[]
}

export type WorldVisualFixPlanStoreWriteResult = {
  ok: boolean
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export type WorldVisualFixPlanStoreReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: WorldVisualFixPlanRecord | null
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export async function writeWorldVisualFixPlanRecord(input: {
  ownerId: string
  worldId: string
  tick: number
  fixPlan: WorldVisualFixPlan
  reviewReport: WorldVisualReviewReport
  factManifest: WorldVisualFactManifest
}): Promise<WorldVisualFixPlanStoreWriteResult> {
  const record: WorldVisualFixPlanRecord = {
    version: "world-visual-fix-plan-v1",
    ownerId: input.ownerId,
    worldId: input.worldId,
    tick: input.tick,
    savedAt: new Date().toISOString(),
    fixPlan: input.fixPlan,
    reviewReport: input.reviewReport,
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_visual_fix_plan_record",
      input.fixPlan.status,
      "visual_expression_only",
      "world_facts_locked",
      "not_player_visible",
    ],
  }

  const filePath = getWorldVisualFixPlanRecordPath(record)
  const tempPath = `${filePath}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    await rename(tempPath, filePath)
    await writeLatestWorldVisualFixPlanIndex({
      record,
      filePath,
    })

    return {
      ok: true,
      path: filePath,
      message: "Visual fix plan record written.",
      warnings: [],
      tags: ["world_visual_fix_plan_store_write", "ok"],
    }
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      message: "Visual fix plan record could not be written.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_fix_plan_store_write", "failed"],
    }
  }
}

export async function readLatestWorldVisualFixPlanRecord(input: {
  ownerId: string
  worldId: string
}): Promise<WorldVisualFixPlanStoreReadResult> {
  const indexPath = getLatestWorldVisualFixPlanIndexPath(input)

  try {
    const indexRaw = await readFile(indexPath, "utf8")
    const index = JSON.parse(indexRaw) as Partial<{ path: string }>
    if (typeof index.path !== "string") {
      return invalidRead(indexPath, "Latest visual fix plan index is invalid.")
    }

    const raw = await readFile(index.path, "utf8")
    const parsed = JSON.parse(raw) as Partial<WorldVisualFixPlanRecord>
    if (!isWorldVisualFixPlanRecord(parsed)) {
      return invalidRead(index.path, "Visual fix plan record shape is invalid.")
    }

    return {
      status: "found",
      record: parsed,
      path: index.path,
      message: "Visual fix plan record loaded.",
      warnings: [],
      tags: ["world_visual_fix_plan_store_read", "found"],
    }
  } catch (error) {
    if (isNodeFileError(error) && error.code === "ENOENT") {
      return {
        status: "empty",
        record: null,
        path: indexPath,
        message: "No visual fix plan record found.",
        warnings: [],
        tags: ["world_visual_fix_plan_store_read", "empty"],
      }
    }

    return {
      status: "failed",
      record: null,
      path: indexPath,
      message: "Visual fix plan record could not be read.",
      warnings: [error instanceof Error ? error.message : String(error)],
      tags: ["world_visual_fix_plan_store_read", "failed"],
    }
  }
}

function getWorldVisualFixPlanRecordPath(
  record: WorldVisualFixPlanRecord
): string {
  return path.join(
    VISUAL_FIX_PLAN_DIR,
    record.ownerId,
    record.worldId,
    `fix-plan-${record.tick}-${safeFileToken(record.fixPlan.planId)}.json`
  )
}

function getLatestWorldVisualFixPlanIndexPath(input: {
  ownerId: string
  worldId: string
}): string {
  return path.join(
    VISUAL_FIX_PLAN_DIR,
    input.ownerId,
    input.worldId,
    "latest-fix-plan.json"
  )
}

async function writeLatestWorldVisualFixPlanIndex(input: {
  record: WorldVisualFixPlanRecord
  filePath: string
}): Promise<void> {
  const indexPath = getLatestWorldVisualFixPlanIndexPath(input.record)
  const tempPath = `${indexPath}.tmp`
  const index = {
    version: "world-visual-fix-plan-index-v1",
    ownerId: input.record.ownerId,
    worldId: input.record.worldId,
    tick: input.record.tick,
    planId: input.record.fixPlan.planId,
    status: input.record.fixPlan.status,
    path: input.filePath,
    updatedAt: input.record.savedAt,
    tags: ["world_visual_fix_plan_latest_index"],
  }

  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")
  await rename(tempPath, indexPath)
}

function invalidRead(
  filePath: string,
  message: string
): WorldVisualFixPlanStoreReadResult {
  return {
    status: "invalid",
    record: null,
    path: filePath,
    message,
    warnings: [message],
    tags: ["world_visual_fix_plan_store_read", "invalid"],
  }
}

function isWorldVisualFixPlanRecord(
  value: Partial<WorldVisualFixPlanRecord>
): value is WorldVisualFixPlanRecord {
  return (
    value.version === "world-visual-fix-plan-v1" &&
    typeof value.ownerId === "string" &&
    typeof value.worldId === "string" &&
    typeof value.tick === "number" &&
    typeof value.savedAt === "string" &&
    Boolean(value.fixPlan) &&
    Boolean(value.reviewReport) &&
    Array.isArray(value.sourceFactIds) &&
    value.canShowToPlayer === false &&
    Array.isArray(value.tags)
  )
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function isNodeFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}