/**
 * 当前文件负责：根据 Scene Recipe 输出地图摆放结果。
 */

import type {
  HomeZoneType,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type { InitialHomeSceneRecipe } from "@/world/generation/generation-schema"
import { buildSeededNumber, pickSeededItem } from "@/world/generation/world-seed"

import type {
  CreatePlacementInput,
  PlacementRequest,
  PlacementResult,
} from "./placement-schema"
import { validatePlacementRules } from "./placement-rules"

export function buildInitialHomePlacements(
  input: PlacementRequest
): PlacementResult {
  const placements = [
    createPlacement({
      id: "base-grass",
      assetId: "groundGrassBase01",
      x: 1,
      y: 1,
      layer: "ground",
      label: "基础草地",
      tags: ["base_ground"],
    }),
    ...createAreaSupportPlacements(input),
    ...createPathPlacements(input),
    ...createCoreStructurePlacements(input),
    ...createFacilityPlacements(input),
    ...createNatureBoundaryPlacements(input),
    ...createSurfaceDecorationPlacements(input),
    ...createActorPlacements(input),
  ]

  const ruleResults = validatePlacements(placements, input.recipe)
  const rejectedPlacementIds = ruleResults.flatMap((result) =>
    result.passed || result.ruleId !== "avoid_collision"
      ? []
      : result.affectedPlacementIds
  )

  return {
    placements: sortPlacements(
      placements.filter((placement) => !rejectedPlacementIds.includes(placement.id))
    ),
    ruleResults,
    rejectedPlacementIds,
    warnings: ruleResults
      .filter((result) => !result.passed)
      .map((result) => result.message),
  }
}

export function validatePlacements(
  placements: MapPlacement[],
  recipe: InitialHomeSceneRecipe
) {
  return validatePlacementRules({
    placements,
    recipe,
  })
}

export function createPlacement(input: CreatePlacementInput): MapPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    x: input.x,
    y: input.y,
    layer: input.layer,
    scale: input.scale ?? 1,
    alpha: input.alpha ?? 1,
    label: input.label,
    source: input.source ?? "placement_engine",
    tags: input.tags ?? [],
  }
}

export function createAreaSupportPlacements(
  input: PlacementRequest
): MapPlacement[] {
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const care = requireArea(input.recipe, "initial_care")
  const rest = requireArea(input.recipe, "pet_rest")

  return [
    ...rectangleSupport("shelter-support", shelter.center.x - 4, shelter.center.y - 3, 8, 4, [
      "temporary_shelter_support",
    ]),
    ...rectangleSupport("care-support", care.center.x - 3, care.center.y - 1, 6, 3, [
      "care_support",
    ]),
    ...rectangleSupport("rest-support", rest.center.x - 2, rest.center.y - 1, 4, 2, [
      "rest_support",
    ]),
  ]
}

export function createPathPlacements(input: PlacementRequest): MapPlacement[] {
  const arrival = requireArea(input.recipe, "pet_arrival")
  const care = requireArea(input.recipe, "initial_care")
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const rest = requireArea(input.recipe, "pet_rest")

  const points = uniquePoints([
    ...walkAxisFirst(arrival.center, care.center),
    ...walkAxisFirst(care.center, shelter.center),
    ...walkAxisFirst(shelter.center, rest.center),
  ])

  return points.map((point, index) => {
    const previous = points[index - 1]
    const next = points[index + 1]

    return createPlacement({
      id: `main-path-${index + 1}`,
      assetId: getPathAssetId(previous, point, next),
      x: point.x,
      y: point.y,
      layer: "path",
      label: "连续泥土小路",
      source: "scene_recipe",
      tags: ["main_path", "core_connection"],
    })
  })
}

