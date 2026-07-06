import type {
  BranchPalace,
  ZiweiDynamicFlowType
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  buildDefaultCollapsedModuleIds,
  ZIWEI_PAGE_MODULES,
  type ZiweiPageModuleId
} from "./ziwei-module-registry"
import type { PatternFilterValue } from "./ziwei-pattern-filter"
import type { StarCatalogBrightnessFilter } from "./ziwei-star-brightness-summary"
import type { StarCatalogCategoryFilter } from "./ziwei-star-category-filter"

export const ZIWEI_PAGE_URL_QUERY_KEYS = {
  palace: "palace",
  flow: "flow",
  category: "category",
  brightness: "brightness",
  pattern: "pattern",
  openModules: "open",
  closedModules: "closed"
} as const

export interface ZiweiPageUrlStateContext {
  branches: readonly BranchPalace[]
  flowTypes: readonly ZiweiDynamicFlowType[]
  starCategories: readonly StarCatalogCategoryFilter[]
  starBrightnessLevels: readonly StarCatalogBrightnessFilter[]
  patternFilters: readonly PatternFilterValue[]
}

export interface ZiweiPageUrlState {
  selectedBranch?: BranchPalace
  selectedFlowType?: ZiweiDynamicFlowType
  selectedStarCategory?: StarCatalogCategoryFilter
  selectedStarBrightness?: StarCatalogBrightnessFilter
  selectedPatternFilter?: PatternFilterValue
  collapsedModuleIds: Set<ZiweiPageModuleId>
}

export function readZiweiPageUrlState(
  searchParams: URLSearchParams,
  context: ZiweiPageUrlStateContext
): ZiweiPageUrlState {
  return {
    selectedBranch: pickAllowedValue(
      searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.palace),
      context.branches
    ),
    selectedFlowType: pickAllowedValue(
      searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.flow),
      context.flowTypes
    ),
    selectedStarCategory: pickAllowedValue(
      searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.category),
      context.starCategories
    ),
    selectedStarBrightness: pickAllowedValue(
      searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.brightness),
      context.starBrightnessLevels
    ),
    selectedPatternFilter: pickAllowedValue(
      searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.pattern),
      context.patternFilters
    ),
    collapsedModuleIds: readCollapsedModuleIds(searchParams)
  }
}

export function buildZiweiPageUrlSearch(params: {
  currentSearch: URLSearchParams
  selectedBranch: BranchPalace
  selectedFlowType: ZiweiDynamicFlowType
  selectedStarCategory: StarCatalogCategoryFilter
  selectedStarBrightness: StarCatalogBrightnessFilter
  selectedPatternFilter: PatternFilterValue
  collapsedModuleIds: ReadonlySet<ZiweiPageModuleId>
}): string {
  const nextSearch = new URLSearchParams(params.currentSearch)
  const defaultCollapsedModuleIds = buildDefaultCollapsedModuleIds()
  const openModuleIds: ZiweiPageModuleId[] = []
  const closedModuleIds: ZiweiPageModuleId[] = []

  ZIWEI_PAGE_MODULES.forEach((module) => {
    const moduleId = module.id as ZiweiPageModuleId
    const collapsed = params.collapsedModuleIds.has(moduleId)
    const defaultCollapsed = defaultCollapsedModuleIds.has(moduleId)

    if (defaultCollapsed && !collapsed) {
      openModuleIds.push(moduleId)
    }

    if (!defaultCollapsed && collapsed) {
      closedModuleIds.push(moduleId)
    }
  })

  nextSearch.set(ZIWEI_PAGE_URL_QUERY_KEYS.palace, params.selectedBranch)
  nextSearch.set(ZIWEI_PAGE_URL_QUERY_KEYS.flow, params.selectedFlowType)

  if (params.selectedStarCategory === "all") {
    nextSearch.delete(ZIWEI_PAGE_URL_QUERY_KEYS.category)
  } else {
    nextSearch.set(
      ZIWEI_PAGE_URL_QUERY_KEYS.category,
      params.selectedStarCategory
    )
  }

  if (params.selectedStarBrightness === "all") {
    nextSearch.delete(ZIWEI_PAGE_URL_QUERY_KEYS.brightness)
  } else {
    nextSearch.set(
      ZIWEI_PAGE_URL_QUERY_KEYS.brightness,
      params.selectedStarBrightness
    )
  }

  if (params.selectedPatternFilter === "all") {
    nextSearch.delete(ZIWEI_PAGE_URL_QUERY_KEYS.pattern)
  } else {
    nextSearch.set(
      ZIWEI_PAGE_URL_QUERY_KEYS.pattern,
      params.selectedPatternFilter
    )
  }

  writeCsvParam(
    nextSearch,
    ZIWEI_PAGE_URL_QUERY_KEYS.openModules,
    openModuleIds
  )
  writeCsvParam(
    nextSearch,
    ZIWEI_PAGE_URL_QUERY_KEYS.closedModules,
    closedModuleIds
  )

  return nextSearch.toString()
}

function readCollapsedModuleIds(
  searchParams: URLSearchParams
): Set<ZiweiPageModuleId> {
  const collapsedModuleIds = buildDefaultCollapsedModuleIds()
  const moduleIds = ZIWEI_PAGE_MODULES.map((module) => {
    return module.id as ZiweiPageModuleId
  })
  const openModuleIds = parseCsvParam(
    searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.openModules)
  )
  const closedModuleIds = parseCsvParam(
    searchParams.get(ZIWEI_PAGE_URL_QUERY_KEYS.closedModules)
  )

  openModuleIds.forEach((moduleId) => {
    const allowedModuleId = pickAllowedValue(moduleId, moduleIds)

    if (allowedModuleId) {
      collapsedModuleIds.delete(allowedModuleId)
    }
  })

  closedModuleIds.forEach((moduleId) => {
    const allowedModuleId = pickAllowedValue(moduleId, moduleIds)

    if (allowedModuleId) {
      collapsedModuleIds.add(allowedModuleId)
    }
  })

  return collapsedModuleIds
}

function pickAllowedValue<Value extends string>(
  value: string | null,
  allowedValues: readonly Value[]
): Value | undefined {
  if (!value) {
    return undefined
  }

  return allowedValues.includes(value as Value) ? (value as Value) : undefined
}

function parseCsvParam(value: string | null): string[] {
  if (!value) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function writeCsvParam(
  searchParams: URLSearchParams,
  key: string,
  values: string[]
) {
  if (values.length === 0) {
    searchParams.delete(key)
    return
  }

  searchParams.set(key, values.join(","))
}
