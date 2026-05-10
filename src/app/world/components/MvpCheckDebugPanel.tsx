"use client"

/**
 * 当前文件负责：在 F3 中展示 MVP 全链路检查摘要。
 */

import type {
  MvpCheckReport,
} from "@/world/mvp-check/mvp-check-gateway"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  report: MvpCheckReport
}

function countStatus(
  report: MvpCheckReport,
  status: MvpCheckReport["overallStatus"]
): number {
  return report.items.filter((item) => item.status === status).length
}

export default function MvpCheckDebugPanel({ report }: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          MVP Check / 全链路检查
        </h2>

        <span className={styles.tick}>
          {report.overallStatus}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Summary</h3>

          <div className={styles.row}>
            <span>overallStatus</span>
            <span>{report.overallStatus}</span>
          </div>

          <div className={styles.row}>
            <span>counts</span>
            <span>
              pass {countStatus(report, "pass")} / warn {countStatus(report, "warn")} / fail {countStatus(report, "fail")}
            </span>
          </div>

          <div className={styles.row}>
            <span>summary</span>
            <span className={styles.multiline}>
              {report.summary}
            </span>
          </div>
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Items</h3>

          {report.items.map((item) => (
            <div className={styles.row} key={item.id}>
              <span>{item.status} · {item.title}</span>
              <span className={styles.multiline}>
                {item.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
