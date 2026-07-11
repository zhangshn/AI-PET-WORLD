import type { HomeMapStructure, HomeMapObject } from "./home-map-structure-schema"

export type CurrentWorldRuntimeStructureSource = {
  ownerId: string
  worldId: string
  tick: number
  homeMapState?: {
    seed?: string
  }
}

export type BuildCurrentWorldHomeMapStructureInput = {
  saveRecord: CurrentWorldRuntimeStructureSource
  sourceFactIds: string[]
  structureId?: string
  seed?: string
}

export function buildCurrentWorldHomeMapStructure(
  input: BuildCurrentWorldHomeMapStructureInput
): HomeMapStructure {
  const saveRecord = input.saveRecord
  const sourceFactIds = normalizeSourceFactIds(input.sourceFactIds, saveRecord.worldId)
  const seed = input.seed ?? saveRecord.homeMapState?.seed ?? `${saveRecord.worldId}:${saveRecord.tick}:natural-home`
  const structureId =
    input.structureId ??
    `home-map-structure-${saveRecord.worldId}-${saveRecord.tick}-natural-home`

  return {
    schemaVersion: "home-map-structure-v1",
    structureId,
    worldId: saveRecord.worldId,
    ownerId: saveRecord.ownerId,
    tick: saveRecord.tick,
    seed,
    size: {
      width: 1024,
      height: 768,
      tileSize: 16,
    },
    entryPoint: { x: 96, y: 704 },
    homeCenter: { x: 512, y: 408 },
    terrainRegions: [
      {
        id: "terrain-current-grass-main",
        kind: "grass",
        polygon: [
          { x: 0, y: 0 },
          { x: 1024, y: 0 },
          { x: 1024, y: 768 },
          { x: 0, y: 768 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 0, 2),
      },
      {
        id: "terrain-current-water-east",
        kind: "water",
        polygon: [
          { x: 1024, y: 0 },
          { x: 872, y: 0 },
          { x: 842, y: 96 },
          { x: 876, y: 198 },
          { x: 834, y: 308 },
          { x: 872, y: 426 },
          { x: 812, y: 548 },
          { x: 740, y: 652 },
          { x: 744, y: 768 },
          { x: 1024, y: 768 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 2, 4),
      },
      {
        id: "terrain-current-shoreline-east",
        kind: "shoreline",
        polygon: [
          { x: 838, y: 0 },
          { x: 814, y: 94 },
          { x: 844, y: 198 },
          { x: 806, y: 308 },
          { x: 844, y: 420 },
          { x: 786, y: 532 },
          { x: 716, y: 640 },
          { x: 724, y: 768 },
          { x: 756, y: 768 },
          { x: 752, y: 654 },
          { x: 824, y: 552 },
          { x: 884, y: 426 },
          { x: 846, y: 308 },
          { x: 884, y: 198 },
          { x: 854, y: 96 },
          { x: 880, y: 0 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 4, 6),
      },
      {
        id: "terrain-current-mud-worn-entry-path-edge",
        kind: "mud_patch",
        polygon: [
          { x: 112, y: 682 },
          { x: 230, y: 570 },
          { x: 374, y: 482 },
          { x: 474, y: 420 },
          { x: 526, y: 416 },
          { x: 470, y: 470 },
          { x: 346, y: 548 },
          { x: 230, y: 626 },
          { x: 132, y: 726 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 8, 10),
      },
      {
        id: "terrain-current-mud-home-center-wear",
        kind: "mud_patch",
        polygon: [
          { x: 458, y: 366 },
          { x: 560, y: 356 },
          { x: 636, y: 426 },
          { x: 610, y: 500 },
          { x: 500, y: 492 },
          { x: 430, y: 432 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 8, 12),
      },
      {
        id: "terrain-current-mud-water-approach",
        kind: "mud_patch",
        polygon: [
          { x: 646, y: 498 },
          { x: 716, y: 552 },
          { x: 790, y: 630 },
          { x: 774, y: 690 },
          { x: 690, y: 622 },
          { x: 620, y: 536 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 10, 12),
      },
      {
        id: "terrain-current-tall-grass-north-meadow",
        kind: "tall_grass",
        polygon: [
          { x: 214, y: 118 },
          { x: 446, y: 96 },
          { x: 612, y: 146 },
          { x: 568, y: 258 },
          { x: 314, y: 274 },
          { x: 194, y: 210 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 6, 10),
      },
      {
        id: "terrain-current-tall-grass-southwest-meadow",
        kind: "tall_grass",
        polygon: [
          { x: 78, y: 484 },
          { x: 266, y: 438 },
          { x: 376, y: 516 },
          { x: 308, y: 656 },
          { x: 132, y: 680 },
          { x: 48, y: 596 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 6, 10),
      },
      {
        id: "terrain-current-natural-boundary-west",
        kind: "natural_boundary",
        polygon: [
          { x: 0, y: 0 },
          { x: 128, y: 0 },
          { x: 128, y: 768 },
          { x: 0, y: 768 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 6, 8),
      },
      {
        id: "terrain-current-natural-boundary-north",
        kind: "natural_boundary",
        polygon: [
          { x: 0, y: 0 },
          { x: 828, y: 0 },
          { x: 800, y: 88 },
          { x: 650, y: 112 },
          { x: 472, y: 92 },
          { x: 286, y: 116 },
          { x: 128, y: 96 },
          { x: 0, y: 118 },
        ],
        sourceFactIds: factSlice(sourceFactIds, 6, 8),
      },
    ],
    paths: [
      {
        id: "path-current-entry-to-home",
        kind: "entry_path",
        points: [
          { x: 96, y: 704 },
          { x: 230, y: 588 },
          { x: 344, y: 514 },
          { x: 470, y: 438 },
          { x: 544, y: 410 },
        ],
        width: 32,
        connects: ["entry_point", "home_center"],
        sourceFactIds: factSlice(sourceFactIds, 8, 10),
      },
      {
        id: "path-current-home-to-water",
        kind: "branch_path",
        points: [
          { x: 544, y: 410 },
          { x: 636, y: 468 },
          { x: 706, y: 570 },
          { x: 786, y: 642 },
        ],
        width: 26,
        connects: ["home_center", "water_edge"],
        sourceFactIds: factSlice(sourceFactIds, 10, 12),
      },
    ],
    objects: buildCurrentWorldObjects(sourceFactIds),
    sourceFactIds,
    generationPolicy: {
      scope: "natural_home_mvp",
      allowAiPainterVisualFill: true,
      forbiddenFacts: [
        "character",
        "animal",
        "town",
        "city",
        "interior",
        "building_construction",
      ],
    },
    tags: [
      "natural_home_mvp",
      "current_world_runtime_source",
      "structure_first",
      "no_character",
      "no_animal",
      "no_building_construction",
    ],
  }
}

function buildCurrentWorldObjects(sourceFactIds: string[]): HomeMapObject[] {
  return [
    {
      id: "tree-current-northwest-canopy-1",
      kind: "tree",
      position: { x: 54, y: 58 },
      footprint: { x: 18, y: 0, width: 86, height: 118 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 10, 12),
    },
    {
      id: "tree-current-west-boundary-1",
      kind: "tree",
      position: { x: 92, y: 162 },
      footprint: { x: 58, y: 112, width: 92, height: 118 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 10, 12),
    },
    {
      id: "tree-current-west-boundary-2",
      kind: "tree",
      position: { x: 76, y: 366 },
      footprint: { x: 32, y: 310, width: 96, height: 120 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 12, 14),
    },
    {
      id: "tree-current-south-boundary-1",
      kind: "tree",
      position: { x: 24, y: 646 },
      footprint: { x: 0, y: 588, width: 48, height: 118 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 12, 14),
    },
    {
      id: "tree-current-north-grove-1",
      kind: "tree",
      position: { x: 776, y: 86 },
      footprint: { x: 732, y: 30, width: 98, height: 122 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 14, 16),
    },
    {
      id: "tree-current-southeast-grove-1",
      kind: "tree",
      position: { x: 612, y: 704 },
      footprint: { x: 568, y: 646, width: 96, height: 112 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 16, 18),
    },
    {
      id: "rock-current-north-open-1",
      kind: "rock",
      position: { x: 432, y: 128 },
      footprint: { x: 398, y: 108, width: 76, height: 52 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 14, 16),
    },
    {
      id: "rock-current-north-open-2",
      kind: "rock",
      position: { x: 606, y: 168 },
      footprint: { x: 576, y: 146, width: 66, height: 48 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 16, 18),
    },
    {
      id: "rock-current-east-bank-1",
      kind: "rock",
      position: { x: 930, y: 586 },
      footprint: { x: 898, y: 562, width: 70, height: 50 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 18, 20),
    },
    {
      id: "rock-current-shoreline-1",
      kind: "rock",
      position: { x: 860, y: 696 },
      footprint: { x: 828, y: 668, width: 72, height: 54 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: factSlice(sourceFactIds, 16, 18),
    },
    {
      id: "shrub-current-center-1",
      kind: "shrub",
      position: { x: 596, y: 332 },
      footprint: { x: 574, y: 312, width: 44, height: 36 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 18, 20),
    },
    {
      id: "shrub-current-north-meadow-1",
      kind: "shrub",
      position: { x: 270, y: 214 },
      footprint: { x: 246, y: 194, width: 52, height: 40 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 20, 22),
    },
    {
      id: "shrub-current-water-edge-1",
      kind: "shrub",
      position: { x: 782, y: 570 },
      footprint: { x: 756, y: 550, width: 54, height: 42 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 22, 24),
    },
    {
      id: "flower-current-south-1",
      kind: "flower_patch",
      position: { x: 454, y: 636 },
      footprint: { x: 420, y: 610, width: 74, height: 42 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 20, 22),
    },
    {
      id: "flower-current-meadow-1",
      kind: "flower_patch",
      position: { x: 318, y: 266 },
      footprint: { x: 286, y: 242, width: 72, height: 40 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 24, 26),
    },
    {
      id: "flower-current-bank-1",
      kind: "flower_patch",
      position: { x: 830, y: 610 },
      footprint: { x: 800, y: 588, width: 66, height: 38 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 26, 28),
    },
    {
      id: "flower-current-bank-2",
      kind: "flower_patch",
      position: { x: 902, y: 682 },
      footprint: { x: 872, y: 662, width: 62, height: 36 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 26, 28),
    },
    {
      id: "flower-current-entry-1",
      kind: "flower_patch",
      position: { x: 214, y: 620 },
      footprint: { x: 184, y: 598, width: 68, height: 40 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 26, 28),
    },
    {
      id: "flower-current-north-light-1",
      kind: "flower_patch",
      position: { x: 588, y: 172 },
      footprint: { x: 556, y: 150, width: 70, height: 40 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 24, 26),
    },
    {
      id: "flower-current-west-meadow-1",
      kind: "flower_patch",
      position: { x: 174, y: 426 },
      footprint: { x: 144, y: 406, width: 66, height: 38 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 24, 26),
    },
    {
      id: "flower-current-central-light-1",
      kind: "flower_patch",
      position: { x: 646, y: 382 },
      footprint: { x: 616, y: 360, width: 68, height: 40 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 24, 26),
    },
    {
      id: "flower-current-south-light-1",
      kind: "flower_patch",
      position: { x: 330, y: 692 },
      footprint: { x: 300, y: 672, width: 68, height: 38 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 26, 28),
    },
    {
      id: "grass-detail-current-center-1",
      kind: "grass_detail",
      position: { x: 432, y: 324 },
      footprint: { x: 400, y: 300, width: 76, height: 46 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 28, 30),
    },
    {
      id: "grass-detail-current-north-open-1",
      kind: "grass_detail",
      position: { x: 438, y: 222 },
      footprint: { x: 390, y: 194, width: 112, height: 64 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 28, 30),
    },
    {
      id: "grass-detail-current-west-open-1",
      kind: "grass_detail",
      position: { x: 236, y: 346 },
      footprint: { x: 188, y: 318, width: 108, height: 62 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 30, 32),
    },
    {
      id: "grass-detail-current-east-open-1",
      kind: "grass_detail",
      position: { x: 690, y: 332 },
      footprint: { x: 646, y: 304, width: 104, height: 60 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 28, 30),
    },
    {
      id: "grass-detail-current-southwest-open-1",
      kind: "grass_detail",
      position: { x: 268, y: 548 },
      footprint: { x: 224, y: 522, width: 104, height: 58 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 30, 32),
    },
    {
      id: "flower-current-northwest-light-1",
      kind: "flower_patch",
      position: { x: 226, y: 178 },
      footprint: { x: 190, y: 154, width: 82, height: 46 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 24, 26),
    },
    {
      id: "flower-current-east-meadow-1",
      kind: "flower_patch",
      position: { x: 708, y: 268 },
      footprint: { x: 672, y: 244, width: 82, height: 46 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 26, 28),
    },
    {
      id: "shrub-current-southwest-meadow-1",
      kind: "shrub",
      position: { x: 372, y: 604 },
      footprint: { x: 342, y: 580, width: 64, height: 48 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 22, 24),
    },
    {
      id: "grass-detail-current-south-1",
      kind: "grass_detail",
      position: { x: 602, y: 668 },
      footprint: { x: 568, y: 642, width: 82, height: 48 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: factSlice(sourceFactIds, 30, 32),
    },
  ]
}

function normalizeSourceFactIds(sourceFactIds: string[], worldId: string): string[] {
  const normalized = Array.from(
    new Set(
      [worldId, ...sourceFactIds]
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  ).sort()

  return normalized.length > 0 ? normalized : [worldId]
}

function factSlice(sourceFactIds: string[], start: number, end: number): string[] {
  const slice = sourceFactIds.slice(start, end)
  return slice.length > 0 ? slice : sourceFactIds.slice(0, 1)
}
