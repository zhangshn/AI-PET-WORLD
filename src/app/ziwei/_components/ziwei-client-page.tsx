"use client"

import { useMemo, useState } from "react"

import type {
  BranchPalace,
  ZiweiDynamicTabView,
  ZiweiPageViewModel
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { fetchZiweiFullChart } from "../_lib/ziwei-api-client"
import {
  BirthInputPanel,
  type ZiweiFormState
} from "./birth-input-panel"
import { ChartErrorPanel } from "./chart-error-panel"
import { DynamicFlowOverviewPanel } from "./dynamic-flow-overview-panel"
import { DebugJsonPanel } from "./debug-json-panel"
import { DynamicFlowTabs } from "./dynamic-flow-tabs"
import { InterpretationPanel } from "./interpretation-panel"
import { MiscStarPanel } from "./misc-star-panel"
import { PalaceDetailPanel } from "./palace-detail-panel"
import { PalaceOverviewPanel } from "./palace-overview-panel"
import { RuleSourceOverviewPanel } from "./rule-source-overview-panel"
import { SameNameStarPanel } from "./same-name-star-panel"
import { StarCategorySummaryPanel } from "./star-category-summary-panel"
import {
  StarCatalogTable,
  type StarCatalogCategoryFilter
} from "./star-catalog-table"
import { ZiweiChartGrid } from "./ziwei-chart-grid"

export function ZiweiClientPage(props: {
  initialForm: ZiweiFormState
  initialViewModel: ZiweiPageViewModel
}) {
  const [form, setForm] = useState(props.initialForm)
  const [viewModel, setViewModel] = useState(props.initialViewModel)
  const [selectedBranch, setSelectedBranch] = useState<BranchPalace>(
    props.initialViewModel.selectedPalace?.branch ?? "zi"
  )
  const [selectedFlowType, setSelectedFlowType] = useState(
    props.initialViewModel.dynamicTabs[0]?.type ?? "natal"
  )
  const [selectedStarCategory, setSelectedStarCategory] =
    useState<StarCatalogCategoryFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const selectedPalace = useMemo(() => {
    return viewModel.palaceDetails.find((palace) => {
      return palace.branch === selectedBranch
    }) ?? viewModel.selectedPalace
  }, [selectedBranch, viewModel])

  async function submit() {
    setLoading(true)
    setError(undefined)

    const response = await fetchZiweiFullChart({
      birthInput: {
        calendarType: "solar",
        year: form.year,
        month: form.month,
        day: form.day,
        hour: form.hour,
        minute: form.minute,
        gender: form.gender
      },
      dynamicInput: {
        currentAge: form.currentAge,
        currentYear: form.currentYear,
        currentLunarMonth: form.currentLunarMonth,
        currentLunarDay: form.currentLunarDay,
        currentTimeBranch: form.currentTimeBranch
      }
    })

    setLoading(false)

    if (!response.ok) {
      setError(response.message)
      return
    }

    setViewModel(response.data.viewModel)
    setSelectedBranch(
      response.data.viewModel.selectedPalace?.branch ?? selectedBranch
    )
    setSelectedFlowType(response.data.viewModel.dynamicTabs[0]?.type ?? "natal")
    setSelectedStarCategory("all")
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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.detailStack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>{viewModel.chartMeta.title}</h1>
            </div>
            <div className={styles.panelBody}>
              <p className={styles.metaText}>{viewModel.chartMeta.inputSummary}</p>
              <p className={styles.metaText}>{viewModel.chartMeta.ruleSetVersion}</p>
            </div>
          </section>
          <BirthInputPanel
            form={form}
            loading={loading}
            onChange={setForm}
            onSubmit={submit}
          />
          <ChartErrorPanel message={error} />
          <DynamicFlowTabs
            tabs={viewModel.dynamicTabs}
            dynamicDebug={viewModel.dynamicDebug}
            selectedType={selectedFlowType}
            onSelect={selectDynamicTab}
          />
          <DynamicFlowOverviewPanel
            flows={viewModel.dynamicFlowDetails}
            selectedType={selectedFlowType}
            onSelect={selectDynamicFlowDetail}
          />
        </aside>

        <section className={styles.detailStack}>
          <ZiweiChartGrid
            chartMeta={viewModel.chartMeta}
            palaces={viewModel.palaceGrid}
            selectedBranch={selectedBranch}
            totalStarCount={viewModel.starCatalogRows.length}
            onSelect={setSelectedBranch}
          />
          <PalaceOverviewPanel
            palaces={viewModel.palaceDetails}
            selectedBranch={selectedBranch}
            onSelect={setSelectedBranch}
          />
        </section>

        <aside className={styles.detailStack}>
          <PalaceDetailPanel palace={selectedPalace} />
          <InterpretationPanel
            interpretation={viewModel.interpretation}
            selectedBranch={selectedBranch}
          />
          <MiscStarPanel
            rows={viewModel.starCatalogRows}
            onOpenCatalog={() => setSelectedStarCategory("misc")}
          />
          <StarCategorySummaryPanel
            rows={viewModel.starCatalogRows}
            onSelectCategory={setSelectedStarCategory}
          />
          <RuleSourceOverviewPanel
            rows={viewModel.starCatalogRows}
            onSelectCategory={setSelectedStarCategory}
          />
          <SameNameStarPanel
            rows={viewModel.starCatalogRows}
            onSelectCategory={setSelectedStarCategory}
          />
          <StarCatalogTable
            rows={viewModel.starCatalogRows}
            selectedCategory={selectedStarCategory}
            onCategoryChange={setSelectedStarCategory}
          />
          <DebugJsonPanel value={viewModel.debugJson} />
        </aside>
      </div>
    </main>
  )
}
