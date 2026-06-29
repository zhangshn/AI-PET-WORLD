import type { ZiweiStarCategory } from "../contracts"

export interface ZiweiStarCategoryInterpretationProfile {
  category: Exclude<ZiweiStarCategory, "empty">
  summary: string
  tags: string[]
}

export const STAR_CATEGORY_INTERPRETATION_PROFILES: Record<
  Exclude<ZiweiStarCategory, "empty">,
  ZiweiStarCategoryInterpretationProfile
> = {
  main: {
    category: "main",
    summary: "主星用于观察宫位的核心气质和主要驱动力。",
    tags: ["核心", "主轴", "气质"]
  },
  assistant: {
    category: "assistant",
    summary: "辅曜用于补充助力、资源、才华和协作条件。",
    tags: ["助力", "资源", "协作"]
  },
  malefic: {
    category: "malefic",
    summary: "煞曜用于提示压力、冲突、风险和需要主动处理的议题。",
    tags: ["压力", "风险", "变化"]
  },
  transformation: {
    category: "transformation",
    summary: "四化用于观察该宫位在动态变化中的触发点。",
    tags: ["四化", "触发", "变化"]
  },
  misc: {
    category: "misc",
    summary: "杂曜用于补充细节，不单独覆盖主星和宫位主轴。",
    tags: ["细节", "辅助判断", "杂曜"]
  },
  lifecycle: {
    category: "lifecycle",
    summary: "长生十二神用于观察状态节律和阶段性气势。",
    tags: ["状态", "节律", "阶段"]
  },
  yearly: {
    category: "yearly",
    summary: "年系星曜用于补充流年系统的年度触发信息。",
    tags: ["年系", "年度", "触发"]
  },
  monthly: {
    category: "monthly",
    summary: "月系星曜用于补充月令相关的短周期信息。",
    tags: ["月系", "短周期", "补充"]
  },
  dailyHourly: {
    category: "dailyHourly",
    summary: "日时系星曜用于补充日时层面的细节提示。",
    tags: ["日时", "细节", "短周期"]
  }
}

export function getStarCategoryInterpretationProfile(
  category: Exclude<ZiweiStarCategory, "empty">
): ZiweiStarCategoryInterpretationProfile {
  return STAR_CATEGORY_INTERPRETATION_PROFILES[category]
}
