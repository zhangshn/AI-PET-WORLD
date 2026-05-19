/**
 * 当前文件职责：将行为意图决策转换为世界变化计划。
 */

import type {
  BuildWorldChangePlanInput,
  WorldChangePlan,
  WorldChangePlanPriority,
  WorldChangePlanRiskHint,
  WorldChangePlanScope,
  WorldChangePlanStatus,
  WorldChangePlanType,
  WorldChangeTarget,
} from "./world-evolution-schema"

const DIFF_GENERATING_PLAN_TYPES: WorldChangePlanType[] = [
  "plant_nature",
  "build_path",
  "clean_area",
  "repair_facility",
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

  const planType = mapIntentTypeToPlanType(input)
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
  const priority = buildPlanPriority({
    input: input.input,
    planType: input.type,
    status: input.status,
  })
  const scope = buildPlanScope(input.type)
  const riskHints = buildPlanRiskHints({
    input: input.input,
    planType: input.type,
  })

  return {
    id: `world-change-plan-${input.input.now}-${selectedIntent.type}`,
    type: input.type,
    status: input.status,
    sourceIntentType: selectedIntent.type,
    sourceIntentScore: selectedIntent.score,
    priority,
    scope,
    riskHints,
    shouldGenerateDiff: input.shouldGenerateDiff,
    target: input.target,
    reason: input.reason,
    blockers: input.blockers,
    tags: [
      "world_change_plan_v0",
      `source_intent:${selectedIntent.type}`,
      `plan_type:${input.type}`,
      `status:${input.status}`,
      `priority:${priority}`,
      `scope:${scope}`,
    ],
  }
}

function mapIntentTypeToPlanType(
  input: BuildWorldChangePlanInput
): WorldChangePlanType {
  const selectedIntent = input.decision.selectedIntent

  if (selectedIntent.type === "build") return resolveBuildPlanType(input)
  if (selectedIntent.type === "maintain") return resolveMaintainPlanType(input)
  if (selectedIntent.type === "plant") return "plant_nature"
  if (selectedIntent.type === "expand") return "expand_area"
  if (selectedIntent.type === "observe") return "observe_area"
  if (selectedIntent.type === "rest") return "rest_area"
  if (selectedIntent.type === "reorganize") {
    return resolveReorganizePlanType(input)
  }

  return "no_change"
}

function resolveBuildPlanType(
  input: BuildWorldChangePlanInput
): WorldChangePlanType {
  if (input.decision.selectedIntent.type !== "build") return "no_change"
  if (getActiveConstructionPlanCount(input) <= 0) return "build_shelter"
  if (input.environment.materials.buildReadiness >= 65) {
    return "build_structure"
  }

  return "build_path"
}

function resolveMaintainPlanType(
  input: BuildWorldChangePlanInput
): WorldChangePlanType {
  if (input.environment.ecology.habitatStability < 45) {
    return "repair_facility"
  }

  if (input.environment.materials.buildReadiness < 40) {
    return "clean_area"
  }

  return "maintain_area"
}

function resolveReorganizePlanType(
  input: BuildWorldChangePlanInput
): WorldChangePlanType {
  if (input.homeMapState.constructionPlans.length >= 4) {
    return "rebalance_zones"
  }

  return "reorganize_area"
}

function getActiveConstructionPlanCount(
  input: BuildWorldChangePlanInput
): number {
  return input.homeMapState.constructionPlans.filter(
    (plan) => plan.status === "active"
  ).length
}

