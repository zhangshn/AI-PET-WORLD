/**
 * ======================================================
 * AI-PET-WORLD
 * Consciousness Gateway
 * ======================================================
 */

import type { PersonalityProfile } from "../personality-core/schema"
import type { ZiweiConsciousnessKernel } from "./consciousness-types"
import { buildZiweiConsciousnessKernel } from "./ziwei-consciousness-builder"

export function buildConsciousnessFromPersonality(
  personalityProfile: PersonalityProfile
): ZiweiConsciousnessKernel {
  return buildZiweiConsciousnessKernel(personalityProfile)
}

export type {
  ConsciousnessArchetype,
  ConsciousnessBias,
  ConsciousnessCoreDrive,
  ThreatInterpretationStyle,
  AttachmentApproachStyle,
  RecoveryResistanceStyle,
  NoveltyResponseStyle,
  OrderResponseStyle,
  ZiweiConsciousnessKernel,
} from "./consciousness-types"