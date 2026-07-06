import type { ZiweiContentSourceReference } from "./content-detail-types"
import {
  buildBranchDictionarySourceReferences,
  buildElementGateDictionarySourceReferences,
  buildPalaceDictionarySourceReferences,
  buildPalaceThemeChainSourceReferences,
  buildPalaceThemeRuleSourceReferences,
  buildPatternCombinationRelationSourceReferences,
  buildPatternDictionarySourceReferences,
  buildPeriodicStarPalaceCombinationSourceReferences,
  buildRelationshipStructureSourceReferences,
  buildStarDictionarySourceReferences,
  buildStarPairCombinationSourceReferences,
  buildStarPalaceCombinationSourceReferences,
  buildStemDictionarySourceReferences,
  buildTransformationTopicSourceReferences
} from "./content-source-reference-map"

export type ZiweiSourceReferenceLayerKind =
  | "dictionary"
  | "combination"
  | "relationship"
  | "theme-chain"
  | "theme-chain-rule"
  | "transformation"

export interface ZiweiSourceReferenceLayerIndexItem {
  layerId: string
  label: string
  layerKind: ZiweiSourceReferenceLayerKind
  recordKind: string
  recordCount: number
  sourceReferences: ZiweiContentSourceReference[]
  sourceIds: string[]
  theoryBoundary: string
  verificationEntry: string
  notes: string[]
}

function layer(
  input: Omit<ZiweiSourceReferenceLayerIndexItem, "sourceIds">
): ZiweiSourceReferenceLayerIndexItem {
  return {
    ...input,
    sourceIds: input.sourceReferences.map((reference) => reference.sourceId)
  }
}

const starDictionaryReferences = buildStarDictionarySourceReferences()
const patternDictionaryReferences = buildPatternDictionarySourceReferences()
const palaceDictionaryReferences = buildPalaceDictionarySourceReferences()
const palaceThemeChainReferences = buildPalaceThemeChainSourceReferences()
const palaceThemeRuleReferences = buildPalaceThemeRuleSourceReferences()
const branchDictionaryReferences = buildBranchDictionarySourceReferences()
const stemDictionaryReferences = buildStemDictionarySourceReferences()
const elementGateDictionaryReferences = buildElementGateDictionarySourceReferences()
const starPalaceCombinationReferences = buildStarPalaceCombinationSourceReferences()
const periodicStarPalaceCombinationReferences =
  buildPeriodicStarPalaceCombinationSourceReferences()
const starPairCombinationReferences = buildStarPairCombinationSourceReferences()
const patternCombinationRelationReferences =
  buildPatternCombinationRelationSourceReferences()
const relationshipStructureReferences = buildRelationshipStructureSourceReferences()
const transformationTopicReferences = buildTransformationTopicSourceReferences()

