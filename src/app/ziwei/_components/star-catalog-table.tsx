"use client"

import { useMemo, useState } from "react"

import type {
  ZiweiStarCatalogRowView,
  ZiweiStarCategory
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

export type StarCatalogCategoryFilter = ZiweiStarCategory | "all"

export function StarCatalogTable(props: {
  rows: ZiweiStarCatalogRowView[]
  selectedCategory: StarCatalogCategoryFilter
  onCategoryChange: (category: StarCatalogCategoryFilter) => void
}) {
  const [selectedPalace, setSelectedPalace] = useState("all")
  const [query, setQuery] = useState("")
  const categoryOptions = useMemo(() => {
    return buildCategoryOptions(props.rows)
  }, [props.rows])
  const palaceOptions = useMemo(() => {
    return buildPalaceOptions(props.rows)
  }, [props.rows])
  const visibleRows = useMemo(() => {
    return filterRows({
      rows: props.rows,
      category: props.selectedCategory,
      palaceKey: selectedPalace,
      query
    })
  }, [props.rows, props.selectedCategory, selectedPalace, query])
  const hasActiveFilter =
    props.selectedCategory !== "all" ||
    selectedPalace !== "all" ||
    query.trim().length > 0

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>星曜总表</h2>
        <p className={styles.metaText}>
          {visibleRows.length} / {props.rows.length} 项
        </p>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.tableFilters}>
          <label className={styles.field}>
            <span className={styles.label}>分类</span>
            <select
              className={styles.select}
              value={props.selectedCategory}
              onChange={(event) => {
                props.onCategoryChange(event.target.value as StarCatalogCategoryFilter)
              }}
            >
              <option value="all">全部分类</option>
              {categoryOptions.map((option) => (
                <option key={option.category} value={option.category}>
                  {option.label}（{option.count}）
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>落宫</span>
            <select
              className={styles.select}
              value={selectedPalace}
              onChange={(event) => setSelectedPalace(event.target.value)}
            >
              <option value="all">全部宫位</option>
              {palaceOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}（{option.count}）
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>星曜 / 规则</span>
            <input
              className={styles.input}
              value={query}
              placeholder="输入星曜或规则 ID"
              onChange={(event) => setQuery(event.target.value)}
            />
            </label>

          <button
            className={styles.secondaryButton}
            disabled={!hasActiveFilter}
            type="button"
            onClick={() => {
              props.onCategoryChange("all")
              setSelectedPalace("all")
              setQuery("")
            }}
          >
            清空
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>星曜</th>
                <th>分类</th>
                <th>落宫</th>
                <th>规则</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={`${row.starId}-${row.palaceLabel}-${row.placementRuleId}`}>
                  <td>{row.label}</td>
                  <td>{row.categoryLabel}</td>
                  <td>{row.palaceLabel} · {row.sectorLabel}</td>
                  <td>
                    <code className={styles.ruleCode}>
                      {row.placementRuleId ?? "未记录"}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function buildCategoryOptions(rows: ZiweiStarCatalogRowView[]): Array<{
  category: ZiweiStarCategory
  label: string
  count: number
}> {
  const seen = new Map<ZiweiStarCategory, {
    label: string
    count: number
  }>()

  rows.forEach((row) => {
    if (row.category === "empty") {
      return
    }

    const existing = seen.get(row.category)

    seen.set(row.category, {
      label: row.categoryLabel,
      count: (existing?.count ?? 0) + 1
    })
  })

  return Array.from(seen.entries()).map(([category, option]) => {
    return {
      category,
      label: option.label,
      count: option.count
    }
  })
}

function buildPalaceOptions(rows: ZiweiStarCatalogRowView[]): Array<{
  key: string
  label: string
  count: number
}> {
  const seen = new Map<string, {
    label: string
    count: number
  }>()

  rows.forEach((row) => {
    const key = getPalaceFilterKey(row)
    const label = formatPalaceLabel(row)
    const existing = seen.get(key)

    seen.set(key, {
      label,
      count: (existing?.count ?? 0) + 1
    })
  })

  return Array.from(seen.entries()).map(([key, option]) => {
    return {
      key,
      label: option.label,
      count: option.count
    }
  })
}

function filterRows(params: {
  rows: ZiweiStarCatalogRowView[]
  category: StarCatalogCategoryFilter
  palaceKey: string
  query: string
}): ZiweiStarCatalogRowView[] {
  const queryText = params.query.trim().toLowerCase()

  return params.rows.filter((row) => {
    if (params.category !== "all" && row.category !== params.category) {
      return false
    }

    if (params.palaceKey !== "all" && getPalaceFilterKey(row) !== params.palaceKey) {
      return false
    }

    if (!queryText) {
      return true
    }

    return [
      row.starId,
      row.label,
      row.categoryLabel,
      row.palaceLabel,
      row.sectorLabel,
      row.placementRuleId
    ].some((value) => {
      return value?.toLowerCase().includes(queryText)
    })
  })
}

function getPalaceFilterKey(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "unknown"}::${row.sectorLabel ?? "unknown"}`
}

function formatPalaceLabel(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "未落宫"} · ${row.sectorLabel ?? "未归类"}`
}
