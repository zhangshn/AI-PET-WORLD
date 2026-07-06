import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  ZiweiPalaceThemeChainFieldParagraphRequirementLevel,
  ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail,
  ZiweiPalaceThemeChainParagraphType
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainEvidenceFieldStandardContentDetails } from "./palace-theme-chain-evidence-field-standard-catalog"

interface ParagraphProfile {
  paragraphType: ZiweiPalaceThemeChainParagraphType
  paragraphLabel: string
  purpose: string
  coreFields: string[]
  conditionalFields: string[]
  hiddenFields: string[]
  reviewFields: string[]
}

const PARAGRAPH_PROFILES: ParagraphProfile[] = [
  {
    paragraphType: "summary",
    paragraphLabel: "总论段",
    purpose: "概括主题链当前可读结论，只能使用主宫、展示层级和可追溯来源，不展开未命中资料。",
    coreFields: ["chainId", "templateId", "thresholdId", "primaryPalace", "displayTier", "sourceRuleIds"],
    conditionalFields: ["evidencePalaces", "evidenceStars", "patternHitIds", "breakageIds", "repairEvidenceIds", "chartLayer"],
    hiddenFields: ["paragraphType"],
    reviewFields: ["reviewFlags"]
  },
  {
    paragraphType: "evidence",
    paragraphLabel: "证据段",
    purpose: "列出当前盘真实存在的宫位、星曜、亮度、四化、格局和来源证据。",
    coreFields: ["chainId", "ruleId", "primaryPalace", "evidencePalaces", "evidenceStars", "sourceRuleIds"],
    conditionalFields: ["samePalaceStars", "oppositePalaceStars", "trineSquareStars", "brightness", "transformationStarIds", "patternHitIds", "chartLayer"],
    hiddenFields: [],
    reviewFields: ["reviewFlags"]
  },
  {
    paragraphType: "pressure",
    paragraphLabel: "受压段",
    purpose: "只在煞忌、破格、空劫、落陷、来源冲突或承接不足存在时展示。",
    coreFields: ["chainId", "ruleId", "breakageIds", "sourceRuleIds"],
    conditionalFields: ["evidencePalaces", "evidenceStars", "brightness", "samePalaceStars", "oppositePalaceStars", "trineSquareStars", "chartLayer"],
    hiddenFields: ["repairEvidenceIds"],
    reviewFields: ["reviewFlags"]
  },
  {
    paragraphType: "repair",
    paragraphLabel: "修复段",
    purpose: "只在化科、化禄、辅曜、庙旺、三方四正补强或可承接证据存在时展示。",
    coreFields: ["chainId", "ruleId", "repairEvidenceIds", "sourceRuleIds"],
    conditionalFields: ["evidencePalaces", "evidenceStars", "brightness", "transformationStarIds", "samePalaceStars", "trineSquareStars", "chartLayer"],
    hiddenFields: ["breakageIds"],
    reviewFields: ["reviewFlags"]
  },
  {
    paragraphType: "dynamic",
    paragraphLabel: "动态盘段",
    purpose: "按本命、大限、流年、流月、流日、流时组织盘层继承和短周期触发。",
    coreFields: ["chainId", "chartLayer", "dynamicFlowType", "primaryPalace", "evidencePalaces", "sourceRuleIds"],
    conditionalFields: ["evidenceStars", "transformationStarIds", "patternHitIds", "breakageIds", "repairEvidenceIds", "displayTier"],
    hiddenFields: [],
    reviewFields: ["reviewFlags"]
  },
  {
    paragraphType: "review",
    paragraphLabel: "复核缺口段",
    purpose: "只在证据不足、来源冲突、层级冲突、字段缺失或高风险主题需要人工校验时展示。",
    coreFields: ["chainId", "reviewFlags", "sourceRuleIds"],
    conditionalFields: ["ruleId", "thresholdId", "chartLayer", "dynamicFlowType", "evidencePalaces", "evidenceStars", "breakageIds", "repairEvidenceIds"],
    hiddenFields: [],
    reviewFields: ["displayTier", "paragraphType"]
  }
]

export const ZIWEI_PALACE_THEME_CHAIN_FIELD_PARAGRAPH_REVIEW_MATRIX_DETAILS: ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail[] =
  getAllPalaceThemeChainEvidenceFieldStandardContentDetails().flatMap((field) => {
    return PARAGRAPH_PROFILES.map((profile) => {
      return buildMatrixDetail(field, profile)
    })
  })

export function getPalaceThemeChainFieldParagraphReviewMatrixContentDetail(
  matrixId: string
): ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_FIELD_PARAGRAPH_REVIEW_MATRIX_DETAILS.find((detail) => {
      return detail.matrixId === matrixId
    }) ?? null
  )
}

export function getAllPalaceThemeChainFieldParagraphReviewMatrixContentDetails(): ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_FIELD_PARAGRAPH_REVIEW_MATRIX_DETAILS]
}

