/**
 * 当前文件职责：展示 /world 页面中的 AI 管家自主意识只读面板。
 */

import type { MvpWorldViewModel } from "./mvp-world-view-model"
import styles from "./world-route-page.styles.module.css"

export function ButlerAutonomyPanel(input: {
  summary: MvpWorldViewModel["butlerAutonomyProbe"]
}) {
  const { summary } = input

  return (
    <article className={styles.productResourcePanel} aria-label="AI 管家自主意识">
      <div className={styles.productMapHeader}>
        <div>
          <h3>AI 管家自主意识</h3>
          <p>只读展示管家本轮判断，不写入世界事实。</p>
        </div>
        <span>{summary.statusLabel}</span>
      </div>

      <div className={styles.productResourceGrid}>
        <InfoCard title="主意图" value={summary.selectedIntentLabel} body={summary.selectedIntentReason} />
        <InfoCard title="意识状态" value={summary.consciousStateLabel} body="来自世界感知、资源压力、空间压力和审计结果。" />
        <InfoCard title="审计提醒" value={`${summary.auditWarningCount} 条`} body="提醒只用于观察，不会直接修改 HomeMapState。" />
      </div>

      <div className={styles.productResourceGrid}>
        <ListCard title="主要动机" items={summary.topMotivationLabels} />
        <ListCard title="候选目标" items={summary.topGoalLabels} />
        <ListCard title="Checklist" items={summary.checklist.slice(0, 6).map((item) => `${item.status === "passed" ? "通过" : "提醒"}｜${item.title}`)} />
      </div>

      <div className={styles.productExplanation}>
        <strong>管家解释</strong>
        <span>只读解释</span>
        <p>{summary.explanationBodies[0] ?? summary.selectedIntentReason}</p>
      </div>
    </article>
  )
}

function InfoCard(input: { title: string; value: string; body: string }) {
  return (
    <div className={styles.productResourceItem}>
      <div className={styles.resourceHeader}>
        <strong>{input.title}</strong>
        <span>{input.value}</span>
      </div>
      <p>{input.body}</p>
    </div>
  )
}

function ListCard(input: { title: string; items: string[] }) {
  return (
    <div className={styles.productResourceItem}>
      <div className={styles.resourceHeader}>
        <strong>{input.title}</strong>
        <span>{input.items.length} 项</span>
      </div>
      {input.items.length > 0 ? input.items.map((item) => <p key={item}>{item}</p>) : <p>暂无数据。</p>}
    </div>
  )
}