export function createNatureBoundaryPlacements(
  input: PlacementRequest
): MapPlacement[] {
  const treeCandidates = [
    { x: 7, y: 9 },
    { x: 12, y: 38 },
    { x: 68, y: 13 },
    { x: 72, y: 34 },
  ]
  const bushCandidates = [
    { x: 8, y: 12 },
    { x: 17, y: 31 },
    { x: 40, y: 21 },
    { x: 57, y: 26 },
    { x: 67, y: 16 },
    { x: 73, y: 24 },
  ]
  const treeOffset = Math.floor(buildSeededNumber(input.seed, "tree-offset") * 2)

  return [
    ...treeCandidates.map((point, index) =>
      createPlacement({
        id: `boundary-tree-${index + 1}`,
        assetId: "natureTreeSmall01",
        x: point.x + (index % 2 === 0 ? treeOffset : -treeOffset),
        y: point.y,
        layer: "nature",
        label: "自然边界小树",
        tags: ["nature_boundary", "tree"],
      })
    ),
    ...bushCandidates.map((point, index) =>
      createPlacement({
        id: `boundary-bush-${index + 1}`,
        assetId: "natureBushSmall01",
        x: point.x,
        y: point.y,
        layer: "nature",
        label: "自然边界灌木",
        scale: 0.9,
        tags: ["nature_boundary", "bush"],
      })
    ),
  ]
}

export function createSurfaceDecorationPlacements(
  input: PlacementRequest
): MapPlacement[] {
  const decorationAssets: WorldMapAssetId[] = [
    "surfaceGrassTuft01",
    "surfaceStoneSmall01",
    "surfaceFlowerPatch01",
    "surfaceFallenLeaf01",
  ]
  const points = [
    { x: 14, y: 24 },
    { x: 23, y: 22 },
    { x: 28, y: 22 },
    { x: 31, y: 30 },
    { x: 44, y: 39 },
    { x: 47, y: 19 },
    { x: 58, y: 24 },
    { x: 70, y: 35 },
    { x: 74, y: 18 },
    { x: 10, y: 34 },
  ]

  return points.map((point, index) =>
    createPlacement({
      id: `surface-decoration-${index + 1}`,
      assetId: pickSeededItem(decorationAssets, input.seed, `surface-${index}`),
      x: point.x,
      y: point.y,
      layer: "surface-decoration",
      label: "自然地表装饰",
      scale: 0.82,
      tags: ["surface_decoration", "natural_detail"],
    })
  )
}

function createCoreStructurePlacements(input: PlacementRequest): MapPlacement[] {
  const arrival = requireArea(input.recipe, "pet_arrival")
  const care = requireArea(input.recipe, "initial_care")
  const shelter = requireArea(input.recipe, "temporary_shelter")

  return [
    createPlacement({
      id: "pet-arrival-point",
      assetId: "buildingPetArrivalPoint01",
      x: arrival.center.x,
      y: arrival.center.y,
      layer: "structure",
      label: "宠物抵达点",
      scale: 0.92,
      tags: ["arrival_focus", "core_living"],
    }),
    createPlacement({
      id: "initial-care-station",
      assetId: "buildingInitialCareStation01",
      x: care.center.x,
      y: care.center.y + 1,
      layer: "structure",
      label: "初始照护点",
      scale: 0.72,
      alpha: 0.86,
      tags: ["care_station", "core_living"],
    }),
    createPlacement({
      id: "temporary-shelter",
      assetId: "buildingTempShelter01",
      x: shelter.center.x,
      y: shelter.center.y,
      layer: "structure",
      label: "临时住所",
      tags: ["temporary_shelter", "core_living"],
    }),
  ]
}

function createFacilityPlacements(input: PlacementRequest): MapPlacement[] {
  const care = requireArea(input.recipe, "initial_care")
  const rest = requireArea(input.recipe, "pet_rest")
  const storage = requireArea(input.recipe, "storage_tools")

  return [
    createPlacement({
      id: "food-bowl",
      assetId: "facilityFoodBowlFull01",
      x: care.center.x - 1,
      y: care.center.y,
      layer: "facility",
      label: "食物碗",
      scale: 0.9,
      tags: ["care", "food"],
    }),
    createPlacement({
      id: "water-bowl",
      assetId: "facilityWaterBowlFull01",
      x: care.center.x + 1,
      y: care.center.y,
      layer: "facility",
      label: "水盆",
      scale: 0.9,
      tags: ["care", "water"],
    }),
    createPlacement({
      id: "storage-box",
      assetId: "facilityStorageBoxClosed01",
      x: storage.center.x,
      y: storage.center.y,
      layer: "facility",
      label: "储物箱",
      scale: 0.82,
      tags: ["storage", "tools"],
    }),
    createPlacement({
      id: "pet-bed",
      assetId: "facilityPetBedNeat01",
      x: rest.center.x,
      y: rest.center.y,
      layer: "facility",
      label: "宠物床",
      scale: 0.96,
      tags: ["rest", "pet_bed"],
    }),
  ]
}

