/**

 */

import type {
  ButlerConstructionIntentInput,
  ConstructionPlannerInput,
  ConstructionPlannerInputAudit,
} from "./construction-schema"

export function auditConstructionPlannerInput(
  input: ConstructionPlannerInput
): ConstructionPlannerInputAudit {
  const warnings = [
    ...auditRequiredFields(input),
    ...auditIntentConsistency(input.intents),
  ]

  return {
    stableInputFingerprint: buildConstructionPlannerInputFingerprint(input),
    checkedIntentIds: input.intents.map((intent) => intent.intentId),
    checkedZoneTypes: input.intents.map((intent) => intent.targetZoneType),
    warnings,
    tags: [
      "construction_planner_input_audit",
      warnings.length === 0 ? "construction_input_valid" : "construction_input_warning",
      "no_direct_map_mutation",
      "no_direct_life_plan",
    ],
  }
}

export function buildConstructionPlannerInputFingerprint(
  input: ConstructionPlannerInput
): string {
  return [
    input.worldId,
    input.ownerId,
    input.seed,
    input.phase.stage,
    input.phase.worldDay,
    input.phase.developmentPressure.toFixed(4),
    input.phase.maintenancePressure.toFixed(4),
    input.phase.expansionReadiness.toFixed(4),
    fingerprintResources(input.resources),
    fingerprintStyle(input.constructionStyle),
    input.existingPlanIds.join("+"),
    input.intents.map(fingerprintIntent).join("|"),
    input.homeMapState.zones
      .map((zone) => `${zone.id}:${zone.type}:${zone.bounds.x},${zone.bounds.y}`)
      .sort()
      .join("|"),
    input.homeMapState.placements
      .map((placement) => `${placement.id}:${placement.layer}:${placement.x},${placement.y}`)
      .sort()
      .join("|"),
  ].join("::")
}

function auditRequiredFields(input: ConstructionPlannerInput): string[] {
  const warnings: string[] = []

  if (!input.worldId.trim()) warnings.push("ConstructionPlannerInput 缺少 worldId。")
  if (!input.ownerId.trim()) warnings.push("ConstructionPlannerInput 缺少 ownerId。")
  if (!input.seed.trim()) warnings.push("ConstructionPlannerInput 缺少 stable seed。")
  if (input.intents.length === 0) warnings.push("ConstructionPlannerInput 缺少建设意图。")
  if (input.tags.length === 0) warnings.push("ConstructionPlannerInput 缺少 tags。")

  return warnings
}

function auditIntentConsistency(
  intents: ButlerConstructionIntentInput[]
): string[] {
  const warnings: string[] = []
  const seenIntentIds = new Set<string>()

  intents.forEach((intent) => {
    if (!intent.intentId.trim()) warnings.push("存在空 intentId。")
    if (seenIntentIds.has(intent.intentId)) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
    seenIntentIds.add(intent.intentId)

    if (!intent.reason.trim()) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
    if (intent.urgency < 0 || intent.urgency > 1) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
    if (intent.patience < 0 || intent.patience > 1) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
    if (intent.resourceSensitivity < 0 || intent.resourceSensitivity > 1) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
    if (intent.spaceSensitivity < 0 || intent.spaceSensitivity > 1) {
      warnings.push(`Duplicate intentId: ${intent.intentId}`)
    }
  })

  return warnings
}

function fingerprintResources(
  resources: ConstructionPlannerInput["resources"]
): string {
  return [
    `ground:${resources.groundHealth}`,
    `natural:${resources.naturalGrowth}`,
    `material:${resources.materialReadiness}`,
    `care:${resources.careReadiness}`,
    `space:${resources.spacePressure}`,
  ].join("+")
}

function fingerprintStyle(
  style: ConstructionPlannerInput["constructionStyle"]
): string {
  return [
    `structured:${style.structuredBuilder.toFixed(4)}`,
    `warm:${style.warmCaretaker.toFixed(4)}`,
    `protective:${style.protectiveKeeper.toFixed(4)}`,
    `aesthetic:${style.aestheticOrganizer.toFixed(4)}`,
    `quiet:${style.quietMaintainer.toFixed(4)}`,
    `adaptive:${style.adaptivePlanner.toFixed(4)}`,
  ].join("+")
}

function fingerprintIntent(intent: ButlerConstructionIntentInput): string {
  return [
    intent.intentId,
    intent.source,
    intent.goal,
    intent.targetZoneType,
    intent.urgency.toFixed(4),
    intent.patience.toFixed(4),
    intent.resourceSensitivity.toFixed(4),
    intent.spaceSensitivity.toFixed(4),
    intent.tags.join("+"),
  ].join(":")
}
