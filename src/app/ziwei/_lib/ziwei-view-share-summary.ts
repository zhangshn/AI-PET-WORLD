import type {
  BranchPalace,
  ZiweiDynamicFlowType,
  ZiweiPageViewModel
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  buildDefaultCollapsedModuleIds,
  ZIWEI_PAGE_MODULES,
  type ZiweiPageModuleId
} from "./ziwei-module-registry"
import {
  getStarBrightnessFilterLabel,
  type StarCatalogBrightnessFilter
} from "./ziwei-star-brightness-summary"
import {
  getPatternFilterLabel,
  type PatternFilterValue
} from "./ziwei-pattern-filter"
import type { StarCatalogCategoryFilter } from "./ziwei-star-category-filter"

export interface ZiweiViewShareSummaryItem {
  key: string
  label: string
  value: string
}

export function buildZiweiViewShareSummary(params: {
  viewModel: ZiweiPageViewModel
  selectedBranch: BranchPalace
  selectedFlowType: ZiweiDynamicFlowType
  selectedStarCategory: StarCatalogCategoryFilter
  selectedStarBrightness: StarCatalogBrightnessFilter
  selectedPatternFilter: PatternFilterValue
  collapsedModuleIds: ReadonlySet<ZiweiPageModuleId>
}): ZiweiViewShareSummaryItem[] {
  const palace = params.viewModel.palaceDetails.find((item) => {
    return item.branch === params.selectedBranch
  })
  const dynamicFlow = params.viewModel.dynamicTabs.find((tab) => {
    return tab.type === params.selectedFlowType
  })
  const defaultCollapsedModuleIds = buildDefaultCollapsedModuleIds()
  const openedModuleLabels: string[] = []
  const closedModuleLabels: string[] = []

  ZIWEI_PAGE_MODULES.forEach((module) => {
    const moduleId = module.id as ZiweiPageModuleId
    const collapsed = params.collapsedModuleIds.has(moduleId)
    const defaultCollapsed = defaultCollapsedModuleIds.has(moduleId)

    if (defaultCollapsed && !collapsed) {
      openedModuleLabels.push(module.label)
    }

    if (!defaultCollapsed && collapsed) {
      closedModuleLabels.push(module.label)
    }
  })

  return [
    {
      key: "palace",
      label: "当前宫位",
      value: palace
        ? `${palace.sectorLabel} · ${palace.branchLabel}`
        : params.selectedBranch
    },
    {
      key: "flow",
      label: "动态流",
      value: dynamicFlow
        ? `${dynamicFlow.label} · ${dynamicFlow.palaceLabel}`
        : params.selectedFlowType
    },
    {
      key: "category",
      label: "星曜筛选",
      value: getCategoryLabel({
        viewModel: params.viewModel,
        selectedStarCategory: params.selectedStarCategory
      })
    },
    {
      key: "brightness",
      label: "庙旺筛选",
      value: getStarBrightnessFilterLabel(params.selectedStarBrightness)
    },
    {
      key: "pattern",
      label: "格局筛选",
      value: getPatternFilterLabel(params.selectedPatternFilter)
    },
    {
      key: "open",
      label: "额外展开",
      value: formatModuleLabels(openedModuleLabels)
    },
    {
      key: "closed",
      label: "额外折叠",
      value: formatModuleLabels(closedModuleLabels)
    }
  ]
}

function getCategoryLabel(params: {
  viewModel: ZiweiPageViewModel
  selectedStarCategory: StarCatalogCategoryFilter
}): string {
  if (params.selectedStarCategory === "all") {
    return "全部分类"
  }

  return params.viewModel.starCatalogRows.find((row) => {
    return row.category === params.selectedStarCategory
  })?.categoryLabel ?? params.selectedStarCategory
}

function formatModuleLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join(" / ") : "无"
}
