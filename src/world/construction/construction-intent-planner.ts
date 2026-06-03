/**
 * 当前文件职责：根据管家风格、世界照护上下文和资源状态生成建设意图。
 */

import type {
  ConstructionIntent,
  ConstructionIntentPlannerInput,
  ConstructionIntentPlannerResult,
  ConstructionIntentType,
} from "./construction-intent-schema"

export function buildConstructionIntents(
  input: ConstructionIntentPlannerInput
): ConstructionIntentPlannerResult {
  const intents: ConstructionIntent[] = []

  if (input.resources.spacePressure >= 55) {
    intents.push(
      createIntent({
        input,
        type: "improve_quiet_living",
        source: "world_resource",
        targetZoneType: "quiet_living",
        urgency: normalizeUrgency(0.45 + input.resources.spacePressure / 160),
        reason: "当前家园空间压力上升，管家倾向整理一个更安静稳定的生活区。",
        preferredAssetTags: ["rest", "soft", "natural_detail"],
        expectedEffects: ["restComfortUp", "securityUp"],
      })
    )
  }

  if (input.worldCare.careReadiness < 55) {
    intents.push(
      createIntent({
        input,
        type: "improve_care_area",
        source: "world_resource",
        targetZoneType: "initial_care",
        urgency: normalizeUrgency(0.45 + (55 - input.worldCare.careReadiness) / 120),
        reason: "基础照护准备度偏低，管家倾向整理基础照护点。",
        preferredAssetTags: ["care", "soft", "order"],
        expectedEffects: ["careReadinessUp"],
      })
    )
  }

  const style = input.butler.constructionStyle

  if (style && style.protectiveKeeper >= 0.62) {
    intents.push(
      createIntent({
        input,
        type: "add_natural_boundary",
        source: "butler_personality",
        targetZoneType: "natural_boundary",
        urgency: normalizeUrgency(0.38 + style.protectiveKeeper * 0.42),
        reason: "管家当前更偏向保护与边界维护，倾向增强家园外缘的自然边界。",
        preferredAssetTags: ["nature", "boundary", "tree", "bush"],
        expectedEffects: ["securityUp", "naturalBeautyUp"],
      })
    )
  }

  if (style && style.aestheticOrganizer >= 0.58) {
    intents.push(
      createIntent({
        input,
        type: "decorate_home",
        source: "butler_personality",
        targetZoneType: "visual_center",
        urgency: normalizeUrgency(0.34 + style.aestheticOrganizer * 0.4),
        reason: "管家当前更偏向整理与美化，倾向给家园增加轻量自然点缀。",
        preferredAssetTags: ["natural_detail", "flower", "leaf", "grass"],
        expectedEffects: ["naturalBeautyUp"],
      })
    )
  }

  if (input.resources.materialReadiness >= 48) {
    intents.push(
      createIntent({
        input,
        type: "organize_storage",
        source: "world_resource",
        targetZoneType: "storage_tools",
        urgency: normalizeUrgency(0.36 + input.resources.materialReadiness / 160),
        reason: "当前材料准备度足够，管家倾向整理储物与工具区。",
        preferredAssetTags: ["storage", "tools", "order"],
        expectedEffects: ["storageOrderUp"],
      })
    )
  }

  if (
    intents.length === 0 &&
    input.worldTick > 0 &&
    input.worldTick % 8 === 0
  ) {
    intents.push(
      createIntent({
        input,
        type: "soften_entry_area",
        source: "routine",
        targetZoneType: "entry_area",
        urgency: 0.32,
        reason: "管家进行例行维护，倾向轻微整理初始入口区周围环境。",
        preferredAssetTags: ["entry", "soft", "natural_detail"],
        expectedEffects: ["entryComfortUp"],
      })
    )
  }

  const rankedIntents = dedupeIntents(intents)
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 3)

  return {
    intents: rankedIntents,
    messages:
      rankedIntents.length > 0
        ? rankedIntents.map((intent) => intent.reason)
        : ["当前没有产生新的建设意图。"],
    tags: ["construction_intent_planner_result"],
  }
}

function createIntent(input: {
  input: ConstructionIntentPlannerInput
  type: ConstructionIntentType
  source: ConstructionIntent["source"]
  targetZoneType: ConstructionIntent["targetZoneType"]
  urgency: number
  reason: string
  preferredAssetTags: string[]
  expectedEffects: ConstructionIntent["expectedEffects"]
}): ConstructionIntent {
  return {
    id: [
      "intent",
      input.type,
      input.targetZoneType,
      input.input.worldTick,
      input.input.now,
    ].join("-"),
    type: input.type,
    source: input.source,
    targetZoneType: input.targetZoneType,
    urgency: normalizeUrgency(input.urgency),
    reason: input.reason,
    preferredAssetTags: input.preferredAssetTags,
    expectedEffects: input.expectedEffects,
    createdAt: input.input.now,
    tags: [
      "construction_intent",
      input.type,
      input.source,
      input.targetZoneType,
    ],
  }
}

function normalizeUrgency(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

function dedupeIntents(intents: ConstructionIntent[]): ConstructionIntent[] {
  const intentMap = new Map<string, ConstructionIntent>()

  intents.forEach((intent) => {
    const key = `${intent.type}:${intent.targetZoneType}`
    const current = intentMap.get(key)

    if (!current || intent.urgency > current.urgency) {
      intentMap.set(key, intent)
    }
  })

  return Array.from(intentMap.values())
}
