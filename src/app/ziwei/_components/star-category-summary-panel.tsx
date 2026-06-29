import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import {
  buildStarCategorySummaries,
  countStarCategoryRules
} from "../_lib/ziwei-star-category-summary"
import type { StarCatalogCategoryFilter } from "./star-catalog-table"

export function StarCategorySummaryPanel(props: {
  rows: ZiweiStarCatalogRowView[]
  onSelectCategory: (category: StarCatalogCategoryFilter) => void
}) {
  const summaries = buildStarCategorySummaries(props.rows)
  const totalRules = countStarCategoryRules(summaries)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>星曜分类统计</h2>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => props.onSelectCategory("all")}
        >
          查看全部
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.categorySummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>分类数量</span>
            <strong>{summaries.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>星曜记录</span>
            <strong>{props.rows.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>规则来源</span>
            <strong>{totalRules}</strong>
          </div>
        </div>

        <div className={styles.categorySummaryList}>
          {summaries.map((summary) => (
            <article className={styles.categorySummaryCard} key={summary.category}>
              <button
                className={styles.categorySummaryHeader}
                type="button"
                onClick={() => props.onSelectCategory(summary.category)}
              >
                <strong>{summary.categoryLabel}</strong>
                <span>{summary.starCount} 颗</span>
              </button>

              <div className={styles.categorySummaryFacts}>
                <div>
                  <span>落宫覆盖</span>
                  <strong>{summary.palaceCount}</strong>
                </div>
                <div>
                  <span>规则来源</span>
                  <strong>{summary.ruleCount}</strong>
                </div>
              </div>

              <p className={styles.categoryPalaceText}>
                {summary.palaceLabels.join(" / ")}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
