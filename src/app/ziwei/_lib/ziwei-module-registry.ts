export type ZiweiPageModuleColumn = "left" | "center" | "right"

export interface ZiweiPageModuleDefinition {
  id: string
  label: string
  column: ZiweiPageModuleColumn
  defaultCollapsed: boolean
}

export const ZIWEI_PAGE_MODULES = [
  {
    id: "chart-meta",
    label: "盘面摘要",
    column: "left",
    defaultCollapsed: false
  },
  {
    id: "view-share",
    label: "当前视图链接",
    column: "left",
    defaultCollapsed: true
  },
  {
    id: "birth-input",
    label: "排盘输入",
    column: "left",
    defaultCollapsed: false
  },
  {
    id: "dynamic-tabs",
    label: "动态流",
    column: "left",
    defaultCollapsed: false
  },
  {
    id: "dynamic-overview",
    label: "动态流完整明细",
    column: "left",
    defaultCollapsed: true
  },
  {
    id: "chart-grid",
    label: "十二宫盘",
    column: "center",
    defaultCollapsed: false
  },
  {
    id: "dynamic-focus",
    label: "当前流动盘",
    column: "center",
    defaultCollapsed: false
  },
  {
    id: "dynamic-matrix",
    label: "流动盘总览矩阵",
    column: "center",
    defaultCollapsed: false
  },
  {
    id: "dynamic-impact",
    label: "流动盘叠加影响",
    column: "center",
    defaultCollapsed: false
  },
  {
    id: "dynamic-priority",
    label: "流动盘重点宫位",
    column: "center",
    defaultCollapsed: false
  },
  {
    id: "palace-density",
    label: "宫位星曜密度",
    column: "center",
    defaultCollapsed: true
  },
  {
    id: "brightness-matrix",
    label: "庙旺落陷分布矩阵",
    column: "center",
    defaultCollapsed: true
  },
  {
    id: "relation-matrix",
    label: "三方四正关系矩阵",
    column: "center",
    defaultCollapsed: true
  },
  {
    id: "palace-overview",
    label: "十二宫完整明细",
    column: "center",
    defaultCollapsed: true
  },
  {
    id: "palace-detail",
    label: "宫位详情",
    column: "right",
    defaultCollapsed: false
  },
  {
    id: "pattern-overview",
    label: "盘中格局结果",
    column: "right",
    defaultCollapsed: false
  },
  {
    id: "pattern-palace-summary",
    label: "格局宫位聚合",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "pattern-statistics",
    label: "格局统计",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "pattern-gaps",
    label: "格局缺口校准",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "pattern-source-index",
    label: "格局来源索引",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "pattern-consistency",
    label: "格局一致性校准",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "misc-stars",
    label: "杂曜专项总览",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "category-summary",
    label: "星曜分类统计",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "brightness-summary",
    label: "庙旺落陷汇总",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "rule-source",
    label: "规则来源总览",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "same-name-stars",
    label: "同名星曜校准",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "star-catalog",
    label: "星曜总表",
    column: "right",
    defaultCollapsed: true
  },
  {
    id: "debug-json",
    label: "调试 JSON",
    column: "right",
    defaultCollapsed: true
  }
] as const satisfies readonly ZiweiPageModuleDefinition[]

export type ZiweiPageModuleId = typeof ZIWEI_PAGE_MODULES[number]["id"]

export function buildDefaultCollapsedModuleIds(): Set<ZiweiPageModuleId> {
  return new Set(
    ZIWEI_PAGE_MODULES
      .filter((module) => module.defaultCollapsed)
      .map((module) => module.id)
  )
}
