"use client"

import { useState } from "react"

import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import { buildZiweiPatternExportSummary } from "../_lib/ziwei-pattern-export-summary"
import type { PatternFilterValue } from "../_lib/ziwei-pattern-filter"
import { buildZiweiPatternStatistics } from "../_lib/ziwei-pattern-statistics"

type CopyStatus = "idle" | "copied" | "failed"

export function PatternStatisticsPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  onSelectPatternFilter?: (filter: PatternFilterValue) => void
}) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle")
  const matches = buildZiweiPatternMatches(props.palaces)
  const statistics = buildZiweiPatternStatistics(matches)
  const exportSummary = buildZiweiPatternExportSummary(matches)

  async function copyExportSummary() {
    try {
      await navigator.clipboard.writeText(exportSummary.text)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("failed")
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>格局统计</h2>
        <button
          className={styles.secondaryButton}
          onClick={() => props.onSelectPatternFilter?.("all")}
          type="button"
        >
          查看格局字典
        </button>
        <button
          className={styles.secondaryButton}
          onClick={copyExportSummary}
          type="button"
        >
          {copyStatus === "copied"
            ? "已复制"
            : copyStatus === "failed"
              ? "复制失败"
              : "复制摘要"}
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.patternStatisticsSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>格局总数</span>
            <strong>{statistics.totalCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>已命中</span>
            <strong>{statistics.hitCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>未成格</span>
            <strong>{statistics.missCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>加吉增强</span>
            <strong>{statistics.enhancedCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>煞忌破格</span>
            <strong>{statistics.brokenCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>凶格命中</span>
            <strong>{statistics.adverseHitCount}</strong>
          </div>
        </div>

        <section className={styles.patternExportSummary}>
          <div className={styles.patternExportSummaryHeader}>
            <strong>{exportSummary.title}</strong>
            <span>{exportSummary.lines.length} 行</span>
          </div>
          <pre>{exportSummary.text}</pre>
        </section>

        <div className={styles.patternStatisticsList}>
          {statistics.categoryStats.map((category) => (
            <article
              className={styles.patternStatisticsCard}
              key={category.category}
            >
              <div className={styles.patternStatisticsCardHeader}>
                <button
                  className={styles.patternStatisticsCategoryButton}
                  onClick={() => {
                    props.onSelectPatternFilter?.(`category:${category.category}`)
                  }}
                  type="button"
                >
                  {category.categoryLabel}
                </button>
                <span>{category.totalCount} 条</span>
              </div>
              <dl className={styles.patternStatisticsFacts}>
                <div>
                  <dt>命中</dt>
                  <dd>{category.hitCount}</dd>
                </div>
                <div>
                  <dt>未成</dt>
                  <dd>{category.missCount}</dd>
                </div>
                <div>
                  <dt>增强</dt>
                  <dd>{category.enhancedCount}</dd>
                </div>
                <div>
                  <dt>破格</dt>
                  <dd>{category.brokenCount}</dd>
                </div>
                <div>
                  <dt>待校</dt>
                  <dd>{category.pendingCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