function createActorPlacements(input: PlacementRequest): MapPlacement[] {
  const arrival = requireArea(input.recipe, "pet_arrival")
  const shelter = requireArea(input.recipe, "temporary_shelter")

  return [
    createPlacement({
      id: "butler-near-shelter",
      assetId: "butlerBodyStandard01",
      x: shelter.center.x - 5,
      y: shelter.center.y + 4,
      layer: "actor",
      label: "管家",
      scale: 0.78,
      tags: ["butler", "actor"],
    }),
    createPlacement({
      id: "pet-near-arrival-point",
      assetId: "petPoseSkeletonIdleFront01",
      x: arrival.center.x + 4,
      y: arrival.center.y + 1,
      layer: "actor",
      label: "宠物",
      scale: 0.62,
      tags: ["pet", "actor"],
    }),
  ]
}

function rectangleSupport(
  idPrefix: string,
  startX: number,
  startY: number,
  width: number,
  height: number,
  tags: string[]
): MapPlacement[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = startX + (index % width)
    const y = startY + Math.floor(index / width)

    return createPlacement({
      id: `${idPrefix}-${x}-${y}`,
      assetId: "groundDirtBase01",
      x,
      y,
      layer: "ground",
      label: "泥地承托",
      source: "scene_recipe",
      tags: ["ground_support", ...tags],
    })
  })
}

function walkAxisFirst(
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const xStep = start.x <= end.x ? 1 : -1
  const yStep = start.y <= end.y ? 1 : -1

  for (let x = start.x; x !== end.x; x += xStep) {
    points.push({ x, y: start.y })
  }

  points.push({ x: end.x, y: start.y })

  for (let y = start.y + yStep; y !== end.y + yStep; y += yStep) {
    points.push({ x: end.x, y })
  }

  return points
}

function uniquePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const seen = new Set<string>()

  return points.filter((point) => {
    const key = `${point.x}:${point.y}`

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getPathAssetId(
  previous: { x: number; y: number } | undefined,
  current: { x: number; y: number },
  next: { x: number; y: number } | undefined
): WorldMapAssetId {
  if (!previous || !next) return "pathDirtHorizontal01"

  const horizontal =
    previous.y === current.y && next.y === current.y
  const vertical = previous.x === current.x && next.x === current.x

  if (horizontal) return "pathDirtHorizontal01"
  if (vertical) return "pathDirtVertical01"

  if (next.x > current.x && previous.y < current.y) {
    return "pathDirtCornerLeftTop01"
  }
  if (next.x > current.x && previous.y > current.y) {
    return "pathDirtCornerLeftBottom01"
  }
  if (next.x < current.x && previous.y < current.y) {
    return "pathDirtCornerRightTop01"
  }

  return "pathDirtCornerRightBottom01"
}

function requireArea(
  recipe: InitialHomeSceneRecipe,
  areaType: HomeZoneType
) {
  const area = recipe.areas.find((candidate) => candidate.areaType === areaType)

  if (!area) {
    throw new Error(`Missing initial home area: ${areaType}`)
  }

  return area
}

function sortPlacements(placements: MapPlacement[]): MapPlacement[] {
  const order: Record<MapPlacement["layer"], number> = {
    ground: 1,
    path: 2,
    edge: 3,
    zone: 4,
    structure: 5,
    facility: 6,
    nature: 7,
    "surface-decoration": 8,
    actor: 9,
    atmosphere: 10,
  }

  return [...placements].sort((a, b) => {
    const layerDiff = order[a.layer] - order[b.layer]

    if (layerDiff !== 0) return layerDiff
    if (a.y !== b.y) return a.y - b.y

    return a.x - b.x
  })
}
