/**
 * 当前文件负责：推进一个建设阶段并生成地图变化。
 */

import type {
  HomeZone,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  createAddPlacementDiff,
  createUpdatePlacementDiff,
} from "@/world/map-state/map-diff-engine"

import type {
  ConstructionExecutionInput,
  ConstructionExecutionResult,
  ConstructionPlan,
  ConstructionStageType,
} from "./construction-schema"

export function advanceConstructionPlan(
  input: ConstructionExecutionInput
): ConstructionExecutionResult {
  const targetZone = input.homeMapState.zones.find(
    (zone) => zone.type === input.plan.targetZoneType
  )

  if (!targetZone) {
    return {
      nextPlan: input.plan,
      mapDiffs: [],
      messages: ["未找到宠物休息区，建设计划暂时无法推进。"],
      tags: ["construction_blocked", "missing_target_zone"],
    }
  }

  if (input.plan.currentStage === "completed") {
    return {
      nextPlan: input.plan,
      mapDiffs: [],
      messages: ["宠物休息角建设已经完成。"],
      tags: ["construction_completed", "no_new_diff"],
    }
  }

  const mapDiffs = buildStageDiffs(input, targetZone)
  const nextStage = getNextStage(input.plan.currentStage)
  const nextPlan = updatePlanAfterStage({
    plan: input.plan,
    currentStage: input.plan.currentStage,
    nextStage,
    mapDiffIds: mapDiffs.map((diff) => diff.id),
    now: input.now,
  })

  return {
    nextPlan,
    mapDiffs,
    messages: [getStageMessage(input.plan.currentStage)],
    tags: ["construction_advanced", input.plan.currentStage, nextStage],
  }
}

function buildStageDiffs(
  input: ConstructionExecutionInput,
  targetZone: HomeZone
): MapDiff[] {
  if (input.plan.currentStage === "planned") {
    return buildPreparingGroundDiffs(input, targetZone)
  }

  if (input.plan.currentStage === "preparing_ground") {
    return [
      createAddPlacementDiff({
        id: `diff-add-material-pile-${input.now}`,
        placementId: "material-pile-rest-area",
        placement: createConstructionPlacement({
          id: "material-pile-rest-area",
          assetId: "facilityStorageBoxClosed01",
          x: targetZone.bounds.x + 2,
          y: targetZone.bounds.y + targetZone.bounds.height - 1,
          label: "休息角材料堆",
          tags: ["construction_material", "pet_rest_area"],
        }),
        reason: "管家把整理休息角需要的基础材料放到附近。",
        createdAt: input.now,
        tags: ["construction_diff", "placing_materials"],
      }),
    ]
  }

  if (input.plan.currentStage === "placing_materials") {
    return [
      createAddPlacementDiff({
        id: `diff-add-construction-pet-bed-${input.now}`,
        placementId: "construction-pet-bed-01",
        placement: createConstructionPlacement({
          id: "construction-pet-bed-01",
          assetId: "facilityPetBedNeat01",
          x: targetZone.bounds.x + Math.floor(targetZone.bounds.width / 2),
          y: targetZone.bounds.y + Math.floor(targetZone.bounds.height / 2),
          label: "新整理的宠物床",
          tags: ["construction_result", "pet_bed", "pet_rest_area"],
        }),
        reason: "管家把宠物床放到休息角中心位置。",
        createdAt: input.now,
        tags: ["construction_diff", "building"],
      }),
    ]
  }

  if (input.plan.currentStage === "building") {
    return buildDecoratingDiffs(input, targetZone)
  }

  if (input.plan.currentStage === "decorating") {
    const petBed = input.homeMapState.placements.find(
      (placement) => placement.id === "construction-pet-bed-01"
    )

    if (!petBed) return []

    return [
      createUpdatePlacementDiff({
        id: `diff-complete-construction-pet-bed-${input.now}`,
        placementId: "construction-pet-bed-01",
        patch: {
          label: "已完成的宠物休息角",
          tags: [...new Set([...petBed.tags, "completed_construction"])],
        },
        reason: "管家确认宠物休息角已经完成。",
        createdAt: input.now,
        tags: ["construction_diff", "completed"],
      }),
    ]
  }

  return []
}