export const ZIWEI_SOURCE_REFERENCE_LAYER_INDEX: ZiweiSourceReferenceLayerIndexItem[] = [
  layer({
    layerId: "star.dictionary",
    label: "星曜字典",
    layerKind: "dictionary",
    recordKind: "star",
    recordCount: 103,
    sourceReferences: starDictionaryReferences,
    theoryBoundary: "解释星曜本体、分类、庙旺落陷边界和读盘顺序，不重写安星算法。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["覆盖主星、辅曜、煞曜、杂曜、四化和周期流系星曜。"]
  }),
  layer({
    layerId: "pattern.dictionary",
    label: "格局字典",
    layerKind: "dictionary",
    recordKind: "pattern",
    recordCount: 195,
    sourceReferences: patternDictionaryReferences,
    theoryBoundary: "解释格局语义、成格脉络、破格和复核边界，不重写格局命中条件。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["只展示盘中命中的格局，未命中资料只保留为字典。"]
  }),
  layer({
    layerId: "branch.dictionary",
    label: "十二地支字典",
    layerKind: "dictionary",
    recordKind: "branch",
    recordCount: 12,
    sourceReferences: branchDictionaryReferences,
    theoryBoundary: "解释地支、四马地、四败地、四墓库地和三合局空间象义，不重写排盘。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["地支资料只作为空间和关系结构底层。"]
  }),
  layer({
    layerId: "stem.dictionary",
    label: "十天干字典",
    layerKind: "dictionary",
    recordKind: "stem",
    recordCount: 10,
    sourceReferences: stemDictionaryReferences,
    theoryBoundary: "解释天干、阴阳五行和四化语境，不重复定义四化目标表。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["四化目标必须回到项目四化规则。"]
  }),
  layer({
    layerId: "element-gate.dictionary",
    label: "五行局字典",
    layerKind: "dictionary",
    recordKind: "element-gate",
    recordCount: 5,
    sourceReferences: elementGateDictionaryReferences,
    theoryBoundary: "解释五行局数、基础节律和大限背景，不重写紫微起星算法。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["五行局作为盘基资料，不直接生成当前盘断语。"]
  }),
  layer({
    layerId: "palace.dictionary",
    label: "十二宫位字典",
    layerKind: "dictionary",
    recordKind: "palace",
    recordCount: 12,
    sourceReferences: palaceDictionaryReferences,
    theoryBoundary: "解释宫位主题、问题域和动态盘用法，不重写命宫或宫位顺序算法。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["宫位资料承接页面和报告，不替代整盘综合分析。"]
  }),
  layer({
    layerId: "main-star.palace-combination",
    label: "主星入宫组合",
    layerKind: "combination",
    recordKind: "main-star-palace-combination",
    recordCount: 168,
    sourceReferences: starPalaceCombinationReferences,
    theoryBoundary: "解释主星进入十二宫的主题转换，不替代当前盘整体结论。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["14 主星乘以 12 宫。"]
  }),
  layer({
    layerId: "non-main-star.palace-combination",
    label: "辅煞杂入宫组合",
    layerKind: "combination",
    recordKind: "non-main-star-palace-combination",
    recordCount: 348,
    sourceReferences: starPalaceCombinationReferences,
    theoryBoundary: "解释辅曜、煞曜、杂曜进入宫位后的助力或压力，不强行补庙旺。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["8 辅曜、6 煞曜、15 杂曜乘以 12 宫。"]
  }),
  layer({
    layerId: "periodic-star.palace-combination",
    label: "周期流系星曜入宫组合",
    layerKind: "combination",
    recordKind: "periodic-star-palace-combination",
    recordCount: 672,
    sourceReferences: periodicStarPalaceCombinationReferences,
    theoryBoundary: "解释长生、博士、岁前、将前、月日时系星曜入宫，不把短周期写成长期断语。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["56 颗周期流系星曜乘以 12 宫。"]
  }),
  layer({
    layerId: "star-pair.combination",
    label: "星曜两两组合",
    layerKind: "combination",
    recordKind: "star-pair-combination",
    recordCount: 903,
    sourceReferences: starPairCombinationReferences,
    theoryBoundary: "解释固定星曜之间的协同、牵制和加压，不替代格局判定。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["43 颗固定星曜两两组合。"]
  }),
  layer({
    layerId: "pattern-combination.relation",
    label: "星曜组合与格局关系",
    layerKind: "relationship",
    recordKind: "pattern-combination-relation",
    recordCount: 80,
    sourceReferences: patternCombinationRelationReferences,
    theoryBoundary: "解释组合对格局的成格、加吉、加煞、破格和弱承接作用。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["10 类星曜组合分组乘以 8 类格局类别。"]
  }),
  layer({
    layerId: "relationship.structure",
    label: "关系结构",
    layerKind: "relationship",
    recordKind: "relationship-structure",
    recordCount: 10,
    sourceReferences: relationshipStructureReferences,
    theoryBoundary: "解释同宫、对宫、三方四正、夹宫、会照和动态叠盘关系，不重写宫位算法。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["用于证据组织和冲突复核。"]
  }),
  layer({
    layerId: "palace-theme.chain",
    label: "宫位主题链",
    layerKind: "theme-chain",
    recordKind: "palace-theme-chain",
    recordCount: 24,
    sourceReferences: palaceThemeChainReferences,
    theoryBoundary: "解释问题主题如何串联多个宫位、格局、四化和动态层，不生成当前盘结论。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["用于后续整盘解释的证据路径。"]
  }),
  layer({
    layerId: "palace-theme.synthesis-template",
    label: "主题链综合解释模板",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-synthesis-template",
    recordCount: 24,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定主题链综合段落的组织方式、证据顺序和降权边界。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["不直接输出当前盘断语。"]
  }),
  layer({
    layerId: "palace-theme.evidence-hit-rule",
    label: "主题链证据命中规则",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-hit-rule",
    recordCount: 24,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定强命中、弱命中、破格、修复和隐藏条件。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["命中规则必须回到当前盘证据和 sourceRuleIds。"]
  }),
  layer({
    layerId: "palace-theme.result-threshold",
    label: "主题链结果展示门槛",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-result-threshold",
    recordCount: 24,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定哪些结果可展示、哪些隐藏、哪些进入复核缺口。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["下级流层只能追加触发和降权说明。"]
  }),
  layer({
    layerId: "palace-theme.output-paragraph-template",
    label: "主题链输出段落模板",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-paragraph-template",
    recordCount: 24,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定总论段、证据段、受压段、修复段、动态盘段和复核缺口段。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["段落模板只组织资料，不替代页面排版。"]
  }),
  layer({
    layerId: "palace-theme.evidence-field-standard",
    label: "主题链证据字段标准",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-evidence-field",
    recordCount: 24,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定字段值结构、标准化、校验、合并、展示和隐藏规则。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["字段是后续分析和报告的共同契约。"]
  }),
  layer({
    layerId: "palace-theme.field-paragraph-matrix",
    label: "主题链字段段落复核矩阵",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-field-paragraph-matrix",
    recordCount: 144,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定字段在不同段落里的要求等级、隐藏条件和复核触发。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["24 个字段乘以 6 类段落。"]
  }),
  layer({
    layerId: "palace-theme.evidence-domain-cross-reference",
    label: "主题链证据域对照",
    layerKind: "theme-chain-rule",
    recordKind: "palace-theme-evidence-domain-cross-reference",
    recordCount: 72,
    sourceReferences: palaceThemeRuleReferences,
    theoryBoundary: "规定字段与格局、四化、宫位关系证据域之间的角色和冲突复核。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["24 个字段乘以 3 个证据域。"]
  }),
  layer({
    layerId: "transformation.topic",
    label: "四化专题",
    layerKind: "transformation",
    recordKind: "transformation-topic",
    recordCount: 20,
    sourceReferences: transformationTopicReferences,
    theoryBoundary: "解释化禄、化权、化科、化忌、天干触发和盘层来源，不重写四化目标表。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["四化自身不分庙旺，庙旺看目标星和目标宫。"]
  }),
  layer({
    layerId: "transformation.target-combination",
    label: "四化目标星组合",
    layerKind: "transformation",
    recordKind: "transformation-target",
    recordCount: 40,
    sourceReferences: transformationTopicReferences,
    theoryBoundary: "解释十干四化目标星组合、目标宫承接和动态盘层，不重复定义目标表。",
    verificationEntry: "check-content-knowledge-repository.mjs",
    notes: ["10 天干乘以 4 化。"]
  })
]

export const ZIWEI_SOURCE_REFERENCE_INDEX_TOTAL_RECORD_COUNT =
  ZIWEI_SOURCE_REFERENCE_LAYER_INDEX.reduce((total, item) => {
    return total + item.recordCount
  }, 0)

export function getAllZiweiSourceReferenceLayerIndexItems(): ZiweiSourceReferenceLayerIndexItem[] {
  return ZIWEI_SOURCE_REFERENCE_LAYER_INDEX
}

export function getZiweiSourceReferenceLayerIndexItem(
  layerId: string
): ZiweiSourceReferenceLayerIndexItem | undefined {
  return ZIWEI_SOURCE_REFERENCE_LAYER_INDEX.find((item) => {
    return item.layerId === layerId
  })
}
