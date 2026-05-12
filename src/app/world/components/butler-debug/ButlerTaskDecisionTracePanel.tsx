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
  const experience = trace?.experienceInterpretation ?? null

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
          Experience Interpretation / 经验解释
        </h3>

        {!experience && (
          <p className={styles.empty}>
            当前还没有经验解释审计。
          </p>
        )}

        {experience && (
          <>
            <div className={styles.row}>
              <span>mode</span>
              <span>{experience.mode}</span>
            </div>

            <div className={styles.row}>
              <span>profileSource</span>
              <span className={styles.multiline}>
                {experience.profileSource}
              </span>
            </div>

            <div className={styles.row}>
              <span>dominantInterpretation</span>
              <span>{experience.dominantInterpretation}</span>
            </div>

            <div className={styles.row}>
              <span>suggestedPosture</span>
              <span>{experience.suggestedPosture}</span>
            </div>

            <div className={styles.row}>
              <span>boundary</span>
              <span className={styles.multiline}>
                Relation 不控制行为；Feedback 不控制行为；Profile / 八字负责解释事实。
              </span>
            </div>

            <div className={styles.row}>
              <span>interpretationTags</span>
              <span className={styles.multiline}>
                {experience.interpretationTags.length > 0
                  ? experience.interpretationTags.join(" / ")
                  : "-"}
              </span>
            </div>

            <div className={styles.row}>
              <span>reasons</span>
              <span className={styles.multiline}>
                {experience.reasons.slice(0, 5).join(" / ")}
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
            本轮没有记录 gate，可能是领养抵达优先分支或待命分支。
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
            本轮没有记录 score，可能是领养抵达优先分支或待命分支。
          </p>
        )}

        {trace &&
          trace.scores.slice(0, 10).map((score, index) => (
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
