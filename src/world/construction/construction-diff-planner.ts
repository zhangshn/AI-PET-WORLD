/**
 * 当前文件负责：把建设意图转换为地图变化。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  HomeMapState,
  HomeZone,
  MapCoordinate,
  MapDiff,
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"
import {
  createAddPlacementDiff,
  createUpdatePlacementDiff,
} from "@/world/map-state/map-diff-engine"

import type { ConstructionIntent } from "./construction-intent-schema"

export type BuildMapDiffsFromConstructionIntentsInput = {
  homeMapState: HomeMapState
  intents: ConstructionIntent[]
  now: number
}

export type BuildMapDiffsFromConstructionIntentsResult = {
  mapDiffs: MapDiff[]
  messages: string[]
  tags: string[]
}

type AssetCandidate = {
  assetId: WorldMapAssetId
  layer: MapPlacementLayer
  tags: string[]
  label: string
  scale: number
}

const INTENT_ASSET_CANDIDATES: Record<
  ConstructionIntent["type"],
  AssetCandidate[]
> = {
  improve_pet_rest: [
    {
      assetId: "surfaceGrassTuft01",
      layer: "surface-decoration",
      tags: ["rest", "soft", "natural_detail"],
      label: "休息角小草丛",
      scale: 0.82,
    },
    {
      assetId: "surfaceFlowerPatch01",
      layer: "surface-decoration",
      tags: ["rest", "flower", "natural_detail"],
      label: "休息角小花",
      scale: 0.82,
    },
    {
      assetId: "facilityLampOn01",
      layer: "facility",
      tags: ["rest", "warm", "lamp"],
      label: "休息角临时小灯",
      scale: 0.82,
    },
  ],
  improve_care_area: [
    {
      assetId: "surfaceGrassTuft01",
      layer: "surface-decoration",
      tags: ["care", "soft", "natural_detail"],
      label: "照护点小草丛",
      scale: 0.82,
    },
    {
      assetId: "surfaceStoneSmall01",
      layer: "surface-decoration",
      tags: ["care", "marker", "natural_detail"],
      label: "照护点小石头",
      scale: 0.82,
    },
  ],
  add_natural_boundary: [
    {
      assetId: "natureBushSmall01",
      layer: "nature",
      tags: ["nature", "boundary", "bush"],
      label: "边界小灌木",
      scale: 0.9,
    },
    {
      assetId: "natureTreeSmall01",
      layer: "nature",
      tags: ["nature", "boundary", "tree"],
      label: "边界小树",
      scale: 0.92,
    },
  ],
  organize_storage: [
    {
      assetId: "facilityStorageBoxClosed01",
      layer: "facility",
      tags: ["storage", "tools", "order"],
      label: "整理后的储物箱",
      scale: 0.82,
    },
  ],
  soften_arrival_area: [
    {
      assetId: "surfaceFlowerPatch01",
      layer: "surface-decoration",
      tags: ["arrival", "flower", "natural_detail"],
      label: "抵达区小花",
      scale: 0.82,
    },
    {
      assetId: "surfaceGrassTuft01",
      layer: "surface-decoration",
      tags: ["arrival", "soft", "natural_detail"],
      label: "抵达区小草丛",
      scale: 0.82,
    },
  ],
  decorate_home: [
    {
      assetId: "surfaceFlowerPatch01",
      layer: "surface-decoration",
      tags: ["flower", "natural_detail", "home_decoration"],
      label: "家园小花",
      scale: 0.82,
    },
    {
      assetId: "surfaceFallenLeaf01",
      layer: "surface-decoration",
      tags: ["leaf", "natural_detail", "home_decoration"],
      label: "家园落叶",
      scale: 0.78,
    },
    {
      assetId: "surfaceGrassTuft01",
      layer: "surface-decoration",
      tags: ["grass", "natural_detail", "home_decoration"],
      label: "家园小草丛",
      scale: 0.82,
    },
  ],
}

export function buildMapDiffsFromConstructionIntents(
  input: BuildMapDiffsFromConstructionIntentsInput
): BuildMapDiffsFromConstructionIntentsResult {
  const mapDiffs = input.intents.flatMap((intent) =>
    buildMapDiffsFromConstructionIntent({
      homeMapState: input.homeMapState,
      intent,
      now: input.now,
    })
  )

  return {
    mapDiffs,
    messages:
      mapDiffs.length > 0
        ? [`生成 ${mapDiffs.length} 条地图变化候选。`]
        : ["没有生成地图变化候选。"],
    tags: ["construction_diff_planner_result"],
  }
}

function buildMapDiffsFromConstructionIntent(input: {
  homeMapState: HomeMapState
  intent: ConstructionIntent
  now: number
}): MapDiff[] {
  const targetZone = findTargetZone(
    input.homeMapState,
    input.intent.targetZoneType
  )

  if (!targetZone) return []

  if (input.intent.type === "organize_storage") {
    const existingStorage = input.homeMapState.placements.find((placement) =>
      placement.tags.includes("storage")
    )

    if (existingStorage) {
      return [
        createUpdatePlacementDiff({
          id: buildDiffId(input.intent, "update-storage", input.now),
          placementId: existingStorage.id,
          patch: {
            label: "整理后的储物箱",
            tags: mergeTags(existingStorage.tags, [
              "organized_storage",
              "construction_result",
            ]),
          },
          reason: input.intent.reason,
          createdAt: input.now,
          tags: ["construction_diff", "organize_storage"],
        }),
      ]
    }
  }

  const candidate = pickAssetCandidate(input.intent)
  const point = findSafePointNearZone({
    homeMapState: input.homeMapState,
    targetZone,
    layer: candidate.layer,
  })

  if (!point) return []

  const placement = createConstructionPlacement({
    intent: input.intent,
    candidate,
    point,
  })

  const diffs: MapDiff[] = [
    createAddPlacementDiff({
      id: buildDiffId(input.intent, "add-placement", input.now),
      placementId: placement.id,
      placement,
      reason: input.intent.reason,
      createdAt: input.now,
      tags: ["construction_diff", input.intent.type, input.intent.targetZoneType],
    }),
  ]

  const petBed = input.homeMapState.placements.find(
    (placement) => placement.id === "pet-bed"
  )

  if (input.intent.type === "improve_pet_rest" && petBed) {
    diffs.push(
      createUpdatePlacementDiff({
        id: buildDiffId(input.intent, "update-pet-bed", input.now),
        placementId: petBed.id,
        patch: {
          label: "更安静的宠物休息角",
          tags: mergeTags(petBed.tags, [
            "rest_comfort_up",
            "construction_result",
          ]),
        },
        reason: input.intent.reason,
        createdAt: input.now,
        tags: ["construction_diff", "improve_pet_rest", "update_existing"],
      })
    )
  }

  return diffs
}

function createConstructionPlacement(input: {
  intent: ConstructionIntent
  candidate: AssetCandidate
  point: MapCoordinate
}): MapPlacement {
  return {
    id: [
      "construction",
      input.intent.type,
      input.candidate.assetId,
      input.point.x,
      input.point.y,
      input.intent.createdAt,
    ].join("-"),
    assetId: input.candidate.assetId,
    x: input.point.x,
    y: input.point.y,
    layer: input.candidate.layer,
    scale: input.candidate.scale,
    alpha: 1,
    label: input.candidate.label,
    source: "construction_plan",
    tags: mergeTags(input.candidate.tags, [
      "construction_result",
      input.intent.type,
      input.intent.targetZoneType,
    ]),
  }
}

function findTargetZone(
  homeMapState: HomeMapState,
  targetZoneType: ConstructionIntent["targetZoneType"]
): HomeZone | undefined {
  return homeMapState.zones.find((zone) => zone.type === targetZoneType)
}

function pickAssetCandidate(intent: ConstructionIntent): AssetCandidate {
  const candidates = INTENT_ASSET_CANDIDATES[intent.type]
  const preferredCandidate = candidates.find((candidate) =>
    candidate.tags.some((tag) => intent.preferredAssetTags.includes(tag))
  )

  return preferredCandidate ?? candidates[0]
}

function findSafePointNearZone(input: {
  homeMapState: HomeMapState
  targetZone: HomeZone
  layer: MapPlacementLayer
}): MapCoordinate | null {
  const candidates = buildZoneCandidatePoints(input.targetZone)

  return (
    candidates.find((point) =>
      isSafePoint({
        homeMapState: input.homeMapState,
        point,
        layer: input.layer,
      })
    ) ?? null
  )
}

function buildZoneCandidatePoints(zone: HomeZone): MapCoordinate[] {
  const centerX = zone.bounds.x + Math.floor(zone.bounds.width / 2)
  const centerY = zone.bounds.y + Math.floor(zone.bounds.height / 2)
  const points: MapCoordinate[] = []

  for (let radius = 0; radius <= 4; radius += 1) {
    points.push(
      { x: centerX + radius, y: centerY },
      { x: centerX - radius, y: centerY },
      { x: centerX, y: centerY + radius },
      { x: centerX, y: centerY - radius },
      { x: centerX + radius, y: centerY + radius },
      { x: centerX - radius, y: centerY + radius },
      { x: centerX + radius, y: centerY - radius },
      { x: centerX - radius, y: centerY - radius }
    )
  }

  return dedupePoints(points)
}

function isSafePoint(input: {
  homeMapState: HomeMapState
  point: MapCoordinate
  layer: MapPlacementLayer
}): boolean {
  if (!isInsideMap(input.homeMapState, input.point)) return false

  const placementsAtPoint = input.homeMapState.placements.filter(
    (placement) => placement.x === input.point.x && placement.y === input.point.y
  )

  if (placementsAtPoint.some(isProtectedPlacement)) return false
  if (placementsAtPoint.some((placement) => placement.layer === "path")) {
    return false
  }

  if (input.layer === "facility" || input.layer === "nature") {
    return !placementsAtPoint.some(
      (placement) =>
        placement.layer !== "ground" &&
        placement.layer !== "edge" &&
        placement.layer !== "zone"
    )
  }

  return !placementsAtPoint.some(
    (placement) =>
      placement.layer === "structure" ||
      placement.layer === "facility" ||
      placement.layer === "nature" ||
      placement.layer === "actor"
  )
}

function isInsideMap(
  homeMapState: HomeMapState,
  point: MapCoordinate
): boolean {
  return (
    point.x >= 1 &&
    point.y >= 1 &&
    point.x <= homeMapState.mapSize.columns &&
    point.y <= homeMapState.mapSize.rows
  )
}

function isProtectedPlacement(placement: MapPlacement): boolean {
  const protectedTags = [
    "core_living",
    "arrival_focus",
    "temporary_shelter",
    "pet_bed",
    "butler",
    "pet",
    "actor",
  ]

  return protectedTags.some((tag) => placement.tags.includes(tag))
}

function buildDiffId(
  intent: ConstructionIntent,
  action: string,
  now: number
): string {
  return ["diff", intent.type, action, intent.targetZoneType, now].join("-")
}

function mergeTags(currentTags: string[], nextTags: string[]): string[] {
  return Array.from(new Set([...currentTags, ...nextTags]))
}

function dedupePoints(points: MapCoordinate[]): MapCoordinate[] {
  const pointMap = new Map<string, MapCoordinate>()

  points.forEach((point) => {
    pointMap.set(`${point.x}:${point.y}`, point)
  })

  return Array.from(pointMap.values())
}