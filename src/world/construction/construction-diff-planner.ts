/**
 * 当前文件职责：把建设意图转换为地图变化。
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
  improve_quiet_living: [
    {
      assetId: "surfaceGrassTuft01",
      layer: "surface-decoration",
      tags: ["rest", "soft", "natural_detail"],
      label: "生活区小草丛",
      scale: 0.82,
    },
    {
      assetId: "surfaceFlowerPatch01",
      layer: "surface-decoration",
      tags: ["rest", "flower", "natural_detail"],
      label: "生活区小花",
      scale: 0.82,
    },
    {
      assetId: "facilityLampOn01",
      layer: "facility",
      tags: ["rest", "warm", "lamp"],
      label: "生活区临时小灯",
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
  ],
  organize_storage: [
    {
      assetId: "facilityStorageBoxClosed01",
      layer: "facility",
      tags: ["storage", "order"],
      label: "整理后的储物箱",
      scale: 0.9,
    },
  ],
  soften_entry_area: [
    {
      assetId: "surfaceGrassTuftLow01",
      layer: "surface-decoration",
      tags: ["entry", "soft", "natural_detail"],
      label: "入口小草丛",
      scale: 0.76,
    },
  ],
  decorate_home: [
    {
      assetId: "surfaceFlowerPatch01",
      layer: "surface-decoration",
      tags: ["flower", "natural_detail"],
      label: "家园小花",
      scale: 0.82,
    },
    {
      assetId: "surfaceStoneSmall01",
      layer: "surface-decoration",
      tags: ["stone", "natural_detail"],
      label: "家园小石头",
      scale: 0.82,
    },
  ],
}

function findZone(
  homeMapState: HomeMapState,
  intent: ConstructionIntent
): HomeZone | null {
  return homeMapState.zones.find(
    (zone) => zone.type === intent.targetZoneType
  ) ?? null
}

function getZoneCenter(zone: HomeZone): MapCoordinate {
  return {
    x: zone.bounds.x + zone.bounds.width / 2,
    y: zone.bounds.y + zone.bounds.height / 2,
  }
}

function buildPlacement(input: {
  intent: ConstructionIntent
  candidate: AssetCandidate
  point: MapCoordinate
  now: number
  index: number
}): MapPlacement {
  return {
    id: `construction-${input.intent.type}-${input.now}-${input.index}`,
    assetId: input.candidate.assetId,
    x: input.point.x,
    y: input.point.y,
    layer: input.candidate.layer,
    scale: input.candidate.scale,
    alpha: 1,
    label: input.candidate.label,
    source: "construction_plan",
    tags: [
      "construction_intent_object",
      input.intent.type,
      input.intent.targetZoneType,
      ...input.candidate.tags,
    ],
  }
}

function buildPoint(zone: HomeZone, index: number): MapCoordinate {
  const center = getZoneCenter(zone)
  const offsets: MapCoordinate[] = [
    { x: -0.6, y: -0.4 },
    { x: 0.55, y: 0.25 },
    { x: 0.1, y: 0.65 },
  ]
  const offset = offsets[index % offsets.length]

  return {
    x: center.x + offset.x,
    y: center.y + offset.y,
  }
}

function buildDiffForIntent(input: {
  homeMapState: HomeMapState
  intent: ConstructionIntent
  now: number
  index: number
}): MapDiff | null {
  const zone = findZone(input.homeMapState, input.intent)
  if (!zone) return null

  const candidates = INTENT_ASSET_CANDIDATES[input.intent.type]
  const candidate = candidates[input.index % candidates.length]
  const placement = buildPlacement({
    intent: input.intent,
    candidate,
    point: buildPoint(zone, input.index),
    now: input.now,
    index: input.index,
  })

  return createAddPlacementDiff({
    id: `diff-${placement.id}`,
    placementId: placement.id,
    placement,
    reason: input.intent.reason,
    createdAt: input.now,
    tags: [
      "map_diff",
      "construction_intent_diff",
      input.intent.type,
      input.intent.targetZoneType,
    ],
  })
}

export function buildMapDiffsFromConstructionIntents(
  input: BuildMapDiffsFromConstructionIntentsInput
): BuildMapDiffsFromConstructionIntentsResult {
  const mapDiffs = input.intents
    .map((intent, index) =>
      buildDiffForIntent({
        homeMapState: input.homeMapState,
        intent,
        now: input.now,
        index,
      })
    )
    .filter((diff): diff is MapDiff => Boolean(diff))

  return {
    mapDiffs,
    messages:
      mapDiffs.length > 0
        ? mapDiffs.map((diff) => diff.reason)
        : ["当前建设意图没有生成可应用的地图变化。"],
    tags: ["construction_diff_planner_result"],
  }
}
