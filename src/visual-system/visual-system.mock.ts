/**
 * 当前文件负责：提供紫微视觉变体系统的开发测试数据。
 */

import {
  mockPreferenceProfiles,
} from "../preference-system/preference.mock"
import {
  buildVisualDNAFromPreferenceProfile,
} from "./preference-to-visual-dna"
import {
  buildVisualGenerationResult,
} from "./visual-variant-mapper"
import type {
  VisualGenerationResult,
  ZiweiVisualArchetype,
} from "./visual-dna.types"

export const mockVisualGenerationResults: VisualGenerationResult[] =
  mockPreferenceProfiles.map((preference) =>
    buildVisualGenerationResult(
      buildVisualDNAFromPreferenceProfile(preference)
    )
  )

export const mockVisualArchetypeLabels: Record<
  ZiweiVisualArchetype,
  string
> = {
  structured_builder: "秩序建设型",
  warm_caretaker: "温暖照护型",
  protective_keeper: "边界守护型",
  aesthetic_organizer: "审美整理型",
  quiet_maintainer: "安静维护型",
  adaptive_planner: "适应规划型",
}
