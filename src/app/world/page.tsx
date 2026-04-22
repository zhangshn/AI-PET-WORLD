"use client"

/**
 * 当前文件负责：展示 AI-PET-WORLD 正式世界页的结果层、状态层与连续叙事事件流
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { WorldEngine, type WorldState } from "../../engine/worldEngine"
import type { WorldEvent } from "../../types/event"

type StructuredWorldEvent = WorldEvent & {
  sourceAction?: string
  narrativeType?: string
  continuityId?: string
  continuityStep?: number
  intensity?: number
}

type EventStoryGroup = {
  id: string
  continuityId?: string
  events: StructuredWorldEvent[]
  startedAt: {
    day: number
    hour: number
  }
  endedAt: {
    day: number
    hour: number
  }
}

const PERIOD_LABELS: Record<string, string> = {
  Morning: "清晨",
  Daytime: "白天",
  Evening: "傍晚",
  Night: "夜晚",
}

const BUTLER_TASK_LABELS: Record<string, string> = {
  feeding_pet: "照看宠物",
  building_home: "搭建家园",
  watching_pet: "观察宠物",
  idle: "待命中",
}

const PET_ACTION_LABELS: Record<string, string> = {
  sleeping: "休息中",
  walking: "活动中",
  eating: "进食中",
  exploring: "探索中",
  approaching: "靠近中",
  idle: "停留中",
  observing: "观察中",
  resting: "恢复中",
  alert_idle: "警觉停留中",
}

const PET_MOOD_LABELS: Record<string, string> = {
  happy: "放松",
  normal: "平稳",
  sad: "低落",
  calm: "平静",
  curious: "好奇",
  alert: "警觉",
}

const TIMELINE_EMOTIONAL_LABELS: Record<string, string> = {
  relaxed: "放松",
  content: "满足",
  curious: "好奇",
  excited: "兴奋",
  alert: "警觉",
  irritated: "烦躁",
  anxious: "不安",
  low: "低落",
  neutral: "平稳",
}

const TIMELINE_COGNITIVE_LABELS: Record<string, string> = {
  idle: "松散观察",
  observing: "观察中",
  focused: "专注中",
  curious: "探索留意",
  hesitant: "迟疑中",
  stressed: "紧绷中",
  avoidant: "回避中",
}

const TIMELINE_RELATIONAL_LABELS: Record<string, string> = {
  secure: "安心",
  attached: "亲近",
  neutral: "中性",
  guarded: "保留",
  distant: "疏离",
}

const TIMELINE_DRIVE_LABELS: Record<string, string> = {
  rest: "想休息",
  eat: "想进食",
  explore: "想探索",
  approach: "想靠近",
  avoid: "想回避",
  idle: "暂时停留",
}

const TIMELINE_BRANCH_LABELS: Record<string, string> = {
  balanced: "平衡路径",
  attachment: "亲近路径",
  defense: "防御路径",
  curiosity: "探索路径",
  recovery: "恢复路径",
  survival: "应对路径",
}

const TIMELINE_FORTUNE_PHASE_LABELS: Record<string, string> = {
  stable_phase: "平稳阶段",
  growth_phase: "成长扩张阶段",
  sensitive_phase: "敏感波动阶段",
  recovery_phase: "修整恢复阶段",
  attachment_phase: "亲近依附阶段",
  withdrawal_phase: "收缩回避阶段",
}

function ProgressBar({
  label,
  value,
  displayValue,
  reverse = false,
}: {
  label: string
  value: number
  displayValue?: number
  reverse?: boolean
}) {
  const safeValue = Math.max(0, Math.min(100, value))
  const barValue = reverse ? 100 - safeValue : safeValue
  const shownValue =
    typeof displayValue === "number"
      ? Math.max(0, Math.min(100, displayValue))
      : safeValue

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <span>{shownValue}</span>
      </div>

      <div
        style={{
          width: "100%",
          height: 10,
          borderRadius: 999,
          background: "#ececec",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barValue}%`,
            height: "100%",
            background: "#5f5f5f",
          }}
        />
      </div>
    </div>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e6e6e6",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 8,
        fontSize: 14,
      }}
    >
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  )
}

function getInnateTemperamentLabel(summaries: string[] = []): string {
  const text = summaries.join(" ")

  if (text.includes("照顾") || text.includes("责任") || text.includes("保护")) {
    return "守护型"
  }

  if (text.includes("探索") || text.includes("变化") || text.includes("联想")) {
    return "探索型"
  }

  if (text.includes("细腻") || text.includes("敏感") || text.includes("情绪")) {
    return "感知型"
  }

  if (text.includes("掌控") || text.includes("主导") || text.includes("执行")) {
    return "主导型"
  }

  if (text.includes("舒适") || text.includes("和气") || text.includes("柔软")) {
    return "温和型"
  }

  return "平衡型"
}

function getCurrentPhaseLabel(params: {
  phaseTag?: string
  period?: string
  action?: string
  mood?: string
  energy?: number
  hunger?: number
}): string {
  const {
    phaseTag,
    period,
    action,
    mood,
    energy = 50,
    hunger = 50,
  } = params

  if (phaseTag) {
    return TIMELINE_FORTUNE_PHASE_LABELS[phaseTag] || phaseTag
  }

  if (period === "Night" && action === "sleeping") {
    return "回收阶段"
  }

  if (hunger >= 60 || action === "eating") {
    return "补给阶段"
  }

  if (energy <= 45) {
    return "恢复阶段"
  }

  if (action === "walking" && mood === "happy") {
    return "探索阶段"
  }

  if (mood === "sad") {
    return "收缩阶段"
  }

  if (mood === "normal") {
    return "平稳阶段"
  }

  return "活动阶段"
}

function getBehaviorSignature(params: {
  action?: string
  mood?: string
  energy?: number
  hunger?: number
  emotionalLabel?: string
  cognitiveLabel?: string
  relationalLabel?: string
  drivePrimary?: string
}): string[] {
  const result: string[] = []

  const {
    action,
    mood,
    energy = 50,
    hunger = 50,
    emotionalLabel,
    cognitiveLabel,
    relationalLabel,
    drivePrimary,
  } = params

  if (drivePrimary === "explore") {
    result.push("当前更想向外探索")
  }

  if (drivePrimary === "rest") {
    result.push("当前更想回收精力")
  }

  if (drivePrimary === "eat") {
    result.push("当前更想回应身体需求")
  }

  if (drivePrimary === "approach") {
    result.push("当前更想靠近熟悉对象")
  }

  if (drivePrimary === "avoid") {
    result.push("当前更想回避刺激")
  }

  if (emotionalLabel === "relaxed" || emotionalLabel === "content") {
    result.push("整体状态偏放松")
  }

  if (emotionalLabel === "alert") {
    result.push("对周围变化更敏锐")
  }

  if (emotionalLabel === "anxious" || emotionalLabel === "irritated") {
    result.push("当前更容易受外界扰动")
  }

  if (cognitiveLabel === "observing") {
    result.push("正在观察周围环境")
  }

  if (cognitiveLabel === "focused") {
    result.push("当前注意力较集中")
  }

  if (cognitiveLabel === "hesitant") {
    result.push("动作前会有一点迟疑")
  }

  if (relationalLabel === "attached") {
    result.push("对熟悉对象更愿意靠近")
  }

  if (relationalLabel === "guarded" || relationalLabel === "distant") {
    result.push("当前保留感更强")
  }

  if (action === "resting") {
    result.push("正在主动恢复状态")
  }

  if (action === "alert_idle") {
    result.push("当前处于警觉停留状态")
  }

  if (result.length === 0) {
    if (action === "walking") {
      result.push("正在外界活动")
    }

    if (action === "sleeping") {
      result.push("正在主动回收精力")
    }

    if (action === "eating") {
      result.push("正在回应身体需求")
    }

    if (action === "observing") {
      result.push("正在安静观察周围")
    }

    if (mood === "happy") {
      result.push("状态偏放松")
    }

    if (mood === "normal") {
      result.push("状态偏稳定")
    }

    if (mood === "sad") {
      result.push("状态偏敏感")
    }

    if (energy <= 45) {
      result.push("精力偏低")
    }

    if (hunger >= 60) {
      result.push("饥饿感较强")
    }
  }

  return result
}

function getNarrativeEvents(events: WorldEvent[]): StructuredWorldEvent[] {
  return [...events]
    .reverse()
    .filter((event) =>
      [
        "pet_action_changed",
        "pet_action_narrative",
        "pet_action_end",
        "pet_mood_changed",
        "pet_hatched",
      ].includes(event.type)
    )
    .slice(0, 24) as StructuredWorldEvent[]
}

function getContinuityId(event: StructuredWorldEvent): string | undefined {
  return typeof event.continuityId === "string" ? event.continuityId : undefined
}

function getEventIntensity(event: StructuredWorldEvent): number | undefined {
  return typeof event.intensity === "number" ? event.intensity : undefined
}

function getContinuityStep(event: StructuredWorldEvent): number {
  return typeof event.continuityStep === "number" ? event.continuityStep : 1
}

function getNarrativeEventBackground(intensity?: number): string {
  if (typeof intensity !== "number") return "#fafafa"
  if (intensity >= 0.7) return "#f5f5f5"
  if (intensity >= 0.35) return "#f8f8f8"
  return "#fbfbfb"
}

function getStoryGroupLabel(events: StructuredWorldEvent[]): string {
  const first = events[0]

  if (!first) {
    return "世界的一小段变化"
  }

  if (first.type === "pet_hatched") {
    return "一个生命诞生了"
  }

  if (first.type === "pet_mood_changed") {
    return "它的状态出现了一点变化"
  }

  const action = first.sourceAction

  if (action === "walking") {
    return "它在周围活动了一阵"
  }

  if (action === "exploring") {
    return "它把注意力放向了外面"
  }

  if (action === "approaching") {
    return "它试着把距离拉近了一些"
  }

  if (action === "sleeping") {
    return "它进入了一段安静的休息"
  }

  if (action === "eating") {
    return "它正在回应身体的需要"
  }

  if (action === "idle") {
    return "它在原地停留了一会儿"
  }

  if (action === "observing") {
    return "它在安静观察周围"
  }

  if (action === "resting") {
    return "它在慢慢恢复状态"
  }

  if (action === "alert_idle") {
    return "它短暂进入了警觉停留"
  }

  return "世界里发生了一段变化"
}

function buildStoryGroups(events: StructuredWorldEvent[]): EventStoryGroup[] {
  const groups: EventStoryGroup[] = []

  for (const event of events) {
    const continuityId = getContinuityId(event)
    const lastGroup = groups[groups.length - 1]

    const canJoinLastGroup =
      !!lastGroup &&
      !!continuityId &&
      !!lastGroup.continuityId &&
      lastGroup.continuityId === continuityId

    if (canJoinLastGroup) {
      lastGroup.events.push(event)
      lastGroup.endedAt = {
        day: event.day,
        hour: event.hour,
      }
      continue
    }

    groups.push({
      id: continuityId || event.id,
      continuityId,
      events: [event],
      startedAt: {
        day: event.day,
        hour: event.hour,
      },
      endedAt: {
        day: event.day,
        hour: event.hour,
      },
    })
  }

  return groups
}

function getGroupBackground(group: EventStoryGroup): string {
  const firstEvent = group.events[0]
  const intensity = firstEvent ? getEventIntensity(firstEvent) : undefined
  return getNarrativeEventBackground(intensity)
}

function isEndEvent(event: StructuredWorldEvent): boolean {
  return event.type === "pet_action_end"
}

export default function WorldPage() {
  const [world, setWorld] = useState<WorldState | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const engineRef = useRef<WorldEngine | null>(null)

  useEffect(() => {
    const engine = new WorldEngine()

    engine.onUpdate = (state) => {
      setWorld(state)
    }

    engineRef.current = engine
    engine.start()

    return () => {
      engine.stop()
      engineRef.current = null
    }
  }, [])

  function handleStart() {
    if (!engineRef.current || isRunning) return
    engineRef.current.start()
    setIsRunning(true)
  }

  function handleStop() {
    if (!engineRef.current) return
    engineRef.current.stop()
    setIsRunning(false)
  }

  const pet = world?.pet ?? null
  const butler = world?.butler ?? null
  const home = world?.home ?? null
  const incubator = world?.incubator ?? null
  const events = world?.events

  const timeline = pet?.timelineSnapshot
  const timelineState = timeline?.state
  const timelineTrajectory = timeline?.trajectory
  const timelineFortune = timeline?.fortune

  const displayEnergy = timelineState?.physical.energy ?? pet?.energy ?? 0
  const displayHunger = timelineState?.physical.hunger ?? pet?.hunger ?? 0
  const shownHunger = 100 - displayHunger

  const innateTemperament = pet
    ? getInnateTemperamentLabel(pet.personalityProfile.summaries)
    : "-"

  const currentPhase = pet
    ? getCurrentPhaseLabel({
        phaseTag: timelineFortune?.phaseTag,
        period: world?.timeState?.period,
        action: pet.action,
        mood: pet.mood,
        energy: displayEnergy,
        hunger: displayHunger,
      })
    : "-"

  const behaviorSignature = pet
    ? getBehaviorSignature({
        action: pet.action,
        mood: pet.mood,
        energy: displayEnergy,
        hunger: displayHunger,
        emotionalLabel: timelineState?.emotional.label,
        cognitiveLabel: timelineState?.cognitive.label,
        relationalLabel: timelineState?.relational.label,
        drivePrimary: timelineState?.drive.primary,
      })
    : []

  const narrativeEvents = useMemo(() => {
    return getNarrativeEvents(events ?? [])
  }, [events])

  const storyGroups = useMemo(() => {
    return buildStoryGroups(narrativeEvents)
  }, [narrativeEvents])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 20,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>AI-PET-WORLD</h1>
          <div style={{ color: "#666", marginTop: 6, fontSize: 14 }}>
            这里展示的是生命体的表现层、状态层与事件层，不展示底层推演细节。
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleStart}
            disabled={isRunning}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: isRunning ? "#eee" : "#fff",
              cursor: isRunning ? "not-allowed" : "pointer",
            }}
          >
            启动世界
          </button>

          <button
            onClick={handleStop}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            停止世界
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <InfoCard title="世界状态">
          <InfoRow label="运行状态" value={isRunning ? "运行中" : "已停止"} />
          <InfoRow label="Tick" value={world?.tick ?? "-"} />
          <InfoRow label="当前时间" value={world?.time ?? "-"} />
          <InfoRow
            label="时间阶段"
            value={
              world?.timeState?.period
                ? PERIOD_LABELS[world.timeState.period] || world.timeState.period
                : "-"
            }
          />
        </InfoCard>

        <InfoCard title="孵化器">
          <InfoRow label="当前状态" value={incubator?.status ?? "-"} />
          <ProgressBar label="孵化进度" value={incubator?.progress ?? 0} />
          <ProgressBar label="稳定度" value={incubator?.stability ?? 0} />
        </InfoCard>

        <InfoCard title="🏠 家园">
          <InfoRow label="家园等级" value={home?.level ?? "-"} />
          <InfoRow label="当前状态" value={home?.status ?? "-"} />
          <ProgressBar label="建造进度" value={home?.progress ?? 0} />
        </InfoCard>

        <InfoCard title="🧹 管家">
          <InfoRow label="名字" value={butler?.name ?? "-"} />
          <InfoRow
            label="当前职责"
            value={
              butler?.task ? BUTLER_TASK_LABELS[butler.task] || butler.task : "-"
            }
          />
        </InfoCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(340px, 1.1fr) minmax(340px, 0.9fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <InfoCard title="当前生命体">
          {!pet ? (
            <div style={{ color: "#666", fontSize: 14, lineHeight: 1.8 }}>
              当前生命体尚未出生。<br />
              出生之后，这里会展示它的先天气质、当前阶段、状态与行为表现。
            </div>
          ) : (
            <>
              <InfoRow label="名字" value={pet.name} />
              <InfoRow label="先天气质" value={innateTemperament} />
              <InfoRow label="当前阶段" value={currentPhase} />
              <InfoRow
                label="当前行为"
                value={PET_ACTION_LABELS[pet.action] || pet.action}
              />
              <InfoRow
                label="当前状态"
                value={
                  timelineState?.emotional.label
                    ? TIMELINE_EMOTIONAL_LABELS[timelineState.emotional.label] ||
                      timelineState.emotional.label
                    : PET_MOOD_LABELS[pet.mood] || pet.mood
                }
              />

              <div style={{ marginTop: 12 }}>
                <ProgressBar label="精力" value={displayEnergy} />
                <ProgressBar
                  label="饥饿"
                  value={displayHunger}
                  displayValue={shownHunger}
                  reverse
                />
              </div>
            </>
          )}
        </InfoCard>

        <InfoCard title="🌫 当前表现解读">
          {!pet ? (
            <div style={{ color: "#666", fontSize: 14 }}>
              生命体出生后，这里会显示它当前正在呈现出来的状态标签。
            </div>
          ) : (
            <>
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>当前表现</div>

                {behaviorSignature.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    {behaviorSignature.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: "#666" }}>当前暂无明显表现特征。</div>
                )}
              </div>

              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  当前状态层
                </div>

                <InfoRow
                  label="情绪状态"
                  value={
                    timelineState?.emotional.label
                      ? TIMELINE_EMOTIONAL_LABELS[timelineState.emotional.label] ||
                        timelineState.emotional.label
                      : "-"
                  }
                />

                <InfoRow
                  label="认知状态"
                  value={
                    timelineState?.cognitive.label
                      ? TIMELINE_COGNITIVE_LABELS[timelineState.cognitive.label] ||
                        timelineState.cognitive.label
                      : "-"
                  }
                />

                <InfoRow
                  label="关系状态"
                  value={
                    timelineState?.relational.label
                      ? TIMELINE_RELATIONAL_LABELS[timelineState.relational.label] ||
                        timelineState.relational.label
                      : "-"
                  }
                />

                <InfoRow
                  label="当前驱动"
                  value={
                    timelineState?.drive.primary
                      ? TIMELINE_DRIVE_LABELS[timelineState.drive.primary] ||
                        timelineState.drive.primary
                      : "-"
                  }
                />
              </div>

              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  当前生命走向
                </div>

                <InfoRow
                  label="当前路径"
                  value={
                    timelineTrajectory?.branchTag
                      ? TIMELINE_BRANCH_LABELS[timelineTrajectory.branchTag] ||
                        timelineTrajectory.branchTag
                      : "-"
                  }
                />

                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#444" }}>
                  {timelineTrajectory?.summary || "当前尚未形成明确的生命轨迹摘要。"}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  当前阶段说明
                </div>

                <InfoRow
                  label="阶段标签"
                  value={
                    timelineFortune?.phaseTag
                      ? TIMELINE_FORTUNE_PHASE_LABELS[timelineFortune.phaseTag] ||
                        timelineFortune.phaseTag
                      : currentPhase
                  }
                />

                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#444" }}>
                  {timelineFortune?.summary || "当前阶段整体较平稳。"}
                </div>
              </div>
            </>
          )}
        </InfoCard>
      </div>

      {pet && (
        <InfoCard title="🫧 当前气质摘要">
          {pet.personalityProfile.summaries?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {pet.personalityProfile.summaries
                .filter(
                  (item) =>
                    !/[命宫|主星|紫微|天机|天梁|天同|太阴|太阳|巨门|贪狼|破军|武曲|廉贞|天府|天相|七杀]/.test(
                      item
                    )
                )
                .slice(0, 4)
                .map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
            </ul>
          ) : (
            <div style={{ color: "#666" }}>当前暂无摘要。</div>
          )}
        </InfoCard>
      )}

      <div style={{ marginTop: 20 }}>
        <InfoCard title="世界正在发生">
          {storyGroups.length === 0 ? (
            <div style={{ color: "#666", fontSize: 14 }}>
              这里还很安静，似乎还没有什么明显的变化。
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                maxHeight: 560,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              {storyGroups.map((group) => {
                const firstEvent = group.events[0]
                const groupLabel = getStoryGroupLabel(group.events)
                const groupBackground = getGroupBackground(group)

                return (
                  <div
                    key={group.id}
                    style={{
                      borderRadius: 14,
                      border: "1px solid #e8e8e8",
                      background: groupBackground,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 14px 10px 14px",
                        borderBottom: "1px solid #ececec",
                        background: "#ffffffcc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#222",
                            }}
                          >
                            {groupLabel}
                          </div>

                          {firstEvent?.petName && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#777",
                              }}
                            >
                              {firstEvent.petName}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#999",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Day {group.startedAt.day} · {group.startedAt.hour}:00
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                      }}
                    >
                      {group.events.map((event, eventIndex) => {
                        const continuityStep = getContinuityStep(event)
                        const isFirstLine = eventIndex === 0
                        const isLastLine = eventIndex === group.events.length - 1
                        const isEndLine = isEndEvent(event)
                        const isFollow = continuityStep > 1 && !isEndLine

                        return (
                          <div
                            key={event.id}
                            style={{
                              padding: isFirstLine
                                ? "12px 14px 10px 14px"
                                : "10px 14px",
                              borderTop: isFirstLine ? "none" : "1px dashed #ececec",
                              background: isEndLine ? "#f7f7f7" : "transparent",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: 8,
                                  minWidth: 8,
                                  height: 8,
                                  borderRadius: 999,
                                  background: isEndLine
                                    ? "#b5b5b5"
                                    : isFollow
                                    ? "#d0d0d0"
                                    : "#8f8f8f",
                                  marginTop: 8,
                                }}
                              />

                              <div style={{ flex: 1 }}>
                                {!isFirstLine && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#999",
                                      marginBottom: 4,
                                    }}
                                  >
                                    {isEndLine
                                      ? "这一段动作收住了"
                                      : isFollow
                                      ? `延续 · 第 ${continuityStep} 步`
                                      : "新的变化"}
                                  </div>
                                )}

                                <div
                                  style={{
                                    fontSize: isFollow ? 13.5 : 14,
                                    lineHeight: 1.75,
                                    color: isEndLine
                                      ? "#555"
                                      : isFollow
                                      ? "#444"
                                      : "#222",
                                  }}
                                >
                                  {event.message}
                                </div>

                                {isLastLine && group.events.length > 1 && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#aaa",
                                      marginTop: 6,
                                    }}
                                  >
                                    这一段变化记录到 Day {group.endedAt.day} ·{" "}
                                    {group.endedAt.hour}:00
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </InfoCard>
      </div>

      <div
        style={{
          marginTop: 20,
          color: "#777",
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        当前页面展示的是结果层与表现层：<br />
        1. 先天气质：代表生命体长期稳定的内在底盘。<br />
        2. 当前阶段：代表它在当前时间与阶段偏移下更容易显化的倾向。<br />
        3. 当前状态层：代表它此刻的情绪、认知、关系与主驱动。<br />
        4. 当前生命走向：代表它在经历累积下逐渐形成的路径。<br />
        5. 世界正在发生：代表这些倾向在世界中的连续显化。<br />
      </div>
    </div>
  )
}