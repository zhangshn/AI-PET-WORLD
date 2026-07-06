import {
  ZIWEI_PATTERN_DEFINITIONS,
  type ZiweiPatternDefinition,
  type ZiweiPatternMatchView
} from "./ziwei-pattern-catalog"

export interface ZiweiPatternSourceIndexRow {
  patternId: string
  label: string
  categoryLabel: string
  matchMethodLabel: string
  conditionText: string
  starLabels: string[]
  statusLabel: string
  calibrationStatus: string
  sourceRuleIds: string[]
  scopeLabel: string
}

const MATCH_METHOD_LABELS: Record<
  ZiweiPatternDefinition["match"]["type"],
  string
> = {
  "life-scope-all": "命宫三方四正全会",
  "life-scope-all-with-brightness": "命宫三方四正且亮度达标",
  "life-scope-at-least": "命宫三方四正数量达标",
  "same-palace-all": "指定星曜同宫",
  "same-palace-all-in-branches": "指定地支同宫",
  "life-branch-with-stars": "命宫指定地支守星",
  "life-branch-with-scope-stars": "命宫地支、守星与会照星",
  "life-stars-with-scope-at-least": "命宫守星与会照数量",
  "life-stars-with-adjacent-star-sets": "命宫守星与左右夹星",
  "star-branches": "星曜指定地支",
  "life-adjacent-pair": "左右邻宫夹命",
  pending: "待补判定"
}

export function buildZiweiPatternSourceIndex(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternSourceIndexRow[] {
  const matchesById = new Map(matches.map((match) => [match.id, match]))

  return ZIWEI_PATTERN_DEFINITIONS.map((definition) => {
    const match = matchesById.get(definition.id)

    return {
      patternId: definition.id,
      label: definition.label,
      categoryLabel: match?.categoryLabel ?? definition.category,
      matchMethodLabel: MATCH_METHOD_LABELS[definition.match.type],
      conditionText: definition.conditionText,
      starLabels:
        match && match.starLabels.length > 0
          ? match.starLabels
          : [...definition.starIds],
      statusLabel: match?.strengthLabel ?? "待人工复核",
      calibrationStatus: buildCalibrationStatus(definition, match),
      sourceRuleIds: match?.sourceRuleIds ?? [],
      scopeLabel: buildScopeLabel(definition)
    }
  })
}

function buildCalibrationStatus(
  definition: ZiweiPatternDefinition,
  match: ZiweiPatternMatchView | undefined
): string {
  if (definition.match.type === "pending") {
    return "待补正式条件"
  }

  if (!match) {
    return "待接入盘面结果"
  }

  if (definition.category === "adverse" || definition.category === "malefic") {
    return "已接入判定，需持续样例校准不利结构"
  }

  if (match.status === "hit") {
    return "已接入判定，当前样例可命中"
  }

  return "已接入判定，当前样例未成格"
}

function buildScopeLabel(definition: ZiweiPatternDefinition): string {
  const match = definition.match

  if (
    match.type === "life-scope-all" ||
    match.type === "life-scope-all-with-brightness" ||
    match.type === "life-scope-at-least"
  ) {
    return "命宫三方四正"
  }

  if (match.type === "same-palace-all") {
    return "同宫"
  }

  if (match.type === "same-palace-all-in-branches") {
    return `同宫：${match.branches.join(" / ")}`
  }

  if (match.type === "life-branch-with-stars") {
    return `命宫：${match.branch}`
  }

  if (
    match.type === "life-branch-with-scope-stars" ||
    match.type === "life-stars-with-scope-at-least"
  ) {
    return match.branches ? `命宫：${match.branches.join(" / ")}` : "命宫范围"
  }

  if (match.type === "life-stars-with-adjacent-star-sets") {
    return "命宫与左右邻宫"
  }

  if (match.type === "star-branches") {
    return "指定星曜地支"
  }

  if (match.type === "life-adjacent-pair") {
    return "命宫左右邻宫"
  }

  return "待校准"
}