function buildMatrixDetail(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile
): ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail {
  const requirementLevel = resolveRequirementLevel(field, profile)
  const sourceReferences = buildPalaceThemeRuleSourceReferences()
  const base = {
    matrixId: `palace-theme-field-paragraph-matrix.${profile.paragraphType}.${field.fieldName}`,
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    fieldLabel: field.label,
    sourceReferences,
    fieldCategory: field.category,
    paragraphType: profile.paragraphType,
    paragraphLabel: profile.paragraphLabel,
    requirementLevel,
    requiredWhen: buildRequiredWhen(field, profile, requirementLevel),
    optionalWhen: buildOptionalWhen(field, profile, requirementLevel),
    hiddenWhen: buildHiddenWhen(field, profile, requirementLevel),
    reviewTriggers: buildReviewTriggers(field, profile, requirementLevel),
    mergeRules: buildMergeRules(field, profile),
    displayRules: buildDisplayRules(field, profile, requirementLevel),
    sourceLineage: [
      field.fieldId,
      "palace-theme-chain-evidence-field-standard-catalog",
      "palace-theme-chain-output-paragraph-template-catalog",
      "sourceRuleIds"
    ]
  }

  return {
    ...base,
    sections: buildSections(base, profile)
  }
}

function resolveRequirementLevel(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile
): ZiweiPalaceThemeChainFieldParagraphRequirementLevel {
  if (profile.hiddenFields.includes(field.fieldName)) {
    return "hidden"
  }

  if (profile.coreFields.includes(field.fieldName)) {
    return "required"
  }

  if (profile.reviewFields.includes(field.fieldName)) {
    return "review"
  }

  if (profile.conditionalFields.includes(field.fieldName)) {
    return "conditional"
  }

  if (field.fieldName === "sourceRuleIds") {
    return "required"
  }

  if (field.category === "identity" && profile.paragraphType !== "review") {
    return "conditional"
  }

  return "optional"
}

function buildRequiredWhen(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile,
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
): string[] {
  const items = [
    `${profile.paragraphLabel}打开时必须先判断 ${field.label} 是否属于该段落的 ${requirementLevel} 字段。`,
    "字段只允许从统一字段标准资料读取，不允许段落模板临时定义同名字段。"
  ]

  if (requirementLevel === "required") {
    items.push(`${field.label} 是 ${profile.paragraphLabel} 的必需字段，缺失时该段落不得输出。`)
  }

  if (requirementLevel === "conditional") {
    items.push(`${field.label} 只在当前盘存在对应证据、动态层或来源链路时进入 ${profile.paragraphLabel}。`)
  }

  if (requirementLevel === "review") {
    items.push(`${field.label} 用于复核或冲突说明，命中时优先进入复核缺口。`)
  }

  return items
}

function buildOptionalWhen(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile,
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
): string[] {
  return [
    requirementLevel === "optional"
      ? `${field.label} 可以作为 ${profile.paragraphLabel} 的补充资料，但不得单独打开段落。`
      : `${field.label} 非可选时必须按 ${requirementLevel} 规则处理。`,
    "可选字段只能补充已经打开的段落，不能把资料字典内容伪装成盘中结果。",
    "可选字段展示前仍需保留 sourceRuleIds 或上游字段来源。"
  ]
}

function buildHiddenWhen(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile,
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
): string[] {
  return [
    requirementLevel === "hidden"
      ? `${field.label} 在 ${profile.paragraphLabel} 中默认隐藏，避免段落职责混乱。`
      : `${field.label} 缺少当前盘证据时在 ${profile.paragraphLabel} 中隐藏。`,
    "字段无法反查 sourceRuleIds 时隐藏对应结论。",
    "字段与当前 chartLayer 或 paragraphType 不一致时隐藏并进入复核。"
  ]
}

function buildReviewTriggers(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile,
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
): string[] {
  return [
    `${field.label} 缺失但 ${profile.paragraphLabel} 需要该字段时进入复核。`,
    `${field.label} 与字段标准、段落类型或展示层级冲突时进入复核。`,
    requirementLevel === "review"
      ? `${field.label} 命中时必须展示复核原因或人工校验入口。`
      : `${field.label} 只有泛化资料、没有当前盘证据时不得输出结论。`
  ]
}

function buildMergeRules(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile
): string[] {
  return [
    `${field.label} 在 ${profile.paragraphLabel} 中按本命、大限、流年、流月、流日、流时顺序合并。`,
    "下级动态层只能追加触发和降权说明，不能删除上级盘层证据。",
    "同一字段多来源时去重保留 sourceRuleIds，并把冲突来源写入 reviewFlags。"
  ]
}

function buildDisplayRules(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: ParagraphProfile,
  requirementLevel: ZiweiPalaceThemeChainFieldParagraphRequirementLevel
): string[] {
  return [
    `${profile.paragraphLabel} 的用途：${profile.purpose}`,
    `${field.label} 的展示等级为 ${requirementLevel}。`,
    "只有当前盘实际命中的字段值才允许展示；未命中资料只留在数据字典。"
  ]
}

function buildSections(
  detail: Omit<
    ZiweiPalaceThemeChainFieldParagraphReviewMatrixContentDetail,
    "sections"
  >,
  profile: ParagraphProfile
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "矩阵定位",
      items: [
        `${detail.fieldLabel} 在 ${detail.paragraphLabel} 中的要求等级为 ${detail.requirementLevel}。`,
        `段落用途：${profile.purpose}`
      ]
    },
    {
      title: "必需条件",
      items: detail.requiredWhen
    },
    {
      title: "可选条件",
      items: detail.optionalWhen
    },
    {
      title: "隐藏条件",
      items: detail.hiddenWhen
    },
    {
      title: "复核触发",
      items: detail.reviewTriggers
    },
    {
      title: "合并规则",
      items: detail.mergeRules
    },
    {
      title: "展示规则",
      items: detail.displayRules
    },
    {
      title: "来源链路",
      items: detail.sourceLineage
    }
  ]
}
