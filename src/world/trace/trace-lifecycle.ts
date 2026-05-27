import { clamp } from "@/world/procedural-painter/scene-composer/scene-composer-random"

import type {
  TraceLifecyclePhase,
  TraceSourceKind,
  TraceStrengthLevel,
} from "./trace-schema"

export function resolveTraceStrengthLevel(
  strength: number
): TraceStrengthLevel {
  const cleanStrength = normalizeTraceStrength(strength)

  if (cleanStrength <= 0) return "none"
  if (cleanStrength <= 32) return "weak"
  if (cleanStrength <= 65) return "medium"
  if (cleanStrength <= 89) return "strong"

  return "landmark"
}

export function resolveTraceLifecyclePhase(input: {
  strength: number
  age: number
  sourceKind: TraceSourceKind
  ecologyHealthHint?: number
}): TraceLifecyclePhase {
  const strength = normalizeTraceStrength(input.strength)
  const ecologyHealthHint = input.ecologyHealthHint ?? 0

  if (
    input.sourceKind === "ecology_state" &&
    ecologyHealthHint > 65 &&
    strength < 45
  ) {
    return "repaired"
  }

  if (ecologyHealthHint > 72 && strength < 35) {
    return "covered"
  }

  if (input.age > 60 && strength < 30) {
    return "decaying"
  }

  if (strength >= 80) {
    return "strengthened"
  }

  if (strength >= 45) {
    return "accumulating"
  }

  if (strength > 0) {
    return "generated"
  }

  return "deposited"
}

export function normalizeTraceStrength(value: number): number {
  return clamp(Math.round(value), 0, 100)
}

export function resolveTraceAge(input: {
  createdAt: number
  updatedAt: number
}): number {
  const elapsed = Math.max(0, input.updatedAt - input.createdAt)
  return Math.floor(elapsed / 1000)
}
