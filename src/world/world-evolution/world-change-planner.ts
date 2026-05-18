/**
 * 当前文件职责：将行为意图决策转换为世界变化计划。
 */

import type { ButlerIntentType } from "@/world/intent-system/intent-gateway"

import type {
  BuildWorldChangePlanInput,
  WorldChangePlan,
  WorldChangePlanStatus,
  WorldChangePlanType,
  WorldChangeTarget,
} from "./world-evolution-schema"

const DIFF_GENERATING_PLAN_TYPES: WorldChangePlanType[] = [
  "build_structure",
  "plant_nature",
  "expand_area",
  "reorganize_area",
]

export function buildWorldChangePlan(
  input: BuildWorldChangePlanInput
): WorldChangePlan {
  const selectedIntent = input.decision.selectedIntent

  if (!input.decision.shouldAct || selectedIntent.type === "do_nothing") {
    return buildPlan({
      input,
      type: "no_change",
      status: "skipped",
      shouldGenerateDiff: false,
      target: { tags: ["no_target"] },
      blockers: selectedIntent.blockers,
      reason: "当前意图决策倾向等待，本轮不生成世界变化计划。",
    })
  }

  const planType = mapIntentTypeToPlanType(selectedIntent.type)
  const blockers = buildPlanBlockers(input, planType)
  const status: WorldChangePlanStatus =
    blockers.length > 0 && selectedIntent.score < 70 ? "blocked" : "proposed"
  const shouldGenerateDiff =
    status === "proposed" && DIFF_GENERATING_PLAN_TYPES.includes(planType)

  return buildPlan({
    input,
    type: planType,
    status,
    shouldGenerateDiff,
    target: buildTargetForPlanType(planType),
    blockers,
    reason: buildPlanReason(planType, status),
  })
}

function buildPlan(input: {
  input: BuildWorldChangePlanInput
  type: WorldChangePlanType
  status: WorldChangePlanStatus
  shouldGenerateDiff: boolean
  target: WorldChangeTarget
  reason: string
  blockers: string[]
}): WorldChangePlan {
  const selectedIntent = input.input.decision.selectedIntent

  return {
    id: `world-change-plan-${input.input.now}-${selectedIntent.type}`,
    type: input.type,
    status: input.status,
    sourceIntentType: selectedIntent.type,
    sourceIntentScore: selectedIntent.score,
    shouldGenerateDiff: input.shouldGenerateDiff,
    target: input.target,
    reason: input.reason,
    blockers: input.blockers,
    tags: [
      "world_change_plan_v0",
      `source_intent:${selectedIntent.type}`,
      `plan_type:${input.type}`,
      `status:${input.status}`,
    ],
  }
}

function mapIntentTypeToPlanType(
  intentType: ButlerIntentType
): WorldChangePlanType {
  if (intentType === "build") return "build_structure"
  if (intentType === "maintain") return "maintain_area"
  if (intentType === "plant") return "plant_nature"
  if (intentType === "expand") return "expand_area"
  if (intentType === "observe") return "observe_area"
  if (intentType === "rest") return "rest_area"
  if (intentType === "reorganize") return "reorganize_area"

  return "no_change"
}

function buildTargetForPlanType(
  planType: WorldChangePlanType
): WorldChangeTarget {
  if (planType === "build_structure") {
    return {
      zoneType: "temporary_shelter",
      placementLayer: "structure",
      tags: ["target:temporary_shelter", "target_layer:structure"],
    }
  }

  if (planType === "maintain_area") {
    return {
      zoneType: "initial_care",
      placementLayer: "facility",
      tags: ["target:initial_care", "target_layer:facility"],
    }
  }

  if (planType === "plant_nature") {
    return {
      zoneType: "natural_boundary",
      placementLayer: "nature",
      tags: ["target:natural_boundary", "target_layer:nature"],
    }
  }

  if (planType === "expand_area") {
    return {
      zoneType: "visual_center",
      placementLayer: "zone",
      tags: ["target:visual_center", "target_layer:zone"],
    }
  }

  if (planType === "observe_area") {
    return {
      zoneType: "visual_center",
      tags: ["target:visual_center"],
    }
  }

  if (planType === "rest_area") {
    return {
      zoneType: "pet_rest",
      tags: ["target:pet_rest"],
    }
  }

  if (planType === "reorganize_area") {
    return {
      zoneType: "visual_center",
      tags: ["target:visual_center"],
    }
  }

  return {
    tags: ["no_target"],
  }
}

function buildPlanBlockers(
  input: BuildWorldChangePlanInput,
  planType: WorldChangePlanType
): string[] {
  const blockers = [...input.decision.selectedIntent.blockers]

  if (
    (planType === "build_structure" || planType === "expand_area") &&
    input.environment.materials.buildReadiness < 35
  ) {
    blockers.push("建造准备度不足")
  }

  if (
    planType === "plant_nature" &&
    input.environment.materials.water < 35
  ) {
    blockers.push("水资源不足")
  }

  return blockers
}

function buildPlanReason(
  planType: WorldChangePlanType,
  status: WorldChangePlanStatus
): string {
  if (status === "blocked") {
    return "意图已形成，但当前世界条件阻止本轮生成变化。"
  }

  if (planType === "no_change") {
    return "当前不需要改变世界状态。"
  }

  return `根据管家意图生成 ${planType} 世界变化计划。`
}
