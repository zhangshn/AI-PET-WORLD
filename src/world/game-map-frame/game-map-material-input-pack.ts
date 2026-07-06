import { mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import sharp from "sharp"

import type {
  GameMapMaterialGenerationRequest,
  GameMapMaterialGenerationTask,
} from "./game-map-material-generation-request"

export type GameMapMaterialInputPack = {
  schemaVersion: "game-map-material-input-pack-v1"
  packId: string
  requestId: string
  worldId: string
  tick: number
  outputRoot: string
  slots: GameMapMaterialInputSlot[]
  tags: string[]
}

export type GameMapMaterialInputSlot = {
  slotId: string
  taskId: string
  unitKind: string
  inputKind: string
  bounds: GameMapMaterialGenerationTask["bounds"]
  maskGeometry: GameMapMaterialGenerationTask["maskGeometry"]
  conditionMaskPath: string
  taskPath: string
  expectedOutputFileName: string
  canEnterWorldDirectly: false
  tags: string[]
}

export type BuildGameMapMaterialInputPackResult = {
  passed: boolean
  pack: GameMapMaterialInputPack | null
  packPath: string | null
  blockedReasons: string[]
  tags: string[]
}

export async function buildGameMapMaterialInputPack(input: {
  request: GameMapMaterialGenerationRequest
  outputRoot?: string
  createdAt?: string
}): Promise<BuildGameMapMaterialInputPackResult> {
  const validation = validateRequest(input.request)
  if (!validation.passed) {
    return blocked("material_input_pack_request_invalid", validation.blockedReasons)
  }

  const createdAt = input.createdAt ?? new Date().toISOString()
  const outputRoot = input.outputRoot
    ? resolve(input.outputRoot)
    : join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "game-map-material-input-packs")
  const packId = `material-input-pack-${input.request.worldId}-${input.request.tick}-${safeTimestamp(createdAt)}`
  const packRoot = join(outputRoot, input.request.worldId, String(input.request.tick), packId)
  const slots: GameMapMaterialInputSlot[] = []

  for (const task of input.request.tasks) {
    const slotRoot = join(packRoot, "slots", task.slotId)
    const conditionMaskPath = join(slotRoot, "condition-mask.png")
    const taskPath = join(slotRoot, "slot-task.json")
    await mkdir(slotRoot, { recursive: true })
    await writeConditionMask(task, conditionMaskPath)
    await writeFile(
      taskPath,
      JSON.stringify(
        {
          schemaVersion: "game-map-material-input-slot-v1",
          requestId: input.request.requestId,
          task,
          outputContract: {
            expectedOutputFileName: task.outputFileName,
            canEnterWorldDirectly: false,
          },
          tags: [
            "game_map_material_input_slot",
            "condition_mask_only",
            "not_world_page_runtime",
            "not_visual_material",
          ],
        },
        null,
        2
      ),
      "utf8"
    )
    slots.push({
      slotId: task.slotId,
      taskId: task.taskId,
      unitKind: task.unitKind,
      inputKind: task.inputKind,
      bounds: task.bounds,
      maskGeometry: task.maskGeometry,
      conditionMaskPath,
      taskPath,
      expectedOutputFileName: task.outputFileName,
      canEnterWorldDirectly: false,
      tags: [
        "game_map_material_input_slot",
        "condition_mask_only",
        "not_world_page_runtime",
      ],
    })
  }

  const pack: GameMapMaterialInputPack = {
    schemaVersion: "game-map-material-input-pack-v1",
    packId,
    requestId: input.request.requestId,
    worldId: input.request.worldId,
    tick: input.request.tick,
    outputRoot: packRoot,
    slots,
    tags: [
      "game_map_material_input_pack",
      "condition_masks_for_local_model",
      "not_world_page_runtime",
      "not_visual_material",
    ],
  }
  const packPath = join(packRoot, "material-input-pack.json")
  const latestPath = join(outputRoot, input.request.worldId, String(input.request.tick), "latest-material-input-pack.json")
  await mkdir(join(outputRoot, input.request.worldId, String(input.request.tick)), { recursive: true })
  await writeFile(packPath, JSON.stringify(pack, null, 2), "utf8")
  await writeFile(
    latestPath,
    JSON.stringify(
      {
        schemaVersion: "game-map-material-input-pack-index-v1",
        packId,
        worldId: input.request.worldId,
        tick: input.request.tick,
        path: packPath,
        slotCount: slots.length,
        tags: ["material_input_pack_latest_index", "not_world_page_runtime"],
      },
      null,
      2
    ),
    "utf8"
  )

  return {
    passed: true,
    pack,
    packPath,
    blockedReasons: [],
    tags: ["material_input_pack_written"],
  }
}

function validateRequest(request: GameMapMaterialGenerationRequest): {
  passed: boolean
  blockedReasons: string[]
} {
  const blockedReasons: string[] = []
  if (request.schemaVersion !== "game-map-material-generation-request-v1") {
    blockedReasons.push("request_schema_invalid")
  }
  if (request.outputContract.canEnterWorldDirectly !== false) {
    blockedReasons.push("request_output_contract_must_block_world")
  }
  if (!Array.isArray(request.tasks) || request.tasks.length === 0) {
    blockedReasons.push("request_tasks_missing")
  }
  for (const task of request.tasks ?? []) {
    if (!task.outputFileName.endsWith(".png")) {
      blockedReasons.push(`task_${task.slotId}_output_not_png`)
    }
    if (!task.forbiddenPayloads.includes("program_final_render")) {
      blockedReasons.push(`task_${task.slotId}_program_render_not_forbidden`)
    }
  }
  return { passed: blockedReasons.length === 0, blockedReasons }
}

async function writeConditionMask(
  task: GameMapMaterialGenerationTask,
  outputPath: string
): Promise<void> {
  const width = Math.max(1, Math.ceil(task.bounds.width))
  const height = Math.max(1, Math.ceil(task.bounds.height))
  const svg = buildConditionMaskSvg(task, width, height)
  await sharp(Buffer.from(svg)).png().toFile(outputPath)
}

function buildConditionMaskSvg(
  task: GameMapMaterialGenerationTask,
  width: number,
  height: number
): string {
  const geometry = task.maskGeometry
  const shape =
    geometry.kind === "polygon"
      ? `<polygon points="${geometry.points
          .map((point) => `${round(point.x - task.bounds.x)},${round(point.y - task.bounds.y)}`)
          .join(" ")}" fill="#ffffff" />`
      : `<rect x="${round(geometry.rect.x - task.bounds.x)}" y="${round(
          geometry.rect.y - task.bounds.y
        )}" width="${round(geometry.rect.width)}" height="${round(
          geometry.rect.height
        )}" fill="#ffffff" />`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#000000" />`,
    shape,
    `</svg>`,
  ].join("")
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function blocked(
  tag: string,
  blockedReasons: string[]
): BuildGameMapMaterialInputPackResult {
  return {
    passed: false,
    pack: null,
    packPath: null,
    blockedReasons,
    tags: [tag],
  }
}

function safeTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}
