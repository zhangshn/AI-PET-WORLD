"use client"

import { useMemo, useState } from "react"

import type {
  FullZiweiChart,
  FullZiweiDynamicChart
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

type DebugJsonTab = "summary" | "chart" | "dynamic"

interface ZiweiDebugJsonValue {
  chart?: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart | null
}

export function DebugJsonPanel(props: {
  value: unknown
}) {
  const [selectedTab, setSelectedTab] = useState<DebugJsonTab>("summary")
  const debugValue = toDebugJsonValue(props.value)
  const summary = useMemo(() => {
    return buildDebugSummary(debugValue)
  }, [debugValue])
  const selectedValue =
    selectedTab === "summary"
      ? summary
      : selectedTab === "chart"
        ? debugValue.chart ?? null
        : debugValue.dynamicChart ?? null

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>调试 JSON</h2>
        <p className={styles.metaText}>{getDebugTabLabel(selectedTab)}</p>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.debugTabs}>
          {(["summary", "chart", "dynamic"] as const).map((tab) => (
            <button
              className={`${styles.tab} ${selectedTab === tab ? styles.tabActive : ""}`}
              key={tab}
              type="button"
              onClick={() => setSelectedTab(tab)}
            >
              <span className={styles.tabLabel}>{getDebugTabLabel(tab)}</span>
              <span className={styles.tabMeta}>{getDebugTabMeta(tab, summary)}</span>
            </button>
          ))}
        </div>
        <pre className={styles.debug}>
          {JSON.stringify(selectedValue, null, 2)}
        </pre>
      </div>
    </section>
  )
}

function toDebugJsonValue(value: unknown): ZiweiDebugJsonValue {
  if (!value || typeof value !== "object") {
    return {}
  }

  return value as ZiweiDebugJsonValue
}

function buildDebugSummary(value: ZiweiDebugJsonValue) {
  const chart = value.chart
  const dynamicChart = value.dynamicChart

  return {
    ruleSetVersion: chart?.ruleSetVersion ?? null,
    palaceCount: chart?.palaces.length ?? 0,
    totalStarCount: chart?.summary.totalStarCount ?? 0,
    starCountsByCategory: chart?.summary.starCountsByCategory ?? {},
    lifePalace: chart?.summary.lifePalace ?? null,
    bodyPalace: chart?.summary.bodyPalace ?? null,
    placementWarningCount: chart?.debug.placementWarnings.length ?? 0,
    validationWarningCount: chart?.debug.validationWarnings.length ?? 0,
    dynamicFlowCount: dynamicChart?.flows.length ?? 0,
    activeDynamicFlowCount:
      dynamicChart?.flows.filter((flow) => flow.isActive).length ?? 0,
    dynamicDebug: dynamicChart?.debug ?? null
  }
}

function getDebugTabLabel(tab: DebugJsonTab): string {
  switch (tab) {
    case "summary":
      return "盘面摘要"
    case "chart":
      return "完整本命盘"
    case "dynamic":
      return "动态盘"
  }
}

function getDebugTabMeta(
  tab: DebugJsonTab,
  summary: ReturnType<typeof buildDebugSummary>
): string {
  switch (tab) {
    case "summary":
      return `${summary.totalStarCount} 颗星`
    case "chart":
      return `${summary.palaceCount} 宫`
    case "dynamic":
      return `${summary.activeDynamicFlowCount}/${summary.dynamicFlowCount} 启用`
  }
}