function buildTargetForPlanType(
  planType: WorldChangePlanType
): WorldChangeTarget {
  if (planType === "build_structure") {
    return {
      zoneType: "temporary_shelter",
      placementLayer: "structure",
      preferredAssetTags: ["structure", "starter_build"],
      tags: [
        "target:temporary_shelter",
        "target_layer:structure",
        "plan:build_structure",
      ],
    }
  }

  if (planType === "build_shelter") {
    return {
      zoneType: "temporary_shelter",
      placementLayer: "structure",
      preferredAssetTags: ["shelter", "starter_home"],
      tags: [
        "target:temporary_shelter",
        "target_layer:structure",
        "plan:build_shelter",
      ],
    }
  }

  if (planType === "build_path") {
    return {
      zoneType: "visual_center",
      placementLayer: "path",
      preferredAssetTags: ["path", "walkable"],
      tags: ["target:visual_center", "target_layer:path", "plan:build_path"],
    }
  }

  if (planType === "maintain_area") {
    return {
      zoneType: "initial_care",
      placementLayer: "facility",
      preferredAssetTags: ["care", "maintenance"],
      tags: [
        "target:initial_care",
        "target_layer:facility",
        "plan:maintain_area",
      ],
    }
  }

  if (planType === "repair_facility") {
    return {
      zoneType: "initial_care",
      placementLayer: "facility",
      preferredAssetTags: ["care", "repairable"],
      tags: [
        "target:initial_care",
        "target_layer:facility",
        "plan:repair_facility",
      ],
    }
  }

  if (planType === "clean_area") {
    return {
      zoneType: "visual_center",
      placementLayer: "surface-decoration",
      preferredAssetTags: ["cleanup"],
      tags: [
        "target:visual_center",
        "target_layer:surface-decoration",
        "plan:clean_area",
      ],
    }
  }

  if (planType === "plant_nature") {
    return {
      zoneType: "natural_boundary",
      placementLayer: "nature",
      preferredAssetTags: ["nature", "plant"],
      tags: [
        "target:natural_boundary",
        "target_layer:nature",
        "plan:plant_nature",
      ],
    }
  }

  if (planType === "expand_area") {
    return {
      zoneType: "visual_center",
      placementLayer: "zone",
      preferredAssetTags: ["expansion", "space"],
      tags: ["target:visual_center", "target_layer:zone", "plan:expand_area"],
    }
  }

  if (planType === "move_object") {
    return {
      zoneType: "visual_center",
      placementLayer: "surface-decoration",
      preferredAssetTags: ["movable"],
      tags: [
        "target:visual_center",
        "target_layer:surface-decoration",
        "plan:move_object",
      ],
    }
  }

  if (planType === "remove_object") {
    return {
      zoneType: "visual_center",
      placementLayer: "surface-decoration",
      preferredAssetTags: ["removable"],
      tags: [
        "target:visual_center",
        "target_layer:surface-decoration",
        "plan:remove_object",
      ],
    }
  }

  if (planType === "upgrade_facility") {
    return {
      zoneType: "initial_care",
      placementLayer: "facility",
      preferredAssetTags: ["upgradeable", "care"],
      tags: [
        "target:initial_care",
        "target_layer:facility",
        "plan:upgrade_facility",
      ],
    }
  }

  if (planType === "observe_area") {
    return {
      zoneType: "visual_center",
      preferredAssetTags: ["observation"],
      tags: ["target:visual_center", "plan:observe_area"],
    }
  }

  if (planType === "rest_area") {
    return {
      zoneType: "pet_rest",
      preferredAssetTags: ["rest"],
      tags: ["target:pet_rest", "plan:rest_area"],
    }
  }

  if (planType === "reorganize_area") {
    return {
      zoneType: "visual_center",
      preferredAssetTags: ["organization"],
      tags: ["target:visual_center", "plan:reorganize_area"],
    }
  }

  if (planType === "rebalance_zones") {
    return {
      zoneType: "visual_center",
      tags: ["target:visual_center", "plan:rebalance_zones"],
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
    (planType === "build_structure" || planType === "build_shelter") &&
    input.environment.materials.buildReadiness < 35
  ) {
    blockers.push("建造准备度不足")
  }

  if (
    planType === "build_path" &&
    input.environment.materials.buildReadiness < 25
  ) {
    blockers.push("路径建设材料不足")
  }

  if (
    planType === "repair_facility" &&
    input.environment.materials.buildReadiness < 30
  ) {
    blockers.push("设施修复材料不足")
  }

  if (
    planType === "plant_nature" &&
    input.environment.materials.water < 35
  ) {
    blockers.push("水资源不足")
  }

  if (
    planType === "expand_area" &&
    input.environment.materials.buildReadiness < 45
  ) {
    blockers.push("扩建准备度不足")
  }

  if (
    planType === "clean_area" &&
    input.environment.materials.tags.includes("low_materials") &&
    input.decision.selectedIntent.score < 65
  ) {
    blockers.push("清理行动支持不足")
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

  if (planType === "build_shelter") {
    return "管家计划为初始家园补足基础 shelter。"
  }

  if (planType === "build_path") {
    return "管家计划优化家园内部通行路径。"
  }

  if (planType === "build_structure") {
    return "管家计划推进基础结构建设。"
  }

  if (planType === "maintain_area") {
    return "管家计划进行基础家园维护。"
  }

  if (planType === "repair_facility") {
    return "管家计划修复照护或家园设施。"
  }

  if (planType === "clean_area") {
    return "管家计划清理家园中的杂乱区域。"
  }

  if (planType === "plant_nature") {
    return "管家计划增加自然细节。"
  }

  if (planType === "expand_area") {
    return "管家计划扩大家园可用空间。"
  }

  if (planType === "move_object") {
    return "管家计划移动已有对象以优化空间。"
  }

  if (planType === "remove_object") {
    return "管家计划移除不再适合的对象。"
  }

  if (planType === "upgrade_facility") {
    return "管家计划升级已有照护设施。"
  }

  if (planType === "observe_area") {
    return "管家计划继续观察当前区域。"
  }

  if (planType === "rest_area") {
    return "管家计划进入低强度休整。"
  }

  if (planType === "reorganize_area") {
    return "管家计划整理当前家园区域。"
  }

  if (planType === "rebalance_zones") {
    return "管家计划重新平衡多个家园区域。"
  }

  return `根据管家意图生成 ${planType} 世界变化计划。`
}

function buildPlanPriority(input: {
  input: BuildWorldChangePlanInput
  planType: WorldChangePlanType
  status: WorldChangePlanStatus
}): WorldChangePlanPriority {
  if (input.status === "blocked") return "low"

  if (
    input.planType === "repair_facility" &&
    input.input.environment.ecology.habitatStability < 35
  ) {
    return "critical"
  }

  if (
    input.planType === "clean_area" &&
    input.input.environment.materials.buildReadiness < 30
  ) {
    return "high"
  }

  if (input.input.decision.selectedIntent.score >= 75) return "high"
  if (input.input.decision.selectedIntent.score >= 45) return "medium"

  return "low"
}

function buildPlanScope(planType: WorldChangePlanType): WorldChangePlanScope {
  if (
    planType === "observe_area" ||
    planType === "rest_area" ||
    planType === "no_change"
  ) {
    return "observation_only"
  }

  if (
    planType === "build_structure" ||
    planType === "build_shelter" ||
    planType === "repair_facility" ||
    planType === "plant_nature" ||
    planType === "move_object" ||
    planType === "remove_object" ||
    planType === "upgrade_facility"
  ) {
    return "single_placement"
  }

  if (
    planType === "build_path" ||
    planType === "maintain_area" ||
    planType === "clean_area" ||
    planType === "expand_area" ||
    planType === "reorganize_area"
  ) {
    return "single_zone"
  }

  if (planType === "rebalance_zones") return "multi_zone"

  return "whole_home"
}

function buildPlanRiskHints(input: {
  input: BuildWorldChangePlanInput
  planType: WorldChangePlanType
}): WorldChangePlanRiskHint[] {
  const hints: WorldChangePlanRiskHint[] = ["low_risk"]

  if (
    input.planType === "build_structure" ||
    input.planType === "build_shelter" ||
    input.planType === "build_path" ||
    input.planType === "expand_area" ||
    input.planType === "move_object" ||
    input.planType === "rebalance_zones"
  ) {
    hints.push("space_sensitive", "geometry_sensitive")
  }

  if (
    input.planType === "plant_nature" ||
    input.planType === "repair_facility" ||
    input.planType === "clean_area" ||
    input.planType === "upgrade_facility"
  ) {
    hints.push("resource_sensitive")
  }

  if (
    input.planType === "repair_facility" ||
    input.planType === "maintain_area" ||
    input.planType === "clean_area" ||
    input.planType === "rest_area"
  ) {
    hints.push("pet_sensitive")
  }

  if (input.planType === "build_shelter") {
    hints.push("incubator_sensitive")
  }

  if (input.input.homeMapState.mapDiffs.length > 20) {
    hints.push("persistence_sensitive")
  }

  return uniquePlanRiskHints(hints)
}

function uniquePlanRiskHints(
  hints: WorldChangePlanRiskHint[]
): WorldChangePlanRiskHint[] {
  return Array.from(new Set(hints))
}
