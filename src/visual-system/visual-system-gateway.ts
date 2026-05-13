/**
 * 当前文件负责：导出紫微视觉变体系统入口。
 */

export {
  buildVisualDNAFromPreferenceProfile,
} from "./preference-to-visual-dna"

export {
  buildPrefabVariantFromVisualDNA,
  buildSceneLayoutVariantFromVisualDNA,
  buildSpriteVariantFromVisualDNA,
  buildVisualGenerationResult,
} from "./visual-variant-mapper"

export { ziweiVisualProfiles } from "./ziwei-visual-profiles"

export type {
  PrefabVariant,
  SceneLayoutVariant,
  SpriteVariant,
  VisualDNA,
  VisualGenerationResult,
  ZiweiVisualArchetype,
} from "./visual-dna.types"