function buildPreparingGroundDiffs(
  input: ConstructionExecutionInput,
  targetZone: HomeZone
): MapDiff[] {
  const targetPoints = [
    { x: targetZone.bounds.x + 2, y: targetZone.bounds.y + 2 },
    { x: targetZone.bounds.x + 3, y: targetZone.bounds.y + 2 },
    { x: targetZone.bounds.x + 4, y: targetZone.bounds.y + 2 },
  ]

  const groundDiffs = targetPoints.flatMap((point, index) => {
    const placement = input.homeMapState.placements.find(
      (candidate) => candidate.id === `ground-${point.x}-${point.y}`
    )

    if (!placement) return []

    return [
      createUpdatePlacementDiff({
        id: `diff-prepare-ground-${index + 1}-${input.now}`,
        placementId: placement.id,
        patch: {
          label: "已整理的休息角地面",
          tags: [
            ...new Set([
              ...placement.tags,
              "construction_prepared_ground",
              "pet_rest_area",
            ]),
          ],
        },
        reason: "管家先整理宠物休息区附近的地面。",
        createdAt: input.now,
        tags: ["construction_diff", "preparing_ground"],
      }),
    ]
  })

  return [
    ...groundDiffs,
    createAddPlacementDiff({
      id: `diff-add-prepared-ground-marker-${input.now}`,
      placementId: "construction-prepared-ground-marker-01",
      placement: createConstructionPlacement({
        id: "construction-prepared-ground-marker-01",
        assetId: "surfaceStoneSmall01",
        x: targetZone.bounds.x + 2,
        y: targetZone.bounds.y + 1,
        label: "休息角整理标记",
        tags: ["construction_marker", "prepared_ground", "pet_rest_area"],
      }),
      reason: "管家在宠物休息角放下整理标记，让地面整理变得可见。",
      createdAt: input.now,
      tags: ["construction_diff", "preparing_ground", "visible_change"],
    }),
  ]
}

function buildDecoratingDiffs(
  input: ConstructionExecutionInput,
  targetZone: HomeZone
): MapDiff[] {
  const decorations = [
    {
      id: "construction-rest-grass-tuft-01",
      assetId: "surfaceGrassTuft01" as const,
      x: targetZone.bounds.x + 1,
      y: targetZone.bounds.y + 1,
      label: "休息角小草丛",
    },
    {
      id: "construction-rest-flower-01",
      assetId: "surfaceFlowerPatch01" as const,
      x: targetZone.bounds.x + targetZone.bounds.width - 2,
      y: targetZone.bounds.y + 1,
      label: "休息角小花",
    },
    {
      id: "construction-rest-stone-01",
      assetId: "surfaceStoneSmall01" as const,
      x: targetZone.bounds.x + targetZone.bounds.width - 1,
      y: targetZone.bounds.y + targetZone.bounds.height - 1,
      label: "休息角小石头",
    },
  ]

  return decorations.map((decoration, index) =>
    createAddPlacementDiff({
      id: `diff-add-rest-decoration-${index + 1}-${input.now}`,
      placementId: decoration.id,
      placement: createConstructionPlacement({
        ...decoration,
        tags: ["construction_decoration", "pet_rest_area"],
      }),
      reason: "管家为宠物休息角增加自然点缀。",
      createdAt: input.now,
      tags: ["construction_diff", "decorating"],
    })
  )
}

function createConstructionPlacement(input: {
  id: string
  assetId: MapPlacement["assetId"]
  x: number
  y: number
  label: string
  tags: string[]
}): MapPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    x: input.x,
    y: input.y,
    layer:
      input.assetId === "surfaceGrassTuft01" ||
      input.assetId === "surfaceFlowerPatch01" ||
      input.assetId === "surfaceStoneSmall01"
        ? "surface-decoration"
        : "facility",
    scale: 0.9,
    alpha: 1,
    label: input.label,
    source: "construction_plan",
    tags: input.tags,
  }
}

function updatePlanAfterStage(input: {
  plan: ConstructionPlan
  currentStage: ConstructionStageType
  nextStage: ConstructionStageType
  mapDiffIds: string[]
  now: number
}): ConstructionPlan {
  return {
    ...input.plan,
    status: input.nextStage === "completed" ? "completed" : "active",
    currentStage: input.nextStage,
    updatedAt: input.now,
    stages: input.plan.stages.map((stage) => {
      if (stage.type === input.currentStage) {
        return {
          ...stage,
          progress: 100,
          mapDiffIds: [...stage.mapDiffIds, ...input.mapDiffIds],
          completed: true,
        }
      }

      if (stage.type === input.nextStage && input.nextStage !== "completed") {
        return {
          ...stage,
          progress: Math.max(stage.progress, 10),
        }
      }

      return stage
    }),
  }
}

function getNextStage(stage: ConstructionStageType): ConstructionStageType {
  if (stage === "planned") return "preparing_ground"
  if (stage === "preparing_ground") return "placing_materials"
  if (stage === "placing_materials") return "building"
  if (stage === "building") return "decorating"
  if (stage === "decorating") return "completed"

  return "completed"
}

function getStageMessage(stage: ConstructionStageType): string {
  if (stage === "planned") return "管家开始整理宠物休息角地面。"
  if (stage === "preparing_ground") return "管家把材料放到休息角附近。"
  if (stage === "placing_materials") return "管家放置了新的宠物床。"
  if (stage === "building") return "管家给休息角增加了自然点缀。"
  if (stage === "decorating") return "宠物休息角已经完成。"

  return "宠物休息角建设已完成。"
}
