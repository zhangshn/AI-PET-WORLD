/**
 * 当前文件负责：根据 Scene Recipe 输出稳定地图摆放结果。
 */

import type {
  HomeMapSize,
  HomeZoneType,
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  InitialHomeAreaRecipe,
  InitialHomeSceneRecipe,
} from "@/world/generation/generation-schema"
import { buildSeededNumber, pickSeededItem } from "@/world/generation/world-seed"

import {
  INITIAL_HOME_LAYOUT_RULES,
  getPlacementDistance,
  isFunctionalCorePlacement,
  isSupportPlacement,
  shouldAvoidCoreZone,
  shouldAvoidPathOverlap,
} from "./layout-rules"
import type {
  CreatePlacementInput,
  PlacementRequest,
  PlacementResult,
} from "./placement-schema"
import { validatePlacementRules } from "./placement-rules"

type PointRoute = MapCoordinate[]

export function buildInitialHomePlacements(
  input: PlacementRequest
): PlacementResult {
  const groundPlacements = createGroundTilePlacements(input)
  const supportPlacements = createAreaSupportPlacements(input)
  const pathPlacements = createPathPlacements(input)
  const structurePlacements = createCoreStructurePlacements(input)
  const facilityPlacements = createFacilityPlacements(
    input,
    supportPlacements,
    pathPlacements
  )
  const naturePlacements = createNatureBoundaryPlacements(input, [
    ...supportPlacements,
    ...pathPlacements,
    ...structurePlacements,
    ...facilityPlacements,
  ])
  const decorationPlacements = createSurfaceDecorationPlacements(input, [
    ...supportPlacements,
    ...pathPlacements,
    ...structurePlacements,
    ...facilityPlacements,
    ...naturePlacements,
  ])
  const placements = [
    ...groundPlacements,
    ...supportPlacements,
    ...pathPlacements,
    ...structurePlacements,
    ...facilityPlacements,
    ...naturePlacements,
    ...decorationPlacements,
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

export function createGroundTilePlacements(
  input: PlacementRequest
): MapPlacement[] {
  const { columns, rows } = input.recipe.mapSize

  return Array.from({ length: columns * rows }, (_, index) => {
    const x = (index % columns) + 1
    const y = Math.floor(index / columns) + 1

    return createPlacement({
      id: `ground-${x}-${y}`,
      assetId: pickGroundAssetId(input, { x, y }),
      x,
      y,
      layer: "ground",
      label: "基础草地",
      source: "placement_engine",
      tags: ["base_ground_tile", "tilemap_ground"],
    })
  })
}

export function createAreaSupportPlacements(
  input: PlacementRequest
): MapPlacement[] {
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const care = requireArea(input.recipe, "initial_care")
  const quietLivingPoint = resolveQuietLivingPoint(input)

  return [
    ...createSoftSupportPlacements(
      input,
      "shelter-support",
      shelter.center.x - 4,
      shelter.center.y - 3,
      8,
      4,
      ["temporary_shelter_support"]
    ),
    ...createSoftSupportPlacements(input, "care-support", care.center.x - 3, care.center.y - 1, 6, 3, [
      "care_support",
    ]),
    ...createSoftSupportPlacements(
      input,
      "quiet-living-support",
      quietLivingPoint.x - 2,
      quietLivingPoint.y - 1,
      4,
      2,
      ["quiet_living_support"]
    ),
  ]
}

export function createPathPlacements(input: PlacementRequest): MapPlacement[] {
  const entry = requireArea(input.recipe, "entry_area")
  const care = requireArea(input.recipe, "initial_care")
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const quietLivingPoint = resolveQuietLivingPoint(input)
  const route = buildCorePathRoute(input, [
    entry.center,
    care.center,
    shelter.center,
    quietLivingPoint,
  ])

  const points = uniquePoints(
    route.flatMap((point, index) => {
      const next = route[index + 1]

      if (!next) return [point]

      return walkAxisFirst(point, next)
    })
  )

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
  input: PlacementRequest,
  existingPlacements: MapPlacement[] = []
): MapPlacement[] {
  const area = requireArea(input.recipe, "natural_boundary")
  const protective = input.butlerConstructionStyle.protectiveKeeper
  const treeCount = getDensityCount(area.density, 3) + Math.round(protective * 3)
  const bushCount = getDensityCount(area.density, 4) + Math.round(protective * 5)
  const targetCount = treeCount + bushCount
  const pathPlacements = existingPlacements.filter(
    (placement) => placement.layer === "path"
  )
  const rawPoints = [
    ...createSeededAreaPoints(area, input.seed, "boundary-tree", treeCount * 4),
    ...createSeededAreaPoints(area, input.seed, "boundary-bush", bushCount * 4),
  ].map((point, index) =>
    pushPointTowardBoundary(
      point,
      input.recipe.mapSize,
      buildSeededNumber(input.seed, `boundary-side-${index}`)
    )
  )
  const points = uniquePoints(rawPoints)
    .filter(
      (point) =>
        !shouldAvoidCoreZone({
          point,
          zones: input.zones,
          mapSize: input.recipe.mapSize,
        })
    )
    .filter(
      (point) =>
        !shouldAvoidPathOverlap({
          point,
          pathPlacements,
          minDistance:
            INITIAL_HOME_LAYOUT_RULES.natureBoundary.naturePathAvoidDistance,
        })
    )
    .filter(
      (point) =>
        !isNearBlockedPlacement(point, existingPlacements, [
          "facility",
          "structure",
        ])
    )

  return points.slice(0, targetCount).map((point, index) => {
    const isTree = index < treeCount

    return createPlacement({
      id: `${isTree ? "boundary-tree" : "boundary-bush"}-${index + 1}`,
      assetId: isTree ? "natureTreeSmall01" : "natureBushSmall01",
      x: point.x,
      y: point.y,
      layer: "nature",
      label: isTree ? "自然边界小树" : "自然边界灌木",
      scale: isTree ? 1 : 0.9,
      tags: ["nature_boundary", isTree ? "tree" : "bush"],
    })
  })
}

export function createSurfaceDecorationPlacements(
  input: PlacementRequest,
  existingPlacements: MapPlacement[] = []
): MapPlacement[] {
  const decorationAssets: WorldMapAssetId[] = [
    "surfaceGrassTuft01",
    "surfaceStoneSmall01",
    "surfaceFlowerPatch01",
    "surfaceFallenLeaf01",
  ]
  const aesthetic = input.butlerConstructionStyle.aestheticOrganizer
  const supportPlacements = existingPlacements.filter(isSupportPlacement)
  const pathPlacements = existingPlacements.filter(
    (placement) => placement.layer === "path"
  )
  const decorationCount =
    getDensityCount("medium", 7) + Math.round(aesthetic * 7)
  const edgePoints = createSupportEdgePoints(
    supportPlacements,
    input.recipe.mapSize,
    input.seed,
    "surface-decoration-edge"
  )
  const boundaryArea = requireArea(input.recipe, "natural_boundary")
  const boundaryTransitionPoints = createSeededAreaPoints(
    boundaryArea,
    input.seed,
    "surface-decoration-boundary",
    decorationCount * 2
  ).map((point, index) =>
    pushPointTowardBoundary(
      point,
      input.recipe.mapSize,
      buildSeededNumber(input.seed, `surface-boundary-side-${index}`)
    )
  )
  const points = uniquePoints([...edgePoints, ...boundaryTransitionPoints])
    .filter(
      (point) =>
        !shouldAvoidPathOverlap({
          point,
          pathPlacements,
          minDistance:
            INITIAL_HOME_LAYOUT_RULES.surfaceDecoration
              .decorationPathAvoidDistance,
        })
    )
    .filter(
      (point) =>
        !isNearBlockedPlacement(point, existingPlacements, [
          "facility",
          "structure",
        ])
    )
    .slice(0, decorationCount)

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

export function createSeededAreaPoints(
  area: InitialHomeAreaRecipe,
  seed: string,
  salt: string,
  count: number
): MapCoordinate[] {
  const bounds = getAreaBounds(area)

  return Array.from({ length: count }, (_, index) => {
    const xSeed = buildSeededNumber(seed, `${salt}-x-${index}`)
    const ySeed = buildSeededNumber(seed, `${salt}-y-${index}`)

    return {
      x: bounds.x + Math.floor(xSeed * bounds.width),
      y: bounds.y + Math.floor(ySeed * bounds.height),
    }
  })
}

export function getDensityCount(
  density: InitialHomeAreaRecipe["density"],
  baseCount: number
): number {
  const multiplier = {
    none: 0,
    low: 0.65,
    medium: 1,
    high: 1.35,
  }[density]

  return Math.max(0, Math.round(baseCount * multiplier))
}

export function clampPointToMap(
  point: MapCoordinate,
  mapSize: HomeMapSize
): MapCoordinate {
  return {
    x: Math.min(mapSize.columns, Math.max(1, point.x)),
    y: Math.min(mapSize.rows, Math.max(1, point.y)),
  }
}

export function avoidCorePathPoints(
  points: MapCoordinate[],
  existingPathPlacements: MapPlacement[]
): MapCoordinate[] {
  const blocked = new Set(
    existingPathPlacements.flatMap((placement) => [
      `${placement.x}:${placement.y}`,
      `${placement.x + 1}:${placement.y}`,
      `${placement.x - 1}:${placement.y}`,
      `${placement.x}:${placement.y + 1}`,
      `${placement.x}:${placement.y - 1}`,
    ])
  )

  return points.filter((point) => !blocked.has(`${point.x}:${point.y}`))
}

function createCoreStructurePlacements(input: PlacementRequest): MapPlacement[] {
  const care = requireArea(input.recipe, "initial_care")
  const shelter = requireArea(input.recipe, "temporary_shelter")

  return [
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

function createFacilityPlacements(
  input: PlacementRequest,
  supportPlacements: MapPlacement[],
  pathPlacements: MapPlacement[]
): MapPlacement[] {
  const storagePoint = resolveStoragePoint(input, supportPlacements, pathPlacements)

  return [
    createPlacement({
      id: "storage-box",
      assetId: "facilityStorageBoxClosed01",
      x: storagePoint.x,
      y: storagePoint.y,
      layer: "facility",
      label: "储物箱",
      scale: 0.82,
      tags: ["storage", "tools"],
    }),
  ]
}

function createActorPlacements(input: PlacementRequest): MapPlacement[] {
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
  ]
}

function pickGroundAssetId(
  input: PlacementRequest,
  point: MapCoordinate
): WorldMapAssetId {
  const variantSeed = buildSeededNumber(
    input.seed,
    `ground-${point.x}-${point.y}`
  )
  const edgeDistance = Math.min(
    point.x - 1,
    point.y - 1,
    input.recipe.mapSize.columns - point.x,
    input.recipe.mapSize.rows - point.y
  )
  const inVisualCenter =
    point.x >= input.recipe.visualCenter.start.x &&
    point.x <= input.recipe.visualCenter.end.x &&
    point.y >= input.recipe.visualCenter.start.y &&
    point.y <= input.recipe.visualCenter.end.y
  const variantThreshold = inVisualCenter
    ? 0.08
    : edgeDistance <= 5
      ? 0.28
      : 0.16

  return variantSeed < variantThreshold
    ? "groundGrassBase02"
    : "groundGrassBase01"
}

function resolveQuietLivingPoint(input: PlacementRequest): MapCoordinate {
  const quietLiving = requireArea(input.recipe, "quiet_living")
  const care = requireArea(input.recipe, "initial_care")
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const style = input.butlerConstructionStyle
  const adaptiveOffset = getAdaptiveOffset(style.adaptivePlanner)
  const warmBias = style.warmCaretaker > 0.65 ? -1 : 0
  const quietBias = style.quietMaintainer > 0.6 ? 2 : 0
  const x = Math.round(
    quietLiving.center.x +
      warmBias +
      adaptiveOffset *
        (buildSeededNumber(input.seed, "quiet-living-x") > 0.5 ? 1 : -1)
  )
  const y = Math.round(
    quietLiving.center.y +
      quietBias -
      (style.warmCaretaker > 0.72 ? 1 : 0) +
      adaptiveOffset *
        (buildSeededNumber(input.seed, "quiet-living-y") > 0.5 ? 1 : -1)
  )

  return clampPointToMap(
    {
      x: Math.min(
        Math.max(x, Math.min(care.center.x, shelter.center.x)),
        quietLiving.center.x + 3
      ),
      y,
    },
    input.recipe.mapSize
  )
}

function resolveStoragePoint(
  input: PlacementRequest,
  supportPlacements: MapPlacement[],
  pathPlacements: MapPlacement[]
): MapCoordinate {
  const storage = requireArea(input.recipe, "storage_tools")
  const shelter = requireArea(input.recipe, "temporary_shelter")
  const candidates = [
    { x: storage.center.x + 2, y: storage.center.y + 1 },
    { x: storage.center.x + 1, y: storage.center.y + 2 },
    { x: shelter.center.x - 3, y: shelter.center.y + 3 },
    storage.center,
  ].map((point) => clampPointToMap(point, input.recipe.mapSize))

  return (
    candidates.find(
      (point) =>
        supportPlacements.some(
          (placement) => getPlacementDistance(point, placement) <= 3
        ) &&
        pathPlacements.some(
          (placement) => getPlacementDistance(point, placement) <= 3
        )
    ) ?? storage.center
  )
}

function buildCorePathRoute(
  input: PlacementRequest,
  route: PointRoute
): PointRoute {
  if (input.butlerConstructionStyle.structuredBuilder >= 0.55) return route

  const arrival = route[0]
  const care = route[1]
  const adaptiveOffset = getAdaptiveOffset(input.butlerConstructionStyle.adaptivePlanner)
  const waypoint = clampPointToMap(
    {
      x:
        Math.round((arrival.x + care.x) / 2) +
        adaptiveOffset *
          (buildSeededNumber(input.seed, "path-waypoint-x") > 0.5 ? 1 : -1),
      y:
        arrival.y +
        Math.round(
          (care.y - arrival.y) *
            buildSeededNumber(input.seed, "path-waypoint-y")
        ),
    },
    input.recipe.mapSize
  )

  return [arrival, waypoint, ...route.slice(1)]
}

function pushPointTowardBoundary(
  point: MapCoordinate,
  mapSize: HomeMapSize,
  sideSeed: number
): MapCoordinate {
  const side = Math.floor(sideSeed * 4)

  if (side === 0) return clampPointToMap({ ...point, y: 4 }, mapSize)
  if (side === 1) return clampPointToMap({ ...point, y: mapSize.rows - 4 }, mapSize)
  if (side === 2) return clampPointToMap({ ...point, x: 5 }, mapSize)

  return clampPointToMap({ ...point, x: mapSize.columns - 5 }, mapSize)
}

function createSupportEdgePoints(
  supportPlacements: MapPlacement[],
  mapSize: HomeMapSize,
  seed: string,
  salt: string
): MapCoordinate[] {
  const offsets: readonly MapCoordinate[] = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: 1 },
  ]

  return supportPlacements
    .filter((placement, index) => {
      return buildSeededNumber(seed, `${salt}-support-${placement.id}-${index}`) > 0.45
    })
    .flatMap((placement, index) => {
      const offset = pickSeededItem(offsets, seed, `${salt}-offset-${index}`)

      return [
        clampPointToMap(
          {
            x: placement.x + offset.x,
            y: placement.y + offset.y,
          },
          mapSize
        ),
      ]
    })
}

function isNearBlockedPlacement(
  point: MapCoordinate,
  placements: MapPlacement[],
  layers: MapPlacement["layer"][]
): boolean {
  return placements.some((placement) => {
    if (!layers.includes(placement.layer)) return false
    if (!isFunctionalCorePlacement(placement)) return false

    return getPlacementDistance(point, placement) <= 2
  })
}

function getAdaptiveOffset(adaptivePlanner: number): number {
  if (adaptivePlanner >= 0.7) return 0
  if (adaptivePlanner >= 0.45) return 1

  return 2
}

function getAreaBounds(area: InitialHomeAreaRecipe) {
  return {
    x: area.center.x - Math.floor(area.size.width / 2),
    y: area.center.y - Math.floor(area.size.height / 2),
    width: area.size.width,
    height: area.size.height,
  }
}

function createSoftSupportPlacements(
  input: PlacementRequest,
  idPrefix: string,
  startX: number,
  startY: number,
  width: number,
  height: number,
  tags: string[]
): MapPlacement[] {
  const canSoften = width > 4 && height > 2

  return Array.from({ length: width * height }, (_, index) => {
    const x = startX + (index % width)
    const y = startY + Math.floor(index / width)
    const isEdge = x === startX || y === startY || x === startX + width - 1 || y === startY + height - 1
    const shouldSkipEdge =
      canSoften &&
      isEdge &&
      buildSeededNumber(input.seed, `${idPrefix}-soft-edge-${x}-${y}`) <
        INITIAL_HOME_LAYOUT_RULES.support.supportEdgeSoftness

    if (shouldSkipEdge) return null

    return createPlacement({
      id: `support-${idPrefix}-${x}-${y}`,
      assetId: "groundDirtBase01",
      x,
      y,
      layer: "ground",
      label: "泥地承托",
      source: "scene_recipe",
      tags: ["ground_support", ...tags],
    })
  }).filter((placement): placement is MapPlacement => placement !== null)
}

function walkAxisFirst(start: MapCoordinate, end: MapCoordinate): MapCoordinate[] {
  const points: MapCoordinate[] = []
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

function uniquePoints(points: MapCoordinate[]): MapCoordinate[] {
  const seen = new Set<string>()

  return points.filter((point) => {
    const key = `${point.x}:${point.y}`

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getPathAssetId(
  previous: MapCoordinate | undefined,
  current: MapCoordinate,
  next: MapCoordinate | undefined
): WorldMapAssetId {
  if (!previous || !next) return "pathDirtHorizontal01"

  const horizontal = previous.y === current.y && next.y === current.y
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
): InitialHomeAreaRecipe {
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
