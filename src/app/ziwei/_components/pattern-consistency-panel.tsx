import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import {
  buildZiweiPatternConsistencyReport,
  type ZiweiPatternConsistencyCheck
} from "../_lib/ziwei-pattern-consistency"

export function PatternConsistencyPanel(props: {
  palaces: ZiweiPalaceDetailView[]
}) {
  const report = buildZiweiPatternConsistencyReport({
    palaces: props.palaces,
    matches: buildZiweiPatternMatches(props.palaces)
  })

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>格局一致性校准</h2>
        <span className={styles.metaText}>{getStatusLabel(report.status)}</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.patternConsistencySummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>通过</span>
            <strong>{report.passCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>提醒</span>
            <strong>{report.warnCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>失败</span>
            <strong>{report.failCount}</strong>
          </div>
        </div>

        <div className={styles.patternConsistencyList}>
          {report.checks.map((check) => (
            <PatternConsistencyCard check={check} key={check.id} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PatternConsistencyCard(props: {
  check: ZiweiPatternConsistencyCheck
}) {
  return (
    <article
      className={`${styles.patternConsistencyCard} ${getStatusClassName(
        props.check.status
      )}`}
    >
      <div className={styles.patternConsistencyCardHeader}>
        <strong>{props.check.label}</strong>
        <span>{getStatusLabel(props.check.status)}</span>
      </div>
      <p>{props.check.detail}</p>
    </article>
  )
}

function getStatusClassName(status: ZiweiPatternConsistencyCheck["status"]) {
  if (status === "fail") {
    return styles.patternConsistencyFail
  }

  if (status === "warn") {
    return styles.patternConsistencyWarn
  }

  return styles.patternConsistencyPass
}

function getStatusLabel(status: ZiweiPatternConsistencyCheck["status"]) {
  if (status === "fail") {
    return "需处理"
  }

  if (status === "warn") {
    return "需复核"
  }

  return "已一致"
}
