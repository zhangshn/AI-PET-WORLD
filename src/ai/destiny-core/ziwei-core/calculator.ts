import type {
  BirthInput,
  BirthPattern
} from "./ziwei-core-schema"

import { buildLegacyBirthPattern } from "./adapters"

export function calculateBirthPattern(
  input: BirthInput
): BirthPattern {
  return buildLegacyBirthPattern(input)
}
