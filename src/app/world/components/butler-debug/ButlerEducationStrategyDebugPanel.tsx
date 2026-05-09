"use client"

/**
 * 当前文件负责：展示管家教育策略的开发审计信息。
 */

import {
  buildButlerEducationStrategy,
  type ButlerRelationState,
} from "@/systems/butler/butler-gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  relation: ButlerRelationState | null
}

export default function ButlerEducationStrategyDebugPanel({
  relation,
}: Props) {
  const strategy = relation
    ? buildButlerEducationStrategy(relation)
    : null

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        Education Strategy / 教育策略
      </h3>

      {!strategy && (
        <p className={styles.empty}>
          当前还没有读取到管家关系状态，无法生成教育策略。
        </p>
      )}

      {strategy && (
        <>
          <div className={styles.row}>
            <span>posture</span>
            <span>{strategy.posture}</span>
          </div>

          <div className={styles.row}>
            <span>foodIntensityOffset</span>
            <span>{formatDebugValue(strategy.foodIntensityOffset)}</span>
          </div>

          <div className={styles.row}>
            <span>restIntensityOffset</span>
            <span>{formatDebugValue(strategy.restIntensityOffset)}</span>
          </div>

          <div className={styles.row}>
            <span>approachIntensityOffset</span>
            <span>{formatDebugValue(strategy.approachIntensityOffset)}</span>
          </div>

          <div className={styles.row}>
            <span>reason</span>
            <span className={styles.multiline}>
              {strategy.reason}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {strategy.tags.length > 0 ? strategy.tags.join(" / ") : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              教育策略只调整管家下一次提供机会的方式，不直接控制宠物行为，也不直接写入宠物 learning。
            </span>
          </div>
        </>
      )}
    </div>
  )
}