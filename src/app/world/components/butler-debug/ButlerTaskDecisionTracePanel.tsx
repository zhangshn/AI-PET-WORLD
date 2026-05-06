"use client"

/**
 * 当前文件负责：展示管家最近一次任务选择审计。
 */

import type { ButlerTaskDecisionTrace } from "@/systems/butler/butler-gateway"

import {
  formatDebugValue,
  formatGatePassed,
} from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  trace: ButlerTaskDecisionTrace | null
}

export default function ButlerTaskDecisionTracePanel({ trace }: Props) {
  return (
    <>
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Task Decision Trace / 任务选择审计
        </h3>

        {!trace && (
          <p className={styles.empty}>
            当前还没有任务选择审计。等待下一次世界 Tick 后生成。
          </p>
        )}

        {trace && (
          <>
            <div className={styles.row}>
              <span>selectedTask</span>
              <span>{trace.selectedTask}</span>
            </div>

            <div className={styles.row}>
              <span>previousTask</span>
              <span>{trace.previousTask}</span>
            </div>

            <div className={styles.row}>
              <span>reason</span>
              <span className={styles.multiline}>
                {trace.reason}
              </span>
            </div>

            <div className={styles.row}>
              <span>hasPet</span>
              <span>{formatDebugValue(trace.context.hasPet)}</span>
            </div>

            <div className={styles.row}>
              <span>hasTimeline</span>
              <span>{formatDebugValue(trace.context.hasTimelineSnapshot)}</span>
            </div>

            <div className={styles.row}>
              <span>incubatorCompleted</span>
              <span>{formatDebugValue(trace.context.incubatorCompleted)}</span>
            </div>

            <div className={styles.row}>
              <span>homeCompleted</span>
              <span>{formatDebugValue(trace.context.homeCompleted)}</span>
            </div>

            <div className={styles.row}>
              <span>pendingOpportunity</span>
              <span>{formatDebugValue(trace.context.pendingOpportunityCount)}</span>
            </div>

            <div className={styles.row}>
              <span>petEnergy</span>
              <span>{formatDebugValue(trace.context.petEnergy)}</span>
            </div>

            <div className={styles.row}>
              <span>petHunger</span>
              <span>{formatDebugValue(trace.context.petHunger)}</span>
            </div>

            <div className={styles.row}>
              <span>petEmotion</span>
              <span>{formatDebugValue(trace.context.petEmotion)}</span>
            </div>

            <div className={styles.row}>
              <span>petRelation</span>
              <span>{formatDebugValue(trace.context.petRelation)}</span>
            </div>

            <div className={styles.row}>
              <span>lifePhase</span>
              <span>{formatDebugValue(trace.context.petLifePhase)}</span>
            </div>

            <div className={styles.row}>
              <span>time</span>
              <span>
                {formatDebugValue(trace.context.timeHour)}
                {" / "}
                {formatDebugValue(trace.context.timePeriod)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Decision Gates / 条件门
        </h3>

        {!trace && (
          <p className={styles.empty}>
            暂无 gates。
          </p>
        )}

        {trace && trace.gates.length === 0 && (
          <p className={styles.empty}>
            本轮没有记录 gate，可能是孵化器优先分支或待命分支。
          </p>
        )}

        {trace &&
          trace.gates.slice(0, 8).map((gate, index) => (
            <div className={styles.row} key={`${gate.key}-${index}`}>
              <span>
                {gate.key} / {formatGatePassed(gate.passed)}
              </span>

              <span className={styles.multiline}>
                {gate.reason}
              </span>
            </div>
          ))}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Decision Scores / 判断分数
        </h3>

        {!trace && (
          <p className={styles.empty}>
            暂无 scores。
          </p>
        )}

        {trace && trace.scores.length === 0 && (
          <p className={styles.empty}>
            本轮没有记录 score，可能是孵化器优先分支或待命分支。
          </p>
        )}

        {trace &&
          trace.scores.slice(0, 8).map((score, index) => (
            <div className={styles.row} key={`${score.key}-${index}`}>
              <span>
                {score.key}: {formatDebugValue(score.value)}
              </span>

              <span className={styles.multiline}>
                {score.reason}
              </span>
            </div>
          ))}
      </div>
    </>
  )
}