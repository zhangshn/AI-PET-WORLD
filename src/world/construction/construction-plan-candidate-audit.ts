/**
 * 当前文件负责：审计 ConstructionPlanner 候选计划输出。
 */

import type {
  ConstructionPlan,
  ConstructionPlanCandidateAudit,
  ConstructionPlannerInput,
} from "./construction-schema"

const FORBIDDEN_CONSTRUCTION_CANDIDATE_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditConstructionPlanCandidates(input: {
  plannerInput: ConstructionPlannerInput
  plans: ConstructionPlan[]
  acceptedIntentIds: string[]
  skippedIntentIds: string[]
}): ConstructionPlanCandidateAudit {
  const warnings = [
    ...auditRequiredCandidateFields(input.plans),
    ...auditDuplicatePlanIds(input.plans),
    ...auditPlanBoundaries(input.plans),
    ...auditAcceptedIntentIds({
      plannerInput: input.plannerInput,
      acceptedIntentIds: input.acceptedIntentIds,
    }),
    ...auditForbiddenTokens(input.plans),
  ]

  return {
    stableOutputFingerprint: buildConstructionPlanCandidateFingerprint(
      input.plans
    ),
    candidatePlanIds: input.plans.map((plan) => plan.id),
    acceptedIntentIds: input.acceptedIntentIds,
    skippedIntentIds: input.skippedIntentIds,
    warnings,
    tags: [
      "construction_plan_candidate_audit",
      warnings.length === 0 ? "candidate_output_valid" : "candidate_output_warning",
      "no_map_diff_generated",
      "no_home_map_state_mutation",
      "no_default_companion_plan",
    ],
  }
}

export function buildConstructionPlanCandidateFingerprint(
  plans: ConstructionPlan[]
): string {
  return plans
    .map((plan) =>
      [
        plan.id,
        plan.projectType,
        plan.targetZoneType,
        plan.status,
        plan.currentStage,
        plan.priority,
        plan.reasonDrivers.join("+"),
        plan.houseStyle.preferenceId,
        plan.houseStyle.archetype,
        plan.houseStyle.materialPreference,
        plan.houseStyle.scalePreference,
        plan.styleTags.join("+"),
        plan.resourceRequests
          .map((request) =>
            [
              request.transactionId,
              request.resourceKey,
              request.amount,
              request.source,
            ].join(":")
          )
          .join("+"),
        plan.createdAt,
        plan.updatedAt,
        plan.tags.join("+"),
        plan.stages
          .map((stage) =>
            [
              stage.id,
              stage.type,
              stage.progress,
              stage.completed ? "completed" : "pending",
              stage.mapDiffIds.join("+"),
            ].join(":")
          )
          .join("|"),
      ].join("::")
    )
    .sort()
    .join("||")
}

function auditRequiredCandidateFields(plans: ConstructionPlan[]): string[] {
  return plans.flatMap((plan) => {
    const warnings: string[] = []

    if (!plan.id.trim()) warnings.push("候选计划缺少 id。")
    if (!plan.title.trim()) warnings.push(`候选计划缺少 title：${plan.id}`)
    if (!plan.reason.trim()) warnings.push(`候选计划缺少 reason：${plan.id}`)
    if (plan.reasonDrivers.length === 0) {
      warnings.push(`候选计划缺少 reasonDrivers：${plan.id}`)
    }
    if (plan.resourceRequests.length === 0) {
      warnings.push(`候选计划缺少资源交易请求：${plan.id}`)
    }
    if (!plan.houseStyle.preferenceId.trim()) {
      warnings.push(`候选计划缺少房屋偏好 metadata：${plan.id}`)
    }
    if (!plan.styleReason.trim()) {
      warnings.push(`候选计划缺少 styleReason：${plan.id}`)
    }
    if (plan.styleTags.length === 0) {
      warnings.push(`候选计划缺少 styleTags：${plan.id}`)
    }
    if (plan.stages.length === 0) warnings.push(`候选计划缺少 stages：${plan.id}`)
    if (plan.priority < 0 || plan.priority > 100) {
      warnings.push(`候选计划 priority 越界：${plan.id}`)
    }

    return warnings
  })
}

function auditDuplicatePlanIds(plans: ConstructionPlan[]): string[] {
  const seen = new Set<string>()
  const warnings: string[] = []

  plans.forEach((plan) => {
    if (seen.has(plan.id)) warnings.push(`重复候选计划 id：${plan.id}`)
    seen.add(plan.id)
  })

  return warnings
}

function auditPlanBoundaries(plans: ConstructionPlan[]): string[] {
  return plans.flatMap((plan) =>
    plan.stages.flatMap((stage) => {
      const warnings: string[] = []

      if (stage.mapDiffIds.length > 0) {
        warnings.push(`CONSTRUCTION-01 不允许 stage 携带 mapDiffIds：${plan.id}`)
      }
      if (stage.progress !== 0) {
        warnings.push(`CONSTRUCTION-01 候选 stage progress 必须从 0 开始：${plan.id}`)
      }
      if (stage.completed) {
        warnings.push(`CONSTRUCTION-01 候选 stage 不能已完成：${plan.id}`)
      }

      return warnings
    })
  )
}

function auditAcceptedIntentIds(input: {
  plannerInput: ConstructionPlannerInput
  acceptedIntentIds: string[]
}): string[] {
  const knownIntentIds = new Set(
    input.plannerInput.intents.map((intent) => intent.intentId)
  )

  return input.acceptedIntentIds.flatMap((intentId) =>
    knownIntentIds.has(intentId)
      ? []
      : [`候选计划引用未知 intent：${intentId}`]
  )
}

function auditForbiddenTokens(plans: ConstructionPlan[]): string[] {
  const serialized = JSON.stringify(plans).toLowerCase()

  return FORBIDDEN_CONSTRUCTION_CANDIDATE_TOKENS.flatMap((token) =>
    serialized.includes(token)
      ? [`候选计划包含禁止 token：${token}`]
      : []
  )
}
