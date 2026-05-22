/**
 * 当前文件负责：审计世界布局生成输入是否符合当前 MVP 边界。
 */

import type {
  WorldLayoutGenerationAudit,
  WorldLayoutGenerationInput,
} from "./generation-schema"

const FORBIDDEN_LAYOUT_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditWorldLayoutGenerationInput(
  input: WorldLayoutGenerationInput
): WorldLayoutGenerationAudit {
  const warnings = [
    ...auditRequiredFields(input),
    ...auditForbiddenTokens(input),
  ]

  return {
    selectedVariant: input.variant,
    personalityDrivers: [
      `structure:${input.personality.structurePreference.toFixed(2)}`,
      `care:${input.personality.carePreference.toFixed(2)}`,
      `protection:${input.personality.protectionPreference.toFixed(2)}`,
      `aesthetic:${input.personality.aestheticPreference.toFixed(2)}`,
      `quiet:${input.personality.quietPreference.toFixed(2)}`,
      `adaptability:${input.personality.adaptabilityPreference.toFixed(2)}`,
    ],
    resourceDrivers: [
      `material:${input.resources.materialReadiness}`,
      `care:${input.resources.careReadiness}`,
      `natural:${input.resources.naturalGrowth}`,
      `ground:${input.resources.groundHealth}`,
      `space:${input.resources.spacePressure}`,
    ],
    phaseDrivers: [
      `phase:${input.phase.phase}`,
      `development:${input.phase.developmentPressure.toFixed(2)}`,
      `expansion:${input.phase.expansionReadiness.toFixed(2)}`,
    ],
    stableSeed: input.seed,
    warnings,
    tags: [
      "world_layout_generation_audit",
      warnings.length === 0 ? "layout_input_valid" : "layout_input_warning",
      "no_default_companion_layout",
    ],
  }
}

function auditRequiredFields(input: WorldLayoutGenerationInput): string[] {
  const warnings: string[] = []

  if (!input.seed.trim()) warnings.push("layout input 缺少 stable seed。")
  if (!input.variant.variantId.trim()) warnings.push("layout input 缺少 variantId。")
  if (input.tags.length === 0) warnings.push("layout input 缺少 tags。")

  return warnings
}

function auditForbiddenTokens(input: WorldLayoutGenerationInput): string[] {
  const serialized = JSON.stringify(input).toLowerCase()

  return FORBIDDEN_LAYOUT_TOKENS.flatMap((token) =>
    serialized.includes(token)
      ? [`layout input 包含禁止 token：${token}`]
      : []
  )
}
