"use client"

/**
 * 当前文件负责：展示管家与宠物之间的长期关系调试信息。
 */

import type { ButlerRelationState } from "@/systems/butler/butler-gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  relation: ButlerRelationState | null
}

export default function ButlerRelationDebugPanel({ relation }: Props) {
  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        Butler Relation / 管家关系
      </h3>

      {!relation && (
        <p className={styles.empty}>
          当前还没有读取到管家关系状态。
        </p>
      )}

      {relation && (
        <>
          <div className={styles.row}>
            <span>tone</span>
            <span>{relation.tone}</span>
          </div>

          <div className={styles.row}>
            <span>familiarity</span>
            <span>{formatDebugValue(relation.familiarity)}</span>
          </div>

          <div className={styles.row}>
            <span>trustEstimate</span>
            <span>{formatDebugValue(relation.trustEstimate)}</span>
          </div>

          <div className={styles.row}>
            <span>careHistory</span>
            <span>{formatDebugValue(relation.careHistory)}</span>
          </div>

          <div className={styles.row}>
            <span>observationCount</span>
            <span>{formatDebugValue(relation.observationCount)}</span>
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
            <span>lastInteractionTick</span>
            <span>{formatDebugValue(relation.lastInteractionTick)}</span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {relation.tags.length > 0
                ? relation.tags.join(" / ")
                : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              当前 Relation 只记录管家与宠物的长期关系估计，暂时不参与任务选择，也不控制宠物行为。
            </span>
          </div>
        </>
      )}
    </div>
  )
}