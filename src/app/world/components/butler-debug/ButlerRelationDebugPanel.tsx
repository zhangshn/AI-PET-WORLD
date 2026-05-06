"use client"

/**
 * 当前文件负责：展示管家与宠物之间的长期关系调试信息。
 */

import {
  buildButlerRelationTaskTuning,
  type ButlerRelationState,
} from "@/systems/butler/butler-gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  relation: ButlerRelationState | null
}

export default function ButlerRelationDebugPanel({ relation }: Props) {
  const relationTuning = buildButlerRelationTaskTuning(relation)

  return (
    <>
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
                Relation 只影响管家任务倾向，不控制宠物行为。
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Relation Tuning / 关系调参
        </h3>

        <div className={styles.row}>
          <span>carePriorityOffset</span>
          <span>{formatDebugValue(relationTuning.carePriorityOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>constructionDriveOffset</span>
          <span>{formatDebugValue(relationTuning.constructionDriveOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>foodSensitivityOffset</span>
          <span>{formatDebugValue(relationTuning.foodSensitivityOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>restSensitivityOffset</span>
          <span>{formatDebugValue(relationTuning.restSensitivityOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>approachSensitivityOffset</span>
          <span>{formatDebugValue(relationTuning.approachSensitivityOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>observationBiasOffset</span>
          <span>{formatDebugValue(relationTuning.observationBiasOffset)}</span>
        </div>

        <div className={styles.row}>
          <span>说明</span>
          <span className={styles.multiline}>
            当前调参会被合并进管家任务选择，但不会直接改变宠物行为。
          </span>
        </div>
      </div>
    </>
  )
}