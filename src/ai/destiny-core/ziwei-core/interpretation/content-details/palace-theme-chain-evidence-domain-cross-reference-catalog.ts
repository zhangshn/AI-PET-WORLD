import type {
  ZiweiContentDictionarySection,
  ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail,
  ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  ZiweiPalaceThemeChainEvidenceRelationDomain,
  ZiweiPalaceThemeChainEvidenceRelationRole
} from "./content-detail-types"
import { buildPalaceThemeRuleSourceReferences } from "./content-source-reference-map"
import { getAllPalaceThemeChainEvidenceFieldStandardContentDetails } from "./palace-theme-chain-evidence-field-standard-catalog"

interface EvidenceDomainProfile {
  evidenceDomain: ZiweiPalaceThemeChainEvidenceRelationDomain
  domainLabel: string
  purpose: string
  directFields: string[]
  supportFields: string[]
  suppressionFields: string[]
  reviewFields: string[]
}

const EVIDENCE_DOMAIN_PROFILES: EvidenceDomainProfile[] = [
  {
    evidenceDomain: "pattern",
    domainLabel: "格局证据域",
    purpose: "对照字段如何参与格局命中、破格、加吉、加煞和弱承接复核。",
    directFields: ["patternHitIds", "breakageIds", "repairEvidenceIds", "sourceRuleIds"],
    supportFields: ["evidencePalaces", "evidenceStars", "samePalaceStars", "oppositePalaceStars", "trineSquareStars", "brightness", "displayTier"],
    suppressionFields: ["reviewFlags"],
    reviewFields: ["ruleId", "thresholdId", "paragraphTemplateId"]
  },
  {
    evidenceDomain: "transformation",
    domainLabel: "四化证据域",
    purpose: "对照字段如何承接化禄、化权、化科、化忌、来源天干、目标星、目标宫和动态盘层。",
    directFields: ["transformationStarIds", "chartLayer", "dynamicFlowType", "sourceRuleIds"],
    supportFields: ["evidencePalaces", "evidenceStars", "brightness", "samePalaceStars", "oppositePalaceStars", "trineSquareStars", "repairEvidenceIds"],
    suppressionFields: ["breakageIds"],
    reviewFields: ["reviewFlags", "ruleId", "thresholdId"]
  },
  {
    evidenceDomain: "palaceRelation",
    domainLabel: "宫位关系证据域",
    purpose: "对照字段如何承接主宫、辅助宫、对宫、三方四正、同宫、夹宫和动态叠盘关系。",
    directFields: ["primaryPalace", "supportingPalaces", "palaceSequence", "evidencePalaces", "samePalaceStars", "oppositePalaceStars", "trineSquareStars", "sourceRuleIds"],
    supportFields: ["evidenceStars", "chartLayer", "dynamicFlowType", "displayTier", "patternHitIds", "transformationStarIds"],
    suppressionFields: ["breakageIds"],
    reviewFields: ["reviewFlags", "chainId", "templateId"]
  }
]

export const ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_DOMAIN_CROSS_REFERENCE_DETAILS: ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail[] =
  getAllPalaceThemeChainEvidenceFieldStandardContentDetails().flatMap((field) => {
    return EVIDENCE_DOMAIN_PROFILES.map((profile) => {
      return buildCrossReferenceDetail(field, profile)
    })
  })

export function getPalaceThemeChainEvidenceDomainCrossReferenceContentDetail(
  crossRefId: string
): ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail | null {
  return (
    ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_DOMAIN_CROSS_REFERENCE_DETAILS.find((detail) => {
      return detail.crossRefId === crossRefId
    }) ?? null
  )
}

export function getAllPalaceThemeChainEvidenceDomainCrossReferenceContentDetails(): ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail[] {
  return [...ZIWEI_PALACE_THEME_CHAIN_EVIDENCE_DOMAIN_CROSS_REFERENCE_DETAILS]
}

function buildCrossReferenceDetail(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile
): ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail {
  const relationRole = resolveRelationRole(field, profile)
  const sourceReferences = buildPalaceThemeRuleSourceReferences()
  const base = {
    crossRefId: `palace-theme-evidence-domain-cross-reference.${profile.evidenceDomain}.${field.fieldName}`,
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    fieldLabel: field.label,
    sourceReferences,
    fieldCategory: field.category,
    evidenceDomain: profile.evidenceDomain,
    domainLabel: profile.domainLabel,
    relationRole,
    evidenceUsage: buildEvidenceUsage(field, profile, relationRole),
    requiredEvidence: buildRequiredEvidence(field, profile, relationRole),
    excludedWhen: buildExcludedWhen(field, profile, relationRole),
    conflictTriggers: buildConflictTriggers(field, profile, relationRole),
    mergeRules: buildMergeRules(field, profile),
    displayRules: buildDisplayRules(field, profile, relationRole),
    sourceLineage: [
      field.fieldId,
      "palace-theme-chain-evidence-field-standard-catalog",
      `${profile.evidenceDomain}.dictionary`,
      "sourceRuleIds"
    ]
  }

  return {
    ...base,
    sections: buildSections(base, profile)
  }
}

