/**
 * 当前文件职责：审计房屋偏好是否满足 V2.0 人格与世界事实约束。
 */

import type {
  HouseArchetype,
  HousePreference,
  HousePreferenceAudit,
} from "./house-style-schema"

const REQUIRED_ARCHETYPES: readonly HouseArchetype[] = [
  "ordered_compact_cabin",
  "warm_care_cottage",
  "protective_courtyard",
  "quiet_retreat_house",
  "aesthetic_garden_home",
  "adaptive_modular_home",
]

export function auditHousePreference(
  preference: HousePreference
): HousePreferenceAudit {
  const warnings = auditRequiredFields(preference)

  return {
    auditId: `house-style-audit:${preference.preferenceId}`,
    passed: warnings.length === 0,
    warnings,
    tags: [
      "house_style_audit",
      warnings.length === 0 ? "house_style_valid" : "house_style_warning",
      preference.archetype,
      preference.sourceBiome,
    ],
  }
}

export function getRequiredHouseArchetypes(): readonly HouseArchetype[] {
  return REQUIRED_ARCHETYPES
}

function auditRequiredFields(preference: HousePreference): string[] {
  const warnings: string[] = []

  if (!REQUIRED_ARCHETYPES.includes(preference.archetype)) {
    warnings.push(`Unsupported house archetype: ${preference.archetype}.`)
  }
  if (preference.personalityDrivers.length === 0) {
    warnings.push("HousePreference missing personality drivers.")
  }
  if (preference.resourceDrivers.length === 0) {
    warnings.push("HousePreference missing resource drivers.")
  }
  if (!preference.styleReason.trim()) {
    warnings.push("HousePreference missing styleReason.")
  }
  if (preference.styleTags.length === 0) {
    warnings.push("HousePreference missing styleTags.")
  }

  return warnings
}
