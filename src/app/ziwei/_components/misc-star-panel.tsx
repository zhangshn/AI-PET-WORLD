import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import {
  buildMiscStarGroups,
  countMiscPalaces,
  countMiscSourceRules
} from "../_lib/ziwei-misc-star-groups"

export function MiscStarPanel(props: {
  rows: ZiweiStarCatalogRowView[]
  onOpenCatalog: () => void
}) {
  const groups = buildMiscStarGroups(props.rows)
  const miscRows = groups.flatMap((group) => group.rows)
  const ruleCount = countMiscSourceRules(props.rows)
  const palaceCount = countMiscPalaces(props.rows)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>杂曜专项总览</h2>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={props.onOpenCatalog}
        >
          查看总表杂曜
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.miscSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>杂曜总数</span>
            <strong>{miscRows.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>子类数量</span>
            <strong>{groups.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>落宫覆盖</span>
            <strong>{palaceCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>规则来源</span>
            <strong>{ruleCount}</strong>
          </div>
        </div>

        <div className={styles.miscGroupStack}>
          {groups.map((group) => (
            <section className={styles.miscGroup} key={group.key}>
              <div className={styles.miscGroupHeader}>
                <h3>{group.label}</h3>
                <span>{group.rows.length} 颗</span>
              </div>
              <div className={styles.miscStarList}>
                {group.rows.map((row) => (
                  <article
                    className={styles.miscStarCard}
                    key={`${row.starId}-${row.placementRuleId}`}
                  >
                    <div className={styles.starDetailHeader}>
                      <strong>{row.label}</strong>
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
