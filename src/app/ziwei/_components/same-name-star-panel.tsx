import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildSameNameStarGroups } from "../_lib/ziwei-same-name-stars"
import type { StarCatalogCategoryFilter } from "./star-catalog-table"

export function SameNameStarPanel(props: {
  rows: ZiweiStarCatalogRowView[]
  onSelectCategory: (category: StarCatalogCategoryFilter) => void
}) {
  const groups = buildSameNameStarGroups(props.rows)
  const duplicateRecordCount = groups.reduce((count, group) => {
    return count + group.rows.length
  }, 0)

  if (groups.length === 0) {
    return null
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>同名星曜校准</h2>
        <span className={styles.metaText}>{groups.length} 组</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.sameNameSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>同名组</span>
            <strong>{groups.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>星曜记录</span>
            <strong>{duplicateRecordCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>规则来源</span>
            <strong>{countUniqueRules(groups)}</strong>
          </div>
        </div>

        <div className={styles.sameNameGroupStack}>
          {groups.map((group) => (
            <section className={styles.sameNameGroup} key={group.label}>
              <div className={styles.sameNameGroupHeader}>
                <h3>{group.label}</h3>
                <span>{group.rows.length} 条记录</span>
              </div>

              <div className={styles.tagList}>
                {group.categoryLabels.map((label) => (
                  <span className={styles.badge} key={label}>
                    {label}
                  </span>
                ))}
              </div>

              <div className={styles.sameNameRecordList}>
                {group.rows.map((row) => (
                  <article className={styles.sameNameRecord} key={row.starId}>
                    <div className={styles.starDetailHeader}>
                      <button
                        className={styles.inlineTextButton}
                        type="button"
                        onClick={() => props.onSelectCategory(row.category)}
                      >
                        {row.categoryLabel}
                      </button>
                      <span>
                        {row.palaceLabel} · {row.sectorLabel}
                      </span>
                    </div>
                    <div className={styles.starMetaLine}>
                      <span>星曜 ID</span>
                      <code className={styles.ruleCode}>{row.starId}</code>
                    </div>
                    <div className={styles.starMetaLine}>
                      <span>规则来源</span>
                      <code className={styles.ruleCode}>
                        {row.placementRuleId ?? "未记录"}
                      </code>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function countUniqueRules(groups: ReturnType<typeof buildSameNameStarGroups>) {
  return new Set(groups.flatMap((group) => group.ruleIds)).size
}
