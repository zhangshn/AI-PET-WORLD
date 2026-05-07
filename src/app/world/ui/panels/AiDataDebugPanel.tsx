/**
 * 当前文件负责：展示 AI Data Core 的开发观察面板。
 */

import {
  getAiDataRecordCount,
  getAiDataRecords,
} from "@/ai/data-core/ai-data-gateway"

import styles from "@/styles/world-styles/layout/ai-data-debug-panel.module.css"

function formatRecordKind(kind: string): string {
  if (kind === "decision") return "决策"
  if (kind === "world_event") return "世界事件"
  if (kind === "message") return "消息"
  if (kind === "state_snapshot") return "状态快照"
  if (kind === "user_feedback") return "用户反馈"

  return kind
}

export default function AiDataDebugPanel() {
  const records = getAiDataRecords({
    limit: 12,
  })

  const totalCount = getAiDataRecordCount()
  const messageCount = getAiDataRecordCount({ kind: "message" })
  const feedbackCount = getAiDataRecordCount({ kind: "user_feedback" })
  const decisionCount = getAiDataRecordCount({ kind: "decision" })
  const worldEventCount = getAiDataRecordCount({ kind: "world_event" })

  return (
    <article className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>AI DATA CORE</p>
          <h3>自有 AI 数据记录</h3>
        </div>

        <strong>{totalCount}</strong>
      </header>

      <div className={styles.statsGrid}>
        <span>
          <small>消息</small>
          <strong>{messageCount}</strong>
        </span>

        <span>
          <small>用户反馈</small>
          <strong>{feedbackCount}</strong>
        </span>

        <span>
          <small>决策</small>
          <strong>{decisionCount}</strong>
        </span>

        <span>
          <small>世界事件</small>
          <strong>{worldEventCount}</strong>
        </span>
      </div>

      <div className={styles.recordList}>
        {records.length === 0 && (
          <section className={styles.emptyState}>
            暂无 AI 数据记录。打开 P-Phone、读取短信或触发世界通知后，这里会出现记录。
          </section>
        )}

        {records.map((record) => (
          <section className={styles.recordItem} key={record.id}>
            <div className={styles.recordTop}>
              <strong>{formatRecordKind(record.kind)}</strong>
              <small>{record.source}</small>
            </div>

            <p>{record.summary}</p>

            <div className={styles.recordMeta}>
              <span>{record.entityType}</span>
              <span>{record.importance}</span>
              <span>{record.userVisibleChannel}</span>
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}