function resolveRelationRole(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile
): ZiweiPalaceThemeChainEvidenceRelationRole {
  if (profile.directFields.includes(field.fieldName)) {
    return "direct"
  }

  if (profile.supportFields.includes(field.fieldName)) {
    return "support"
  }

  if (profile.suppressionFields.includes(field.fieldName)) {
    return "suppression"
  }

  if (profile.reviewFields.includes(field.fieldName)) {
    return "review"
  }

  return "context"
}

function buildEvidenceUsage(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile,
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
): string[] {
  return [
    `${field.label} 在 ${profile.domainLabel} 中承担 ${relationRole} 角色。`,
    profile.purpose,
    "该字段只能对照当前盘已经存在的证据，不把资料字典内容写成盘中结果。"
  ]
}

function buildRequiredEvidence(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile,
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
): string[] {
  const items = [
    `${field.label} 必须能回溯到 ${profile.domainLabel} 的来源字段或 sourceRuleIds。`,
    "字段值必须来自统一字段标准，不允许证据域临时补同名字段。"
  ]

  if (relationRole === "direct") {
    items.push(`${field.label} 是 ${profile.domainLabel} 的直接证据，缺失时不能输出该证据域结论。`)
  }

  if (relationRole === "support") {
    items.push(`${field.label} 只能作为 ${profile.domainLabel} 的辅助证据，不能单独打开结论。`)
  }

  return items
}

function buildExcludedWhen(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile,
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
): string[] {
  return [
    `${field.label} 无当前盘证据时，不进入 ${profile.domainLabel} 输出。`,
    "字段来源无法反查、盘层不一致或证据域不匹配时隐藏。",
    relationRole === "suppression"
      ? `${field.label} 命中时优先抑制泛化结论，转入受压或复核路径。`
      : `${field.label} 只有资料字典定义、没有盘中命中时不得展示。`
  ]
}

function buildConflictTriggers(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile,
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
): string[] {
  return [
    `${field.label} 与 ${profile.domainLabel} 的必要证据冲突时进入 reviewFlags。`,
    "字段值跨本命、大限、流年、流月、流日、流时互相覆盖时进入复核。",
    relationRole === "review"
      ? `${field.label} 命中时必须说明复核原因，不直接生成结论。`
      : `${field.label} 与 sourceRuleIds 不一致时隐藏结论并保留复核线索。`
  ]
}

function buildMergeRules(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile
): string[] {
  return [
    `${field.label} 在 ${profile.domainLabel} 中按 chartLayer 分组保存。`,
    "本命证据、大限证据和流层证据不互相覆盖，只追加层级来源。",
    "同一字段多来源时去重保留 sourceRuleIds，并把冲突写入 reviewFlags。"
  ]
}

function buildDisplayRules(
  field: ZiweiPalaceThemeChainEvidenceFieldStandardContentDetail,
  profile: EvidenceDomainProfile,
  relationRole: ZiweiPalaceThemeChainEvidenceRelationRole
): string[] {
  return [
    `${field.label} 只有在 ${profile.domainLabel} 有盘中命中时才显示。`,
    `展示时标注关系角色：${relationRole}。`,
    "未命中的格局、四化或宫位关系不得因为字段存在而展示。"
  ]
}

function buildSections(
  detail: Omit<
    ZiweiPalaceThemeChainEvidenceDomainCrossReferenceContentDetail,
    "sections"
  >,
  profile: EvidenceDomainProfile
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "对照定位",
      items: [
        `${detail.fieldLabel} 对照 ${detail.domainLabel}，关系角色为 ${detail.relationRole}。`,
        `证据域用途：${profile.purpose}`
      ]
    },
    {
      title: "证据用途",
      items: detail.evidenceUsage
    },
    {
      title: "必要证据",
      items: detail.requiredEvidence
    },
    {
      title: "排除条件",
      items: detail.excludedWhen
    },
    {
      title: "冲突复核",
      items: detail.conflictTriggers
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
