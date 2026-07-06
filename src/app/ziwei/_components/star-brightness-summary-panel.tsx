import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

import type { StarCatalogBrightnessFilter } from "../_lib/ziwei-star-brightness-summary"
import {
  buildStarBrightnessSummaries,
  getStarBrightnessFilterLabel
} from "../_lib/ziwei-star-brightness-summary"
import styles from "../_styles/ziwei-page.module.css"

export function StarBrightnessSummaryPanel(props: {
  rows: ZiweiStarCatalogRowView[]
  selectedBrightness: StarCatalogBrightnessFilter
  onSelectBrightness: (brightness: StarCatalogBrightnessFilter) => void
  onOpenCatalog: () => void
}) {
  const summaries = buildStarBrightnessSummaries(props.rows)
  const mappedCount = summaries
    .filter((summary) => summary.level !== "unmapped")
    .reduce((count, summary) => count + summary.starCount, 0)
  const selectedLabel = getStarBrightnessFilterLabel(props.selectedBrightness)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>庙旺落陷汇总</h2>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            props.onSelectBrightness("all")
            props.onOpenCatalog()
          }}
        >
          查看全部
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.brightnessSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>当前筛选</span>
            <strong>{selectedLabel}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>有表星曜</span>
            <strong>{mappedCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>全部记录</span>
            <strong>{props.rows.length}</strong>
          </div>
        </div>

        <div className={styles.brightnessSummaryList}>
          {summaries.map((summary) => (
            <article className={styles.brightnessSummaryCard} key={summary.level}>
              <button
                className={styles.brightnessSummaryHeader}
                type="button"
                onClick={() => {
                  props.onSelectBrightness(summary.level)
                  props.onOpenCatalog()
                }}
              >
                <strong>{summary.label}</strong>
                <span>{summary.starCount} 颗</span>
              </button>

              <div className={styles.brightnessSummaryFacts}>
                <div>
                  <span>落宫覆盖</span>
                  <strong>{summary.palaceCount}</strong>
                </div>
                <div>
                  <span>分类覆盖</span>
                  <strong>{summary.categoryCount}</strong>
                </div>
                <div>
                  <span>来源规则</span>
                  <strong>{summary.sourceRuleCount}</strong>
                </div>
              </div>

              <p className={styles.categoryPalaceText}>
                {summary.categoryLabels.join(" / ")}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
