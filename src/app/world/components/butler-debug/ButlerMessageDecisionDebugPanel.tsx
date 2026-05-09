"use client"

/**
 * 当前文件负责：展示管家主动消息判断层的开发审计信息。
 */

import type {
  ButlerMessageDecision,
} from "@/systems/butler/butler-gateway"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  decision: ButlerMessageDecision | null
}

export default function ButlerMessageDecisionDebugPanel({
  decision,
}: Props) {
  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        Message Decision / 主动消息判断
      </h3>

      {!decision && (
        <p className={styles.empty}>
          当前还没有生成管家主动消息判断快照。
        </p>
      )}

      {decision && (
        <>
          <div className={styles.row}>
            <span>shouldContactPlayer</span>
            <span>{decision.shouldContactPlayer ? "true" : "false"}</span>
          </div>

          <div className={styles.row}>
            <span>priority</span>
            <span>{decision.priority}</span>
          </div>

          <div className={styles.row}>
            <span>reason</span>
            <span>{decision.reason}</span>
          </div>

          <div className={styles.row}>
            <span>suggestedTone</span>
            <span>{decision.suggestedTone}</span>
          </div>

          <div className={styles.row}>
            <span>sourceTask</span>
            <span>{decision.sourceTask}</span>
          </div>

          <div className={styles.row}>
            <span>relationTone</span>
            <span>{decision.relationTone}</span>
          </div>

          <div className={styles.row}>
            <span>educationPosture</span>
            <span>{decision.educationPosture ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>createdAtTick</span>
            <span>{decision.createdAtTick}</span>
          </div>

          <div className={styles.row}>
            <span>cooldownUntilTick</span>
            <span>{decision.cooldownUntilTick ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>summary</span>
            <span className={styles.multiline}>
              {decision.summary}
            </span>
          </div>

          <div className={styles.row}>
            <span>draftText</span>
            <span className={styles.multiline}>
              {decision.draftText ?? "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {decision.tags.length > 0 ? decision.tags.join(" / ") : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              主动消息判断只表示管家是否形成联系玩家意图，不代表已经发送 P-Phone 消息。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
