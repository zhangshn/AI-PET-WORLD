/**
 * 当前文件职责：执行管家建设计划，生成只读 MapDiff。
 */

import type {
  HomeZone,
  MapCoordinate,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionExecutionInput,
  ConstructionExecutionResult,
  ConstructionPlan,
  ConstructionStage,
  ConstructionStageType,
} from "./construction-schema"

const STAGE_ORDER: ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

function findTargetZone(input: ConstructionExecutionInput): HomeZone | null {
  return input.homeMapState.zones.find(
    (zone) => zone.type === input.plan.targetZoneType
  ) ?? null
}

function getZoneCenter(zone: HomeZone): MapCoordinate {
  return {
    x: zone.bounds.x + zone.bounds.width / 2,
    y: zone.bounds.y + zone.bounds.height / 2,
  }
}

function offsetPoint(point: MapCoordinate, dx: number, dy: number): MapCoordinate {
  return {
    x: point.x + dx,
    y: point.y + dy,
  }
}

function buildPlacement(input: {
  id: string
  assetId: MapPlacement["assetId"]
  point: MapCoordinate
  layer: MapPlacement["layer"]
  label: string
  tags: string[]
}): MapPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    x: input.point.x,
    y: input.point.y,
    layer: input.layer,
    scale: 1,
    alpha: 1,
    label: input.label,
    source: "construction_plan",
    tags: input.tags,
  }
}

function buildAddDiff(input: {
  now: number
  stage: ConstructionStageType
  placement: MapPlacement
  reason: string
  tags: string[]
}): MapDiff {
  return {
    id: `diff-${input.stage}-${input.placement.id}-${input.now}`,
    operation: "add",
    placementId: input.placement.id,
    placement: input.placement,
    reason: input.reason,
    createdAt: input.now,
    tags: ["construction_diff", input.stage, ...input.tags],
  }
}

function buildStageDiffs(input: {
  now: number
  stage: ConstructionStageType
  targetZone: HomeZone
}): MapDiff[] {
  const center = getZoneCenter(input.targetZone)

  if (input.stage === "preparing_ground") {
    const placement = buildPlacement({
      id: `quiet-living-ground-marker-${input.now}`,
      assetId: "surfaceGrassTuftLow01",
      point: offsetPoint(center, -0.8, 0.4),
      layer: "surface-decoration",
      label: "已整理的生活区地面",
      tags: ["construction_marker", "prepared_ground", "quiet_living_area"],
    })

    return [
      buildAddDiff({
        now: input.now,
        stage: input.stage,
        placement,
        reason: "管家先整理安静生活区附近的地面。",
        tags: ["quiet_living_area"],
      }),
    ]
  }

  if (input.stage === "placing_materials") {
    const placement = buildPlacement({
      id: `quiet-living-materials-${input.now}`,
      assetId: "facilityStorageBoxClosed01",
      point: offsetPoint(center, 0.9, 0.2),
      layer: "facility",
      label: "生活区整理材料",
      tags: ["construction_material", "quiet_living_area", "storage"],
    })

    return [
      buildAddDiff({
        now: input.now,
        stage: input.stage,
        placement,
        reason: "管家把基础材料放到安静生活区附近。",
        tags: ["quiet_living_area"],
      }),
    ]
  }

  if (input.stage === "building") {
    const placement = buildPlacement({
      id: `quiet-living-support-${input.now}`,
      assetId: "facilityLampOn01",
      point: center,
      layer: "facility",
      label: "安静生活支撑点",
      tags: ["living_support", "quiet_living_area", "home_order"],
    })

    return [
      buildAddDiff({
        now: input.now,
        stage: input.stage,
        placement,
        reason: "管家整理基础生活支撑点，形成可见的生活秩序。",
        tags: ["quiet_living_area"],
      }),
    ]
  }

  if (input.stage === "decorating") {
    const placement = buildPlacement({
      id: `quiet-living-decoration-${input.now}`,
      assetId: "surfaceFlowerPatch01",
      point: offsetPoint(center, 0.4, -0.7),
      layer: "surface-decoration",
      label: "生活区自然点缀",
      tags: ["construction_decoration", "quiet_living_area", "natural_detail"],
    })

    return [
      buildAddDiff({
        now: input.now,
        stage: input.stage,
        placement,
        reason: "管家为安静生活区增加自然点缀。",
        tags: ["quiet_living_area"],
      }),
    ]
  }

  return []
}

function getNextStage(current: ConstructionStageType): ConstructionStageType {
  const index = STAGE_ORDER.indexOf(current)
  if (index < 0) return "planned"
  return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)]
}

function updateStages(input: {
  stages: ConstructionStage[]
  completedStage: ConstructionStageType
  mapDiffIds: string[]
}): ConstructionStage[] {
  return input.stages.map((stage) => {
    if (stage.type !== input.completedStage) return stage

    return {
      ...stage,
      progress: 100,
      mapDiffIds: [...stage.mapDiffIds, ...input.mapDiffIds],
      completed: true,
    }
  })
}

function buildNextPlan(input: {
  plan: ConstructionPlan
  now: number
  completedStage: ConstructionStageType
  nextStage: ConstructionStageType
  mapDiffIds: string[]
}): ConstructionPlan {
  return {
    ...input.plan,
    status: input.nextStage === "completed" ? "completed" : "active",
    currentStage: input.nextStage,
    stages: updateStages({
      stages: input.plan.stages,
      completedStage: input.completedStage,
      mapDiffIds: input.mapDiffIds,
    }),
    updatedAt: input.now,
  }
}

function buildStageMessage(stage: ConstructionStageType): string {
  if (stage === "preparing_ground") return "管家开始整理安静生活区地面。"
  if (stage === "placing_materials") return "管家放置了基础整理材料。"
  if (stage === "building") return "管家整理了安静生活支撑点。"
  if (stage === "decorating") return "安静生活区已经增加自然点缀。"
  if (stage === "completed") return "安静生活区建设已经完成。"

  return "管家确认安静生活区建设计划。"
}

export function advanceConstructionPlan(
  input: ConstructionExecutionInput
): ConstructionExecutionResult {
  const targetZone = findTargetZone(input)

  if (!targetZone) {
    return {
      nextPlan: input.plan,
      mapDiffs: [],
      messages: ["未找到安静生活区，建设计划暂时无法推进。"],
      tags: ["construction_execution_blocked", "missing_quiet_living_zone"],
    }
  }

  if (input.plan.currentStage === "completed") {
    return {
      nextPlan: input.plan,
      mapDiffs: [],
      messages: ["安静生活区建设已经完成。"],
      tags: ["construction_execution_noop", "already_completed"],
    }
  }

  const nextStage = getNextStage(input.plan.currentStage)
  const mapDiffs = buildStageDiffs({
    now: input.now,
    stage: nextStage,
    targetZone,
  })
  const nextPlan = buildNextPlan({
    plan: input.plan,
    now: input.now,
    completedStage: nextStage,
    nextStage,
    mapDiffIds: mapDiffs.map((diff) => diff.id),
  })

  return {
    nextPlan,
    mapDiffs,
    messages: [buildStageMessage(nextStage)],
    tags: ["construction_execution_result", `stage:${nextStage}`],
  }
}
