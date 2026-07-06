"use client"

import { useEffect, useMemo, useState } from "react"

import type {
  BranchPalace,
  ZiweiDynamicFlowType,
  ZiweiDynamicTabView,
  ZiweiPageViewModel
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { fetchZiweiFullChart } from "../_lib/ziwei-api-client"
import {
  ZIWEI_PAGE_MODULES,
  type ZiweiPageModuleId
} from "../_lib/ziwei-module-registry"
import {
  buildPatternFilterValues,
  type PatternFilterValue
} from "../_lib/ziwei-pattern-filter"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import { buildZiweiPatternPalaceSummary } from "../_lib/ziwei-pattern-palace-summary"
import {
  buildStarCatalogBrightnessFilterValues,
  type StarCatalogBrightnessFilter
} from "../_lib/ziwei-star-brightness-summary"
import {
  buildStarCatalogCategoryFilterValues,
  type StarCatalogCategoryFilter
} from "../_lib/ziwei-star-category-filter"
import {
  buildZiweiPageUrlSearch,
  readZiweiPageUrlState
} from "../_lib/ziwei-url-state"
import { buildZiweiViewShareSummary } from "../_lib/ziwei-view-share-summary"
import {
  BirthInputPanel,
  FlowTimePicker,
  type ZiweiFormState
} from "./birth-input-panel"
import { ChartErrorPanel } from "./chart-error-panel"
import { CollapsibleModule } from "./collapsible-module"
import { DynamicFlowOverviewPanel } from "./dynamic-flow-overview-panel"
import { DynamicFlowFocusPanel } from "./dynamic-flow-focus-panel"
import { DynamicFlowImpactPanel } from "./dynamic-flow-impact-panel"
import { DynamicFlowMatrixPanel } from "./dynamic-flow-matrix-panel"
import { DynamicFlowPriorityPanel } from "./dynamic-flow-priority-panel"
import { DebugJsonPanel } from "./debug-json-panel"
import { DynamicFlowTabs } from "./dynamic-flow-tabs"
import { InterpretationModal } from "./interpretation-modal"
import { MiscStarPanel } from "./misc-star-panel"
import { ModuleNavigationPanel } from "./module-navigation-panel"
import { PalaceBrightnessMatrixPanel } from "./palace-brightness-matrix-panel"
import { PalaceDensityPanel } from "./palace-density-panel"
import { PalaceDetailPanel } from "./palace-detail-panel"
import { PalaceOverviewPanel } from "./palace-overview-panel"
import { PalaceRelationMatrixPanel } from "./palace-relation-matrix-panel"
import { PatternConsistencyPanel } from "./pattern-consistency-panel"
import { PatternGapPanel } from "./pattern-gap-panel"
import { PatternOverviewPanel } from "./pattern-overview-panel"
import { PatternPalaceSummaryPanel } from "./pattern-palace-summary-panel"
import { PatternSourceIndexPanel } from "./pattern-source-index-panel"
import { PatternStatisticsPanel } from "./pattern-statistics-panel"
import { RuleSourceOverviewPanel } from "./rule-source-overview-panel"
import { SameNameStarPanel } from "./same-name-star-panel"
import { StarBrightnessSummaryPanel } from "./star-brightness-summary-panel"
import { StarCategorySummaryPanel } from "./star-category-summary-panel"
import { StarCatalogTable } from "./star-catalog-table"
import { StarDictionaryModal } from "./star-dictionary-modal"
import { ViewSharePanel } from "./view-share-panel"
import { ZiweiChartGrid } from "./ziwei-chart-grid"

export function ZiweiClientPage(props: {
  initialForm: ZiweiFormState
  initialSearchParams: Record<string, string>
  initialViewModel: ZiweiPageViewModel
}) {
  const initialUrlState = buildInitialUrlState({
    searchParams: props.initialSearchParams,
    viewModel: props.initialViewModel
  })
  const [form, setForm] = useState(props.initialForm)
  const [viewModel, setViewModel] = useState(props.initialViewModel)
  const [selectedBranch, setSelectedBranch] = useState<BranchPalace>(
    initialUrlState.selectedBranch
  )
  const [selectedFlowType, setSelectedFlowType] =
    useState<ZiweiDynamicFlowType>(initialUrlState.selectedFlowType)
  const [selectedStarCategory, setSelectedStarCategory] =
    useState<StarCatalogCategoryFilter>(initialUrlState.selectedStarCategory)
  const [selectedStarBrightness, setSelectedStarBrightness] =
    useState<StarCatalogBrightnessFilter>(initialUrlState.selectedStarBrightness)
  const [selectedPatternFilter, setSelectedPatternFilter] =
    useState<PatternFilterValue>(initialUrlState.selectedPatternFilter)
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<
    Set<ZiweiPageModuleId>
  >(initialUrlState.collapsedModuleIds)
  const [starDictionaryOpen, setStarDictionaryOpen] = useState(false)
  const [interpretationOpen, setInterpretationOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const selectedPalace = useMemo(() => {
    return viewModel.palaceDetails.find((palace) => {
      return palace.branch === selectedBranch
    }) ?? viewModel.selectedPalace
  }, [selectedBranch, viewModel])
  const selectedDynamicFlowDetail = useMemo(() => {
    return viewModel.dynamicFlowDetails.find((flow) => {
      return flow.type === selectedFlowType
    }) ?? viewModel.dynamicFlowDetails[0]
  }, [selectedFlowType, viewModel.dynamicFlowDetails])
  const patternPalaces = useMemo(() => {
    return buildCurrentFlowPatternPalaces({
      palaces: viewModel.palaceDetails,
      selectedFlow: selectedDynamicFlowDetail
    })
  }, [selectedDynamicFlowDetail, viewModel.palaceDetails])
  const patternPalaceSummary = useMemo(() => {
    return buildZiweiPatternPalaceSummary({
      palaces: patternPalaces,
      matches: buildZiweiPatternMatches(patternPalaces)
    })
  }, [patternPalaces])
  const viewShareSummary = useMemo(() => {
    return buildZiweiViewShareSummary({
      viewModel,
      selectedBranch,
      selectedFlowType,
      selectedStarCategory,
      selectedStarBrightness,
      selectedPatternFilter,
      collapsedModuleIds
    })
  }, [
    collapsedModuleIds,
    selectedBranch,
    selectedFlowType,
    selectedPatternFilter,
    selectedStarBrightness,
    selectedStarCategory,
    viewModel
  ])

  useEffect(() => {
    const nextSearch = buildZiweiPageUrlSearch({
      currentSearch: new URLSearchParams(window.location.search),
      selectedBranch,
      selectedFlowType,
      selectedStarCategory,
      selectedStarBrightness,
      selectedPatternFilter,
      collapsedModuleIds
    })
    const nextUrl = [
      window.location.pathname,
      nextSearch ? `?${nextSearch}` : "",
      window.location.hash
    ].join("")
    const currentUrl = [
      window.location.pathname,
      window.location.search,
      window.location.hash
    ].join("")

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl)
    }
  }, [
    collapsedModuleIds,
    selectedBranch,
    selectedFlowType,
    selectedPatternFilter,
    selectedStarCategory,
    selectedStarBrightness
  ])

  async function refreshZiweiChart(params: {
    nextForm: ZiweiFormState
    selectedFlowTypeAfterRefresh: ZiweiDynamicFlowType
    resetFilters?: boolean
  }) {
    setLoading(true)
    setError(undefined)

    const response = await fetchZiweiFullChart({
      birthInput: {
        calendarType: "solar",
        year: params.nextForm.year,
        month: params.nextForm.month,
        day: params.nextForm.day,
        hour: params.nextForm.hour,
        minute: params.nextForm.minute,
        gender: params.nextForm.gender
      },
      dynamicInput: {
        currentAge: params.nextForm.currentAge,
        currentYear: params.nextForm.currentYear,
        currentLunarMonth: params.nextForm.currentLunarMonth,
        currentLunarDay: params.nextForm.currentLunarDay,
        currentTimeBranch: params.nextForm.currentTimeBranch
      }
    })

    setLoading(false)

    if (!response.ok) {
      setError(response.message)
      return
    }

    setViewModel(response.data.viewModel)
    setForm(params.nextForm)
    setSelectedFlowType(params.selectedFlowTypeAfterRefresh)

    const refreshedFlow = response.data.viewModel.dynamicFlowDetails.find((flow) => {
      return flow.type === params.selectedFlowTypeAfterRefresh
    })

    setSelectedBranch(
      refreshedFlow?.palace ??
        response.data.viewModel.selectedPalace?.branch ??
        selectedBranch
    )

    if (params.resetFilters) {
      setSelectedStarCategory("all")
      setSelectedStarBrightness("all")
      setSelectedPatternFilter("all")
    }
  }

  async function submit() {
    await refreshZiweiChart({
      nextForm: form,
      selectedFlowTypeAfterRefresh: "natal",
      resetFilters: true
    })
  }

  async function commitFlowTime(
    nextForm: ZiweiFormState,
    flowType: ZiweiDynamicFlowType
  ) {
    await refreshZiweiChart({
      nextForm,
      selectedFlowTypeAfterRefresh: flowType
    })
  }

  function selectDynamicTab(tab: ZiweiDynamicTabView) {
    setSelectedFlowType(tab.type)
    setSelectedBranch(tab.palace)
  }

  function selectDynamicFlowDetail(
    flow: ZiweiPageViewModel["dynamicFlowDetails"][number]
  ) {
    setSelectedFlowType(flow.type)
    setSelectedBranch(flow.palace)
  }

  function selectFlowTypeFromTimePicker(flowType: ZiweiDynamicFlowType) {
    const flow = viewModel.dynamicFlowDetails.find((item) => {
      return item.type === flowType
    })

    setSelectedFlowType(flowType)
    setSelectedBranch(
      flow?.palace ??
        viewModel.selectedPalace?.branch ??
        selectedBranch
    )
  }

  function getModuleLabel(moduleId: ZiweiPageModuleId) {
    return ZIWEI_PAGE_MODULES.find((module) => module.id === moduleId)?.label ?? moduleId
  }

  function toggleModule(moduleId: ZiweiPageModuleId) {
    setCollapsedModuleIds((current) => {
      const next = new Set(current)

      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }

      return next
    })
  }

  function openModule(moduleId: ZiweiPageModuleId) {
    setCollapsedModuleIds((current) => {
      if (!current.has(moduleId)) {
        return current
      }

      const next = new Set(current)
      next.delete(moduleId)
      return next
    })

    window.requestAnimationFrame(() => {
      document
        .getElementById(`ziwei-module-${moduleId}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.detailStack}>
          <CollapsibleModule
            moduleId="chart-meta"
            title={getModuleLabel("chart-meta")}
            collapsed={collapsedModuleIds.has("chart-meta")}
            onToggle={toggleModule}
          >
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h1 className={styles.panelTitle}>{viewModel.chartMeta.title}</h1>
              </div>
              <div className={styles.panelBody}>
                <p className={styles.metaText}>{viewModel.chartMeta.inputSummary}</p>
                <p className={styles.metaText}>{viewModel.chartMeta.ruleSetVersion}</p>
              </div>
            </section>
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="birth-input"
            title={getModuleLabel("birth-input")}
            collapsed={collapsedModuleIds.has("birth-input")}
            onToggle={toggleModule}
          >
            <BirthInputPanel
              form={form}
              onChange={setForm}
            />
          </CollapsibleModule>
          <ChartErrorPanel message={error} />
          <CollapsibleModule
            moduleId="dynamic-tabs"
            title={getModuleLabel("dynamic-tabs")}
            collapsed={collapsedModuleIds.has("dynamic-tabs")}
            onToggle={toggleModule}
          >
            <DynamicFlowTabs
              tabs={viewModel.dynamicTabs}
              dynamicDebug={viewModel.dynamicDebug}
              selectedType={selectedFlowType}
              onSelect={selectDynamicTab}
            />
          </CollapsibleModule>
          <ModuleNavigationPanel
            modules={ZIWEI_PAGE_MODULES}
            collapsedModuleIds={collapsedModuleIds}
            onOpenModule={openModule}
            onToggleModule={toggleModule}
          />
          <CollapsibleModule
            moduleId="view-share"
            title={getModuleLabel("view-share")}
            collapsed={collapsedModuleIds.has("view-share")}
            onToggle={toggleModule}
          >
            <ViewSharePanel summaryItems={viewShareSummary} />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="dynamic-overview"
            title={getModuleLabel("dynamic-overview")}
            collapsed={collapsedModuleIds.has("dynamic-overview")}
            onToggle={toggleModule}
          >
            <DynamicFlowOverviewPanel
              flows={viewModel.dynamicFlowDetails}
              selectedType={selectedFlowType}
              onSelect={selectDynamicFlowDetail}
            />
          </CollapsibleModule>
        </aside>

        <section className={styles.detailStack}>
          <CollapsibleModule
            moduleId="chart-grid"
            title={getModuleLabel("chart-grid")}
            collapsed={collapsedModuleIds.has("chart-grid")}
            onToggle={toggleModule}
          >
            <ZiweiChartGrid
              chartMeta={viewModel.chartMeta}
              dynamicDebug={viewModel.dynamicDebug}
              dynamicFlows={viewModel.dynamicFlowDetails}
              palaces={viewModel.palaceGrid}
              palaceDetails={viewModel.palaceDetails}
              patternPalaceRows={patternPalaceSummary.rows}
              selectedBranch={selectedBranch}
              selectedFlowType={selectedFlowType}
              totalStarCount={viewModel.starCatalogRows.length}
              onSelect={setSelectedBranch}
              onOpenStarDictionary={() => setStarDictionaryOpen(true)}
              onOpenInterpretation={() => setInterpretationOpen(true)}
            />
            <div className={styles.chartFlowTimeBlock}>
              <FlowTimePicker
                form={form}
                dynamicDebug={viewModel.dynamicDebug}
                selectedFlowType={selectedFlowType}
                onChange={setForm}
                onCommitFlowTime={commitFlowTime}
                onSelectFlowType={selectFlowTypeFromTimePicker}
              />
              <button
                className={`${styles.button} ${styles.flowTimeSubmitButton}`}
                disabled={loading}
                type="button"
                onClick={submit}
              >
                {loading ? "排盘中" : "排盘"}
              </button>
            </div>
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="dynamic-focus"
            title={getModuleLabel("dynamic-focus")}
            collapsed={collapsedModuleIds.has("dynamic-focus")}
            onToggle={toggleModule}
          >
            <DynamicFlowFocusPanel
              flow={selectedDynamicFlowDetail}
              onSelectBranch={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="dynamic-matrix"
            title={getModuleLabel("dynamic-matrix")}
            collapsed={collapsedModuleIds.has("dynamic-matrix")}
            onToggle={toggleModule}
          >
            <DynamicFlowMatrixPanel
              flows={viewModel.dynamicFlowDetails}
              selectedType={selectedFlowType}
              onSelectFlow={selectDynamicFlowDetail}
              onSelectBranch={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="dynamic-impact"
            title={getModuleLabel("dynamic-impact")}
            collapsed={collapsedModuleIds.has("dynamic-impact")}
            onToggle={toggleModule}
          >
            <DynamicFlowImpactPanel
              flows={viewModel.dynamicFlowDetails}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="dynamic-priority"
            title={getModuleLabel("dynamic-priority")}
            collapsed={collapsedModuleIds.has("dynamic-priority")}
            onToggle={toggleModule}
          >
            <DynamicFlowPriorityPanel
              flows={viewModel.dynamicFlowDetails}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="palace-density"
            title={getModuleLabel("palace-density")}
            collapsed={collapsedModuleIds.has("palace-density")}
            onToggle={toggleModule}
          >
            <PalaceDensityPanel
              palaces={viewModel.palaceDetails}
              selectedBranch={selectedBranch}
              onSelect={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="brightness-matrix"
            title={getModuleLabel("brightness-matrix")}
            collapsed={collapsedModuleIds.has("brightness-matrix")}
            onToggle={toggleModule}
          >
            <PalaceBrightnessMatrixPanel
              palaces={viewModel.palaceDetails}
              selectedBranch={selectedBranch}
              selectedBrightness={selectedStarBrightness}
              onSelectBranch={setSelectedBranch}
              onSelectBrightness={setSelectedStarBrightness}
              onOpenCatalog={() => openModule("star-catalog")}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="relation-matrix"
            title={getModuleLabel("relation-matrix")}
            collapsed={collapsedModuleIds.has("relation-matrix")}
            onToggle={toggleModule}
          >
            <PalaceRelationMatrixPanel
              palaces={viewModel.palaceDetails}
              selectedBranch={selectedBranch}
              onSelect={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="palace-overview"
            title={getModuleLabel("palace-overview")}
            collapsed={collapsedModuleIds.has("palace-overview")}
            onToggle={toggleModule}
          >
            <PalaceOverviewPanel
              palaces={viewModel.palaceDetails}
              selectedBranch={selectedBranch}
              onSelect={setSelectedBranch}
            />
          </CollapsibleModule>
        </section>

        <aside className={styles.detailStack}>
          <CollapsibleModule
            moduleId="palace-detail"
            title={getModuleLabel("palace-detail")}
            collapsed={collapsedModuleIds.has("palace-detail")}
            onToggle={toggleModule}
          >
            <PalaceDetailPanel palace={selectedPalace} />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-overview"
            title={getModuleLabel("pattern-overview")}
            collapsed={collapsedModuleIds.has("pattern-overview")}
            onToggle={toggleModule}
          >
            <PatternOverviewPanel
              palaces={patternPalaces}
              scopeLabel={selectedDynamicFlowDetail.label}
              selectedFilter={selectedPatternFilter}
              onFilterChange={setSelectedPatternFilter}
              onOpenCatalog={() => openModule("star-catalog")}
              onSelectBranch={setSelectedBranch}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-palace-summary"
            title={getModuleLabel("pattern-palace-summary")}
            collapsed={collapsedModuleIds.has("pattern-palace-summary")}
            onToggle={toggleModule}
          >
            <PatternPalaceSummaryPanel
              palaces={patternPalaces}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onOpenPatternOverview={() => openModule("pattern-overview")}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-statistics"
            title={getModuleLabel("pattern-statistics")}
            collapsed={collapsedModuleIds.has("pattern-statistics")}
            onToggle={toggleModule}
          >
            <PatternStatisticsPanel
              palaces={patternPalaces}
              onSelectPatternFilter={(filter) => {
                setSelectedPatternFilter(filter)
                openModule("pattern-overview")
              }}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-gaps"
            title={getModuleLabel("pattern-gaps")}
            collapsed={collapsedModuleIds.has("pattern-gaps")}
            onToggle={toggleModule}
          >
            <PatternGapPanel
              palaces={patternPalaces}
              onSelectPatternFilter={(filter) => {
                setSelectedPatternFilter(filter)
                openModule("pattern-overview")
              }}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-source-index"
            title={getModuleLabel("pattern-source-index")}
            collapsed={collapsedModuleIds.has("pattern-source-index")}
            onToggle={toggleModule}
          >
            <PatternSourceIndexPanel palaces={patternPalaces} />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="pattern-consistency"
            title={getModuleLabel("pattern-consistency")}
            collapsed={collapsedModuleIds.has("pattern-consistency")}
            onToggle={toggleModule}
          >
            <PatternConsistencyPanel palaces={patternPalaces} />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="misc-stars"
            title={getModuleLabel("misc-stars")}
            collapsed={collapsedModuleIds.has("misc-stars")}
            onToggle={toggleModule}
          >
            <MiscStarPanel
              rows={viewModel.starCatalogRows}
              onOpenCatalog={() => {
                setSelectedStarCategory("misc")
                openModule("star-catalog")
              }}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="category-summary"
            title={getModuleLabel("category-summary")}
            collapsed={collapsedModuleIds.has("category-summary")}
            onToggle={toggleModule}
          >
            <StarCategorySummaryPanel
              rows={viewModel.starCatalogRows}
              onSelectCategory={setSelectedStarCategory}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="brightness-summary"
            title={getModuleLabel("brightness-summary")}
            collapsed={collapsedModuleIds.has("brightness-summary")}
            onToggle={toggleModule}
          >
            <StarBrightnessSummaryPanel
              rows={viewModel.starCatalogRows}
              selectedBrightness={selectedStarBrightness}
              onSelectBrightness={setSelectedStarBrightness}
              onOpenCatalog={() => openModule("star-catalog")}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="rule-source"
            title={getModuleLabel("rule-source")}
            collapsed={collapsedModuleIds.has("rule-source")}
            onToggle={toggleModule}
          >
            <RuleSourceOverviewPanel
              rows={viewModel.starCatalogRows}
              onSelectCategory={setSelectedStarCategory}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="same-name-stars"
            title={getModuleLabel("same-name-stars")}
            collapsed={collapsedModuleIds.has("same-name-stars")}
            onToggle={toggleModule}
          >
            <SameNameStarPanel
              rows={viewModel.starCatalogRows}
              onSelectCategory={setSelectedStarCategory}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="star-catalog"
            title={getModuleLabel("star-catalog")}
            collapsed={collapsedModuleIds.has("star-catalog")}
            onToggle={toggleModule}
          >
            <StarCatalogTable
              rows={viewModel.starCatalogRows}
              selectedCategory={selectedStarCategory}
              selectedBrightness={selectedStarBrightness}
              onCategoryChange={setSelectedStarCategory}
              onBrightnessChange={setSelectedStarBrightness}
            />
          </CollapsibleModule>
          <CollapsibleModule
            moduleId="debug-json"
            title={getModuleLabel("debug-json")}
            collapsed={collapsedModuleIds.has("debug-json")}
            onToggle={toggleModule}
          >
            <DebugJsonPanel value={viewModel.debugJson} />
          </CollapsibleModule>
        </aside>
      </div>
      <StarDictionaryModal
        entries={viewModel.starDictionaryEntries}
        open={starDictionaryOpen}
        onClose={() => setStarDictionaryOpen(false)}
      />
      <InterpretationModal
        interpretation={viewModel.interpretation}
        selectedBranch={selectedBranch}
        open={interpretationOpen}
        onClose={() => setInterpretationOpen(false)}
      />
    </main>
  )
}

function buildInitialUrlState(params: {
  searchParams: Record<string, string>
  viewModel: ZiweiPageViewModel
}): {
  selectedBranch: BranchPalace
  selectedFlowType: ZiweiDynamicFlowType
  selectedStarCategory: StarCatalogCategoryFilter
  selectedStarBrightness: StarCatalogBrightnessFilter
  selectedPatternFilter: PatternFilterValue
  collapsedModuleIds: Set<ZiweiPageModuleId>
} {
  const urlState = readZiweiPageUrlState(
    new URLSearchParams(params.searchParams),
    {
      branches: params.viewModel.palaceDetails.map((palace) => palace.branch),
      flowTypes: params.viewModel.dynamicTabs.map((tab) => tab.type),
      starCategories: buildStarCatalogCategoryFilterValues(
        params.viewModel.starCatalogRows
      ),
      starBrightnessLevels: buildStarCatalogBrightnessFilterValues(
        params.viewModel.starCatalogRows
      ),
      patternFilters: buildPatternFilterValues()
    }
  )
  const selectedFlowType = urlState.selectedFlowType ?? "natal"
  const selectedFlow = params.viewModel.dynamicFlowDetails.find((flow) => {
    return flow.type === selectedFlowType
  })
  const selectedBranch =
    urlState.selectedBranch ??
    selectedFlow?.palace ??
    params.viewModel.selectedPalace?.branch ??
    "zi"

  return {
    selectedBranch,
    selectedFlowType,
    selectedStarCategory: urlState.selectedStarCategory ?? "all",
    selectedStarBrightness: urlState.selectedStarBrightness ?? "all",
    selectedPatternFilter: urlState.selectedPatternFilter ?? "all",
    collapsedModuleIds: urlState.collapsedModuleIds
  }
}

function buildCurrentFlowPatternPalaces(params: {
  palaces: ZiweiPageViewModel["palaceDetails"]
  selectedFlow?: ZiweiPageViewModel["dynamicFlowDetails"][number]
}): ZiweiPageViewModel["palaceDetails"] {
  const lifeBranch =
    params.selectedFlow?.palace ??
    params.palaces.find((palace) => palace.isLifePalace)?.branch

  return params.palaces.map((palace) => {
    const isLifePalace = palace.branch === lifeBranch

    if (palace.isLifePalace === isLifePalace) {
      return palace
    }

    return {
      ...palace,
      isLifePalace
    }
  })
}
