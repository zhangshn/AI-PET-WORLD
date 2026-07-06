import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import {
  buildZiweiPatternSourceIndex,
  type ZiweiPatternSourceIndexRow
} from "../_lib/ziwei-pattern-source-index"

export function PatternSourceIndexPanel(props: {
  palaces: ZiweiPalaceDetailView[]
}) {
  const rows = buildZiweiPatternSourceIndex(
    buildZiweiPatternMatches(props.palaces)
  )
  const categoryCount = new Set(rows.map((row) => row.categoryLabel)).size
  const sourceRuleCount = new Set(rows.flatMap((row) => row.sourceRuleIds)).size
  const calibratedCount = rows.filter((row) => {
    return row.calibrationStatus.startsWith("已接入判定")
  }).length
  const groups = groupRowsByCategory(rows)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>格局来源索引</h2>
        <span className={styles.metaText}>{rows.length} 条格局</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.patternSourceSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>格局数量</span>
            <strong>{rows.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>分类数量</span>
            <strong>{categoryCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>已接入</span>
            <strong>{calibratedCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>来源规则</span>
            <strong>{sourceRuleCount}</strong>
          </div>
        </div>

        <div className={styles.patternSourceGroupStack}>
          {groups.map((group) => (
            <section className={styles.patternSourceGroup} key={group.label}>
              <div className={styles.patternSourceGroupHeader}>
                <h3>{group.label}</h3>
                <span>{group.rows.length} 条</span>
              </div>
              <div className={styles.patternSourceList}>
                {group.rows.map((row) => (
                  <PatternSourceCard key={row.patternId} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function PatternSourceCard(props: {
  row: ZiweiPatternSourceIndexRow
}) {
  return (
    <article className={styles.patternSourceCard}>
      <div className={styles.patternSourceCardHeader}>
        <strong>{props.row.label}</strong>
        <code className={styles.ruleCode}>{props.row.patternId}</code>
      </div>
      <dl className={styles.patternSourceFacts}>
        <div>
          <dt>判定</dt>
          <dd>{props.row.matchMethodLabel}</dd>
        </div>
        <div>
          <dt>范围</dt>
          <dd>{props.row.scopeLabel}</dd>
        </div>
        <div>
          <dt>星曜</dt>
          <dd>{props.row.starLabels.join(" / ")}</dd>
        </div>
        <div>
          <dt>条件</dt>
          <dd>{props.row.conditionText}</dd>
        </div>
        <div>
          <dt>校准</dt>
          <dd>{props.row.calibrationStatus}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>
            {props.row.sourceRuleIds.length > 0
              ? props.row.sourceRuleIds.join(" / ")
              : props.row.statusLabel}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function groupRowsByCategory(rows: ZiweiPatternSourceIndexRow[]): {
  label: string
  rows: ZiweiPatternSourceIndexRow[]
}[] {
  const groups = new Map<string, ZiweiPatternSourceIndexRow[]>()

  rows.forEach((row) => {
    groups.set(row.categoryLabel, [...(groups.get(row.categoryLabel) ?? []), row])
  })

  return Array.from(groups, ([label, groupRows]) => {
    return {
      label,
      rows: groupRows
    }
  })
}
