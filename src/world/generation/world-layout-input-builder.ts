/**
 * 当前文件负责：从世界生成输入派生稳定的布局生成输入。
 */

import type {
  InitialHomeGenerationInput,
  WorldLayoutGenerationBuildResult,
  WorldLayoutGenerationInput,
  WorldLayoutNatureBias,
  WorldLayoutPathStyle,
  WorldLayoutPhaseInput,
  WorldLayoutQuietAreaBias,
  WorldLayoutResourceInput,
  WorldLayoutShelterBias,
  WorldLayoutVariantInput,
} from "./generation-schema"
import { buildSeededNumber, pickSeededItem } from "./world-seed"

export function buildWorldLayoutGenerationInput(input: {
  generationInput: InitialHomeGenerationInput
  seed: string
  resources: WorldLayoutResourceInput
}): WorldLayoutGenerationBuildResult {
  const { generationInput, seed, resources } = input
  const personality = {
    structurePreference: clampPreference(
      generationInput.butlerConstructionStyle.structuredBuilder
    ),
    carePreference: clampPreference(
      generationInput.butlerConstructionStyle.warmCaretaker
    ),
    protectionPreference: clampPreference(
      generationInput.butlerConstructionStyle.protectiveKeeper
    ),
    aestheticPreference: clampPreference(
      generationInput.butlerConstructionStyle.aestheticOrganizer
    ),
    quietPreference: clampPreference(
      generationInput.butlerConstructionStyle.quietMaintainer
    ),
    adaptabilityPreference: clampPreference(
      generationInput.butlerConstructionStyle.adaptivePlanner
    ),
  }
  const phase = buildLayoutPhaseInput(resources, personality.structurePreference)
  const variant = buildLayoutVariantInput({ seed, personality, resources })
  const layoutInput: WorldLayoutGenerationInput = {
    worldId: generationInput.worldId,
    ownerId: generationInput.ownerId,
    seed,
    birthSignature: generationInput.birthSignature,
    worldSalt: generationInput.worldSalt,
    personality,
    resources,
    phase,
    variant,
    tags: [
      "world_layout_generation_input",
      "stable_seed_driven",
      "personality_layout_driven",
      "resource_layout_driven",
    ],
  }

  return {
    layoutInput,
    audit: {
      selectedVariant: variant,
      personalityDrivers: buildPersonalityDrivers(personality),
      resourceDrivers: buildResourceDrivers(resources),
      phaseDrivers: buildPhaseDrivers(phase),
      stableSeed: seed,
      warnings: [],
      tags: [
        "world_layout_generation_audit",
        "stable_seed_verified",
        "no_default_companion_layout",
      ],
    },
  }
}

function buildLayoutPhaseInput(
  resources: WorldLayoutResourceInput,
  structurePreference: number
): WorldLayoutPhaseInput {
  const developmentPressure = clampPreference(
    resources.spacePressure / 100 + (100 - resources.materialReadiness) / 240
  )
  const expansionReadiness = clampPreference(
    resources.materialReadiness / 120 + structurePreference / 3
  )

  if (resources.materialReadiness >= 45 && resources.careReadiness >= 55) {
    return {
      phase: "basic_living_preparation",
      developmentPressure,
      expansionReadiness,
    }
  }

  if (resources.materialReadiness >= 32 || resources.careReadiness >= 50) {
    return {
      phase: "first_home_seed",
      developmentPressure,
      expansionReadiness,
    }
  }

  return {
    phase: "initial_empty_land",
    developmentPressure,
    expansionReadiness,
  }
}

function buildLayoutVariantInput(input: {
  seed: string
  personality: WorldLayoutGenerationInput["personality"]
  resources: WorldLayoutResourceInput
}): WorldLayoutVariantInput {
  const pathStyles: readonly WorldLayoutPathStyle[] = [
    "direct",
    "curved",
    "clustered",
  ]
  const shelterBiases: readonly WorldLayoutShelterBias[] = [
    "near_center",
    "edge_protected",
    "resource_adjacent",
  ]
  const natureBiases: readonly WorldLayoutNatureBias[] = [
    "open",
    "soft_boundary",
    "dense_boundary",
  ]
  const quietAreaBiases: readonly WorldLayoutQuietAreaBias[] = [
    "near_shelter",
    "near_nature",
    "near_care",
  ]
  const pathStyle =
    input.personality.structurePreference > 0.68
      ? "direct"
      : input.personality.adaptabilityPreference > 0.68
        ? "curved"
        : pickSeededItem(pathStyles, input.seed, "layout-path-style")
  const shelterBias =
    input.personality.protectionPreference > 0.7
      ? "edge_protected"
      : input.resources.materialReadiness > 48
        ? "resource_adjacent"
        : pickSeededItem(shelterBiases, input.seed, "layout-shelter-bias")
  const natureBias =
    input.personality.protectionPreference > 0.72 ||
    input.resources.naturalGrowth > 58
      ? "dense_boundary"
      : input.personality.aestheticPreference > 0.66
        ? "soft_boundary"
        : pickSeededItem(natureBiases, input.seed, "layout-nature-bias")
  const quietAreaBias =
    input.personality.quietPreference > 0.68
      ? "near_nature"
      : input.personality.carePreference > 0.7
        ? "near_care"
        : pickSeededItem(quietAreaBiases, input.seed, "layout-quiet-bias")

  return {
    variantId: `layout_${Math.floor(
      buildSeededNumber(input.seed, "layout-variant-id") * 100000
    ).toString(36)}`,
    pathStyle,
    shelterBias,
    natureBias,
    quietAreaBias,
  }
}

function buildPersonalityDrivers(
  personality: WorldLayoutGenerationInput["personality"]
): string[] {
  return [
    `structure:${personality.structurePreference.toFixed(2)}`,
    `care:${personality.carePreference.toFixed(2)}`,
    `protection:${personality.protectionPreference.toFixed(2)}`,
    `aesthetic:${personality.aestheticPreference.toFixed(2)}`,
    `quiet:${personality.quietPreference.toFixed(2)}`,
    `adaptability:${personality.adaptabilityPreference.toFixed(2)}`,
  ]
}

function buildResourceDrivers(resources: WorldLayoutResourceInput): string[] {
  return [
    `material:${resources.materialReadiness}`,
    `care:${resources.careReadiness}`,
    `natural:${resources.naturalGrowth}`,
    `ground:${resources.groundHealth}`,
    `space:${resources.spacePressure}`,
  ]
}

function buildPhaseDrivers(phase: WorldLayoutPhaseInput): string[] {
  return [
    `phase:${phase.phase}`,
    `development:${phase.developmentPressure.toFixed(2)}`,
    `expansion:${phase.expansionReadiness.toFixed(2)}`,
  ]
}

function clampPreference(value: number): number {
  return Math.min(1, Math.max(0, value))
}
