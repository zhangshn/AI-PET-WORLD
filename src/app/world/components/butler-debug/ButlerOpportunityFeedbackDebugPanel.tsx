"use client"

/**
 * 当前文件负责：展示管家机会反馈调试信息。
 */

import type {
  ButlerRelationState,
} from "@/systems/butler/butler-gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  relation: ButlerRelationState | null
}

export default function ButlerOpportunityFeedbackDebugPanel({
  relation,
}: Props) {
  const feedback = relation?.latestOpportunityFeedback ?? null

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        Butler Opportunity Feedback / 机会反馈
      </h3>

      {!relation && (
        <p className={styles.empty}>
          当前还没有读取到管家关系状态。
        </p>
      )}

      {relation && !feedback && (
        <>
          <p className={styles.empty}>
            当前还没有机会反馈。等待宠物接受、拒绝或机会过期后生成。
          </p>

          <div className={styles.row}>
            <span>successfulOffers</span>
            <span>{formatDebugValue(relation.successfulOffers)}</span>
          </div>

          <div className={styles.row}>
            <span>rejectedOffers</span>
            <span>{formatDebugValue(relation.rejectedOffers)}</span>
          </div>
        </>
      )}

      {relation && feedback && (
        <>
          <div className={styles.row}>
            <span>type</span>
            <span>{feedback.type}</span>
          </div>

          <div className={styles.row}>
            <span>accepted</span>
            <span>{feedback.accepted ? "是" : "否"}</span>
          </div>

          <div className={styles.row}>
            <span>expired</span>
            <span>{feedback.expired ? "是" : "否"}</span>
          </div>

          <div className={styles.row}>
            <span>tick</span>
            <span>{formatDebugValue(feedback.tick)}</span>
          </div>

          <div className={styles.row}>
            <span>value</span>
            <span>{formatDebugValue(feedback.value ?? "-")}</span>
          </div>

          <div className={styles.row}>
            <span>reason</span>
            <span className={styles.multiline}>
              {feedback.reason ?? "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>successfulOffers</span>
            <span>{formatDebugValue(relation.successfulOffers)}</span>
          </div>

          <div className={styles.row}>
            <span>rejectedOffers</span>
            <span>{formatDebugValue(relation.rejectedOffers)}</span>
          </div>

          <div className={styles.row}>
            <span>trustEstimate</span>
            <span>{formatDebugValue(relation.trustEstimate)}</span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              机会反馈来自宠物自主接受、拒绝或机会过期。它会影响管家关系估计和记忆，但不会直接控制宠物行为。
            </span>
          </div>
        </>
      )}
    </div>
  )
}