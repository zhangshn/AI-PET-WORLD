/**
 * 当前文件负责：导出紫微视觉变体系统入口。
 */

export {
  buildVisualDNAFromPreferenceProfile,
} from "./preference-to-visual-dna"

export {
  buildVisualGenerationResultFromZiweiProbability,
  buildZiweiDrivenVisualGenerationResult,
} from "./ziwei-to-visual-generation"

export {
  buildPrefabVariantFromVisualDNA,
  buildSceneLayoutVariantFromVisualDNA,
  buildSpriteVariantFromVisualDNA,
  buildVisualGenerationResult,
} from "./visual-variant-mapper"

export { ziweiVisualProfiles } from "./ziwei-visual-profiles"

export type {
  ZiweiDrivenVisualGenerationResult,
} from "./ziwei-to-visual-generation"

export type {
  PrefabVariant,
  SceneLayoutVariant,
  SpriteVariant,
  VisualDNA,
  VisualGenerationResult,
  VisualSource,
  ZiweiVisualArchetype,
} from "./visual-dna.types"
