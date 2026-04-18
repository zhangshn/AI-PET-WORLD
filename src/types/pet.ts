/**
 * ======================================================
 * AI-PET-WORLD
 * Pet Type
 * ======================================================
 */

import type { PersonalityProfile } from "../ai/personality-core/gateway"

export type PetAction =
  | "sleeping"
  | "walking"
  | "eating"

export type PetMood =
  | "happy"
  | "normal"
  | "sad"

export type PetState = {
  name: string
  energy: number
  hunger: number
  mood: PetMood
  action: PetAction
  personalityProfile: PersonalityProfile
}