import { mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import type {
  GameMapCompositeManifest,
  GameMapPainterInputKind,
  GameMapVisualUnitKind,
} from "./game-map-composite-schema"

export type GameMapMaterialGenerationRequest = {
  schemaVersion: "game-map-material-generation-request-v1"
  requestId: string
  worldId: string
  ownerId: string
  tick: number
  manifestId: string
  sourceFactIds: string[]
  outputContract: {
    expectedFilePattern: "slotId.png"
    requiredFormat: "png"
    outputDirectoryPurpose: "approved_visual_unit_material_candidates"
    canEnterWorldDirectly: false
  }
  tasks: GameMapMaterialGenerationTask[]
  tags: string[]
}

export type GameMapMaterialGenerationTask = {
  taskId: string
  slotId: string
  unitKind: GameMapVisualUnitKind
  inputKind: GameMapPainterInputKind
  outputFileName: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  maskGeometry: GameMapCompositeManifest["visualUnitSlots"][number]["maskGeometry"]
  zIndex: number
  sourceFactIds: string[]
  mustPreserveFacts: string[]
  forbiddenPayloads: string[]
  tags: string[]
}

export type BuildGameMapMaterialGenerationRequestResult = {
  passed: boolean
  request: GameMapMaterialGenerationRequest | null
  requestPath: string | null
  latestPath: string | null
  blockedReasons: string[]
  tags: string[]
}

export async function writeGameMapMaterialGenerationRequest(input: {
  manifest: GameMapCompositeManifest
  outputRoot?: string
  createdAt?: string
}): Promise<BuildGameMapMaterialGenerationRequestResult> {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const request = buildGameMapMaterialGenerationRequest(input.manifest, createdAt)
  const validation = validateGameMapMaterialGenerationRequest(request)
  if (!validation.passed) {
    return {
      passed: false,
      request: null,
      requestPath: null,
      latestPath: null,
      blockedReasons: validation.blockedReasons,
      tags: ["material_generation_request_blocked"],
    }
  }

  const outputRoot = input.outputRoot
    ? resolve(input.outputRoot)
    : join(
        /* turbopackIgnore: true */ process.cwd(),
        ".runtime",
        "game-map-material-generation-requests"
      )
  const outputDir = join(outputRoot, request.worldId, String(request.tick), request.requestId)
  const requestPath = join(outputDir, "material-generation-request.json")
  const latestPath = join(outputRoot, request.worldId, String(request.tick), "latest-material-generation-request.json")
  await mkdir(outputDir, { recursive: true })
  await mkdir(join(outputRoot, request.worldId, String(request.tick)), { recursive: true })
  await writeFile(requestPath, JSON.stringify(request, null, 2), "utf8")
  await writeFile(
    latestPath,
    JSON.stringify(
      {
        schemaVersion: "game-map-material-generation-request-index-v1",
        requestId: request.requestId,
        worldId: request.worldId,
        tick: request.tick,
        path: requestPath,
        taskCount: request.tasks.length,
        tags: ["material_generation_request_latest_index", "not_world_page_runtime"],
      },
      null,
      2
    ),
    "utf8"
  )

  return {
    passed: true,
    request,
    requestPath,
    latestPath,
    blockedReasons: [],
    tags: ["material_generation_request_written"],
  }
}

export function buildGameMapMaterialGenerationRequest(
  manifest: GameMapCompositeManifest,
  createdAt: string
): GameMapMaterialGenerationRequest {
  return {
    schemaVersion: "game-map-material-generation-request-v1",
    requestId: `material-generation-request-${manifest.worldId}-${manifest.tick}-${safeTimestamp(createdAt)}`,
    worldId: manifest.worldId,
    ownerId: manifest.ownerId,
    tick: manifest.tick,
    manifestId: manifest.manifestId,
    sourceFactIds: [...manifest.sourceFactIds],
    outputContract: {
      expectedFilePattern: "slotId.png",
      requiredFormat: "png",
      outputDirectoryPurpose: "approved_visual_unit_material_candidates",
      canEnterWorldDirectly: false,
    },
    tasks: manifest.visualUnitSlots.map((slot) => ({
      taskId: `material-task-${slot.slotId}`,
      slotId: slot.slotId,
      unitKind: slot.unitKind,
      inputKind: slot.painterContract.inputKind,
      outputFileName: `${slot.slotId}.png`,
      bounds: {
        x: slot.bounds.x,
        y: slot.bounds.y,
        width: slot.bounds.width,
        height: slot.bounds.height,
      },
      maskGeometry: slot.maskGeometry,
      zIndex: slot.zIndex,
      sourceFactIds: [...slot.sourceFactIds],
      mustPreserveFacts: [...slot.painterContract.mustPreserveFacts],
      forbiddenPayloads: [...slot.painterContract.forbiddenPayloads],
      tags: [
        "ai_painter_visual_unit_material_task",
        "not_world_page_runtime",
        "must_be_reviewed_before_material_pack",
      ],
    })),
    tags: [
      "game_map_material_generation_request",
      "not_world_page_runtime",
      "not_approved_material_pack",
    ],
  }
}

export function validateGameMapMaterialGenerationRequest(
  request: GameMapMaterialGenerationRequest
): { passed: boolean; blockedReasons: string[] } {
  const blockedReasons: string[] = []
  if (request.schemaVersion !== "game-map-material-generation-request-v1") {
    blockedReasons.push("material_generation_request_schema_invalid")
  }
  if (!isNonEmptyString(request.requestId)) blockedReasons.push("request_id_missing")
  if (!isNonEmptyString(request.worldId)) blockedReasons.push("world_id_missing")
  if (!isNonEmptyString(request.ownerId)) blockedReasons.push("owner_id_missing")
  if (!Number.isInteger(request.tick)) blockedReasons.push("tick_invalid")
  if (!isNonEmptyString(request.manifestId)) blockedReasons.push("manifest_id_missing")
  if (!isNonEmptyStringArray(request.sourceFactIds)) {
    blockedReasons.push("source_fact_ids_missing")
  }
  if (!request.outputContract || request.outputContract.canEnterWorldDirectly !== false) {
    blockedReasons.push("output_contract_must_block_world_direct_display")
  }
  if (!Array.isArray(request.tasks) || request.tasks.length === 0) {
    blockedReasons.push("tasks_missing")
  }
  for (const task of request.tasks ?? []) {
    if (!isNonEmptyString(task.slotId)) blockedReasons.push("task_slot_id_missing")
    if (!task.outputFileName.endsWith(".png")) {
      blockedReasons.push(`task_${task.slotId}_output_file_not_png`)
    }
    if (!isValidMaskGeometry(task.maskGeometry)) {
      blockedReasons.push(`task_${task.slotId}_mask_geometry_invalid`)
    }
    if (!task.forbiddenPayloads.includes("new_world_fact")) {
      blockedReasons.push(`task_${task.slotId}_new_world_fact_not_forbidden`)
    }
    if (!task.forbiddenPayloads.includes("program_final_render")) {
      blockedReasons.push(`task_${task.slotId}_program_final_render_not_forbidden`)
    }
    if (!task.tags.includes("must_be_reviewed_before_material_pack")) {
      blockedReasons.push(`task_${task.slotId}_review_tag_missing`)
    }
  }
  if (!request.tags.includes("not_approved_material_pack")) {
    blockedReasons.push("request_not_approved_material_pack_tag_missing")
  }
  return {
    passed: blockedReasons.length === 0,
    blockedReasons,
  }
}

function isValidMaskGeometry(
  value: GameMapMaterialGenerationTask["maskGeometry"] | unknown
): value is GameMapMaterialGenerationTask["maskGeometry"] {
  if (!isRecord(value)) return false
  if (value.kind === "polygon") {
    return Array.isArray(value.points) && value.points.length >= 3
  }
  if (value.kind === "rect") {
    return isRecord(value.rect)
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function safeTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}
