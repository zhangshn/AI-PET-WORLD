import type {
  ZiweiStarCatalogRowView
} from "@/ai/destiny-core/ziwei-core/contracts"

import type { StarCatalogCategoryFilter } from "../_lib/ziwei-star-category-filter"
import styles from "../_styles/ziwei-page.module.css"
import {
  buildRuleSourceIndex,
  countRuleSourcePalaces
} from "../_lib/ziwei-rule-source-index"

export function RuleSourceOverviewPanel(props: {
  rows: ZiweiStarCatalogRowView[]
  onSelectCategory: (category: StarCatalogCategoryFilter) => void
}) {
  const groups = buildRuleSourceIndex(props.rows)
  const ruleCount = groups.reduce((count, group) => {
    return count + group.rules.length
  }, 0)
  const palaceCount = countRuleSourcePalaces(groups)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>规则来源总览</h2>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => props.onSelectCategory("all")}
        >
          查看全部星曜
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.ruleSourceSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>规则数量</span>
            <strong>{ruleCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>星曜记录</span>
            <strong>{props.rows.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>分类数量</span>
            <strong>{groups.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>落宫覆盖</span>
            <strong>{palaceCount}</strong>
          </div>
        </div>

        <div className={styles.ruleSourceGroupStack}>
          {groups.map((group) => (
            <section className={styles.ruleSourceGroup} key={group.category}>
              <div className={styles.ruleSourceGroupHeader}>
                <button
                  className={styles.inlineTextButton}
                  type="button"
                  onClick={() => props.onSelectCategory(group.category)}
                >
                  {group.categoryLabel}
                </button>
                <span>{group.rules.length} 条规则</span>
              </div>

              <div className={styles.ruleSourceList}>
                {group.rules.map((rule) => (
                  <RuleSourceCard
                    key={`${group.category}-${rule.ruleId}`}
                    rule={rule}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function RuleSourceCard(props: {
  rule: ReturnType<typeof buildRuleSourceIndex>[number]["rules"][number]
}) {
  return (
    <article className={styles.ruleSourceCard}>
      <div className={styles.ruleSourceCardHeader}>
        <code className={styles.ruleCode}>{props.rule.ruleId}</code>
        <span>{props.rule.count} 颗</span>
      </div>
      <dl className={styles.ruleSourceFacts}>
        <div>
          <dt>星曜</dt>
          <dd>{props.rule.starLabels.join("、")}</dd>
        </div>
        <div>
          <dt>落宫</dt>
          <dd>{props.rule.palaceLabels.join(" / ")}</dd>
        </div>
      </dl>
    </article>
  )
}
