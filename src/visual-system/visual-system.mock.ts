/**
 * 当前文件负责：提供紫微视觉变体系统的开发测试数据。
 */

import {
  buildVisualGenerationResult,
} from "./visual-variant-mapper"
import {
  ziweiVisualProfiles,
} from "./ziwei-visual-profiles"
import type {
  VisualGenerationResult,
  ZiweiVisualArchetype,
} from "./visual-dna.types"

const mockArchetypes: ZiweiVisualArchetype[] = [
  "structured_builder",
  "warm_caretaker",
  "protective_keeper",
  "aesthetic_organizer",
  "quiet_maintainer",
  "adaptive_planner",
]

export const mockVisualGenerationResults: VisualGenerationResult[] =
  mockArchetypes.map((archetype) =>
    buildVisualGenerationResult(ziweiVisualProfiles[archetype])
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
