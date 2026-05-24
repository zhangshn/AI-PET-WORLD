/**
 * Current file responsibility: audit world layout generation input against
 * the V2.0 MVP world-generation boundaries.
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type {
  WorldLayoutGenerationAudit,
  WorldLayoutGenerationInput,
} from "./generation-schema"

const FORBIDDEN_LAYOUT_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet_actor",
  "pet-bed",
  "pet bed",
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
    selectedCandidateId: input.selectedCandidate.candidateId,
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
    biomeDrivers: [
      `biome:${input.biome.biomeType}`,
      `materialCap:${input.biome.resourceCaps.materialReadiness}`,
      `careCap:${input.biome.resourceCaps.careReadiness}`,
      `naturalCap:${input.biome.resourceCaps.naturalGrowth}`,
      `groundCap:${input.biome.resourceCaps.groundHealth}`,
      `spaceCap:${input.biome.resourceCaps.spacePressure}`,
      ...input.biome.visualTokens.map((token) => `visual:${token}`),
    ],
    phaseDrivers: [
      `phase:${input.phase.phase}`,
      `development:${input.phase.developmentPressure.toFixed(2)}`,
      `expansion:${input.phase.expansionReadiness.toFixed(2)}`,
    ],
    constraintDrivers: input.constraints.map((constraint) => constraint.id),
    stableSeed: input.seed,
    warnings,
    tags: [
      "world_layout_generation_audit",
      warnings.length === 0 ? "layout_input_valid" : "layout_input_warning",
      "layout_candidate_audit",
      "biome_constraint_audit",
      "no_direct_adoption_layout",
    ],
  }
}

function auditRequiredFields(input: WorldLayoutGenerationInput): string[] {
  const warnings: string[] = []

  if (!input.seed.trim()) warnings.push("layout input missing stable seed.")
  if (!input.variant.variantId.trim()) warnings.push("layout input missing variantId.")
  if (!input.selectedCandidate.candidateId.trim()) {
    warnings.push("layout input missing selected candidate.")
  }
  if (input.candidates.length === 0) {
    warnings.push("layout input missing layout candidates.")
  }
  if (input.constraints.length === 0) {
    warnings.push("layout input missing layout constraints.")
  }
  if (input.tags.length === 0) warnings.push("layout input missing tags.")

  return warnings
}

function auditForbiddenTokens(input: WorldLayoutGenerationInput): string[] {
  const serialized = JSON.stringify(input).toLowerCase()

  return FORBIDDEN_LAYOUT_TOKENS.flatMap((token) =>
    serialized.includes(token)
      ? [`layout input contains forbidden token: ${token}`]
      : []
  )
}
