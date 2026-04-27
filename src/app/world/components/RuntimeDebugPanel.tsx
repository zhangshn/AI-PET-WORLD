/**
 * 当前文件负责：
 * 1. 展示 AI 运行时调试信息
 * 2. 帮助观察 pet runtime 内部驱动层
 * 3. 展示 Goal → Zone → World Position
 * 4. 作为 world 页面调试面板使用
 * 5. 中英文双语展示
 */

import type { PetState } from "@/types/pet"

import styles from "@/styles/world-styles/runtime-debug-panel.module.css"

type Props = {
  pet: PetState | null
  tick: number
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `${value}`
      : value.toFixed(2)
  }

  if (typeof value === "string") {
    return value
  }

  return JSON.stringify(value)
}

function formatPosition(
  position?: {
    x: number
    y: number
  }
): string {
  if (!position) {
    return "-"
  }

  return `(${Math.round(position.x)}, ${Math.round(position.y)})`
}

export default function RuntimeDebugPanel({
  pet,
  tick,
}: Props) {
  const timeline = pet?.timelineSnapshot
  const memoryBias = pet?.memoryState?.preferenceBias
  const latestCognition = pet?.latestCognition
  const process = pet?.activeBehaviorProcess
  const goal = pet?.currentGoal

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          运行调试 / Runtime Debug
        </h2>

        <span className={styles.tick}>
          Tick {tick}
        </span>
      </div>

      {!pet && (
        <p className={styles.empty}>
          当前没有宠物运行数据 / No active pet runtime data
        </p>
      )}

      {pet && (
        <div className={styles.grid}>
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              基础运行态 / Basic Runtime
            </h3>

            <div className={styles.row}>
              <span>名字 / Name</span>
              <span>{pet.name}</span>
            </div>

            <div className={styles.row}>
              <span>行为 / Action</span>
              <span>{pet.action}</span>
            </div>

            <div className={styles.row}>
              <span>情绪 / Mood</span>
              <span>{pet.mood}</span>
            </div>

            <div className={styles.row}>
              <span>精力 / Energy</span>
              <span>{pet.energy}</span>
            </div>

            <div className={styles.row}>
              <span>饥饿 / Hunger</span>
              <span>{pet.hunger}</span>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              Goal → Zone Runtime
            </h3>

            <div className={styles.row}>
              <span>目标 / Goal</span>
              <span>{formatValue(goal?.type)}</span>
            </div>

            <div className={styles.row}>
              <span>来源 / Source</span>
              <span>{formatValue(goal?.source)}</span>
            </div>

            <div className={styles.row}>
              <span>优先级 / Priority</span>
              <span>{formatValue(goal?.priority)}</span>
            </div>

            <div className={styles.row}>
              <span>区域 / Zone</span>
              <span>{formatValue(goal?.targetZoneType)}</span>
            </div>

            <div className={styles.row}>
              <span>区域 ID / Zone ID</span>
              <span>{formatValue(goal?.targetZoneId)}</span>
            </div>

            <div className={styles.row}>
              <span>空间坐标 / Position</span>
              <span>
                {formatPosition(goal?.targetWorldPosition)}
              </span>
            </div>

            <div className={styles.row}>
              <span>开始 Tick / Started</span>
              <span>{formatValue(goal?.startedAtTick)}</span>
            </div>

            <div className={styles.row}>
              <span>结束 Tick / Hold Until</span>
              <span>{formatValue(goal?.holdUntilTick)}</span>
            </div>

            <div className={styles.row}>
              <span>摘要 / Summary</span>

              <span className={styles.multiline}>
                {formatValue(goal?.summary)}
              </span>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              最新认知 / Latest Cognition
            </h3>

            <div className={styles.row}>
              <span>刺激 / Stimulus</span>
              <span>
                {formatValue(latestCognition?.stimulusType)}
              </span>
            </div>

            <div className={styles.row}>
              <span>解释 / Interpretation</span>
              <span>
                {formatValue(latestCognition?.interpretation)}
              </span>
            </div>

            <div className={styles.row}>
              <span>反应 / Reaction</span>
              <span>
                {formatValue(latestCognition?.reactionTendency)}
              </span>
            </div>

            <div className={styles.row}>
              <span>好奇 / Curiosity</span>
              <span>
                {formatValue(latestCognition?.curiosityLevel)}
              </span>
            </div>

            <div className={styles.row}>
              <span>压力 / Stress</span>
              <span>
                {formatValue(latestCognition?.stressLevel)}
              </span>
            </div>

            <div className={styles.row}>
              <span>安全感 / Safety</span>
              <span>
                {formatValue(latestCognition?.safetyFeeling)}
              </span>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              行为过程 / Behavior Process
            </h3>

            <div className={styles.row}>
              <span>类型 / Type</span>
              <span>{formatValue(process?.type)}</span>
            </div>

            <div className={styles.row}>
              <span>阶段 / Stage</span>
              <span>{formatValue(process?.stage)}</span>
            </div>

            <div className={styles.row}>
              <span>来源刺激 / Stimulus</span>
              <span>
                {formatValue(process?.sourceStimulusType)}
              </span>
            </div>

            <div className={styles.row}>
              <span>开始 / Started</span>
              <span>
                {formatValue(process?.startedAtTick)}
              </span>
            </div>

            <div className={styles.row}>
              <span>结束 / End Tick</span>
              <span>
                {formatValue(process?.endAtTick)}
              </span>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              Timeline Snapshot
            </h3>

            <div className={styles.row}>
              <span>阶段 / Phase</span>
              <span>
                {formatValue(timeline?.fortune?.phaseTag)}
              </span>
            </div>

            <div className={styles.row}>
              <span>分支 / Branch</span>
              <span>
                {formatValue(timeline?.trajectory?.branchTag)}
              </span>
            </div>

            <div className={styles.row}>
              <span>情绪 / Emotion</span>
              <span>
                {formatValue(timeline?.state?.emotional?.label)}
              </span>
            </div>

            <div className={styles.row}>
              <span>关系 / Relational</span>
              <span>
                {formatValue(timeline?.state?.relational?.label)}
              </span>
            </div>

            <div className={styles.row}>
              <span>驱动 / Drive</span>
              <span>
                {formatValue(timeline?.state?.drive?.primary)}
              </span>
            </div>
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              Memory Bias
            </h3>

            <div className={styles.row}>
              <span>探索 / Explore</span>
              <span>{formatValue(memoryBias?.exploreBias)}</span>
            </div>

            <div className={styles.row}>
              <span>观察 / Observe</span>
              <span>{formatValue(memoryBias?.observeBias)}</span>
            </div>

            <div className={styles.row}>
              <span>接近 / Approach</span>
              <span>{formatValue(memoryBias?.approachBias)}</span>
            </div>

            <div className={styles.row}>
              <span>休息 / Rest</span>
              <span>{formatValue(memoryBias?.restBias)}</span>
            </div>

            <div className={styles.row}>
              <span>进食 / Eat</span>
              <span>{formatValue(memoryBias?.eatBias)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}