/**
 * 当前文件职责：为管家延迟建设目标生成新增 placement 候选。
 */

import { buildSeededNumber } from "@/world/generation/world-seed"
import type {
  HomeMapState,
  HomeZone,
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionPlan,
  ConstructionProjectType,
  ConstructionStageType,
} from "./construction-schema"

const DEFERRED_ADD_PROJECT_TYPES = [
  "stabilize_temporary_shelter",
  "improve_initial_care",
  "organize_storage_area",
  "preserve_quiet_living",
] as const satisfies readonly ConstructionProjectType[]

type DeferredAddProjectType = (typeof DEFERRED_ADD_PROJECT_TYPES)[number]

type DeferredConstructionVisualSpec = {
  assetId: MapPlacement["assetId"]
  layer: MapPlacement["layer"]
  label: string
  scale: number
  alpha: number
  tags: string[]
}

export function shouldCreateDeferredConstructionPlacement(
  projectType: ConstructionProjectType
): projectType is DeferredAddProjectType {
  return (DEFERRED_ADD_PROJECT_TYPES as readonly ConstructionProjectType[]).includes(
    projectType
  )
}

export function buildDeferredConstructionPlacement(input: {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  executableStage: ConstructionStageType
}): MapPlacement | null {
  if (input.executableStage === "completed") return null
  if (!shouldCreateDeferredConstructionPlacement(input.plan.projectType)) return null

  const projectType = input.plan.projectType
  const spec = getDeferredConstructionVisualSpec(projectType)
  const point = resolveDeferredConstructionPoint({
    homeMapState: input.homeMapState,
    plan: input.plan,
    projectType,
  })

  return {
    id: buildDeferredPlacementId(input.plan),
    assetId: spec.assetId,
    x: point.x,
    y: point.y,
    layer: spec.layer,
    scale: spec.scale,
    alpha: spec.alpha,
    label: spec.label,
    source: "construction_plan",
    tags: uniqueTags([
      "butler_construction_result",
      "construction_plan_add_diff",
      "not_initial_world_fact",
      `construction_plan:${input.plan.id}`,
      `construction_project:${input.plan.projectType}`,
      `construction_stage:${input.executableStage}`,
      `target:${input.plan.targetZoneType}`,
      ...spec.tags,
    ]),
  }
}

function getDeferredConstructionVisualSpec(
  projectType: DeferredAddProjectType
): DeferredConstructionVisualSpec {
  const specs = {
    stabilize_temporary_shelter: {
      assetId: "buildingTempShelterTent01",
      layer: "structure",
      label: "临时住所建设中",
      scale: 0.72,
      alpha: 0.46,
      tags: ["temporary_shelter", "shelter_under_construction"],
    },
    improve_initial_care: {
      assetId: "buildingInitialCareStation01",
      layer: "facility",
      label: "基础照护点建设中",
      scale: 0.66,
      alpha: 0.46,
      tags: ["initial_care", "care_station_under_construction"],
    },
    organize_storage_area: {
      assetId: "facilityStorageBoxClosed01",
      layer: "facility",
      label: "工具储备区整理中",
      scale: 0.72,
      alpha: 0.48,
      tags: ["storage_tools", "storage_under_construction"],
    },
    preserve_quiet_living: {
      assetId: "zoneInitialEmptyLandTrace01",
      layer: "zone",
      label: "安静生活区规划中",
      scale: 0.66,
      alpha: 0.4,
      tags: ["quiet_living", "quiet_living_planning"],
    },
  } satisfies Record<DeferredAddProjectType, DeferredConstructionVisualSpec>

  return specs[projectType]
}

function resolveDeferredConstructionPoint(input: {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  projectType: DeferredAddProjectType
}): MapCoordinate {
  const anchor = resolveConstructionAnchor(input.homeMapState)
  const offset = resolveProjectOffset({
    homeMapState: input.homeMapState,
    plan: input.plan,
    projectType: input.projectType,
  })
  const candidate = clampPoint(
    {
      x: anchor.x + offset.x,
      y: anchor.y + offset.y,
    },
    input.homeMapState
  )

  if (!isOccupied(candidate, input.homeMapState.placements)) {
    return candidate
  }

  const saltBase = `${input.plan.id}:${input.plan.projectType}:collision`

  for (let index = 0; index < 12; index += 1) {
    const angleSeed = buildSeededNumber(input.homeMapState.seed, `${saltBase}:${index}`)
    const radiusSeed = buildSeededNumber(input.homeMapState.seed, `${saltBase}:r:${index}`)
    const angle = angleSeed * Math.PI * 2
    const radius = 1 + Math.round(radiusSeed * 5)
    const nextPoint = clampPoint(
      {
        x: candidate.x + Math.round(Math.cos(angle) * radius),
        y: candidate.y + Math.round(Math.sin(angle) * radius),
      },
      input.homeMapState
    )

    if (!isOccupied(nextPoint, input.homeMapState.placements)) {
      return nextPoint
    }
  }

  return candidate
}

function resolveConstructionAnchor(homeMapState: HomeMapState): MapCoordinate {
  const actor = homeMapState.placements.find(
    (placement) => placement.layer === "actor" && placement.tags.includes("butler")
  )

  if (actor) return { x: actor.x, y: actor.y }

  const entry = homeMapState.zones.find((zone) => zone.type === "entry_area")
  if (entry) return getZoneCenter(entry)

  const center = homeMapState.zones.find((zone) => zone.type === "visual_center")
  if (center) return getZoneCenter(center)

  return {
    x: Math.round(homeMapState.mapSize.columns / 2),
    y: Math.round(homeMapState.mapSize.rows / 2),
  }
}

function resolveProjectOffset(input: {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  projectType: DeferredAddProjectType
}): MapCoordinate {
  const direction = buildSeededNumber(
    input.homeMapState.seed,
    `${input.plan.id}:direction`
  ) >= 0.5
    ? 1
    : -1
  const shift = Math.round(
    buildSeededNumber(input.homeMapState.seed, `${input.plan.id}:shift`) * 3
  )

  const offsets = {
    stabilize_temporary_shelter: { x: direction * (7 + shift), y: -3 },
    improve_initial_care: { x: direction * (4 + shift), y: 4 },
    organize_storage_area: { x: direction * -(5 + shift), y: 3 },
    preserve_quiet_living: { x: direction * (8 + shift), y: 7 },
  } satisfies Record<DeferredAddProjectType, MapCoordinate>

  return offsets[input.projectType]
}

function clampPoint(point: MapCoordinate, homeMapState: HomeMapState): MapCoordinate {
  return {
    x: Math.min(Math.max(1, point.x), homeMapState.mapSize.columns),
    y: Math.min(Math.max(1, point.y), homeMapState.mapSize.rows),
  }
}

function isOccupied(point: MapCoordinate, placements: MapPlacement[]): boolean {
  return placements.some(
    (placement) => placement.x === point.x && placement.y === point.y
  )
}

function getZoneCenter(zone: HomeZone): MapCoordinate {
  return {
    x: zone.bounds.x + Math.floor(zone.bounds.width / 2),
    y: zone.bounds.y + Math.floor(zone.bounds.height / 2),
  }
}

function buildDeferredPlacementId(plan: ConstructionPlan): string {
  return [
    "butler-build",
    normalizeIdToken(plan.projectType),
    normalizeIdToken(plan.targetZoneType),
    normalizeIdToken(plan.id),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
