/**
 * 当前文件负责：展示 world 页面右侧观察记录。
 */

import type { NarrativeType, WorldEvent } from "@/types/event"

import styles from "@/styles/world-styles/world-observation-panel.module.css"

type Props = {
  events: WorldEvent[]
}

function getCategoryLabel(type: WorldEvent["type"], event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") {
    return "管家机会"
  }

  if (interactionKind === "pet_recovery") {
    return "恢复记录"
  }

  switch (type) {
    case "pet_hatched":
    case "pet_action_changed":
    case "pet_action_narrative":
    case "pet_action_end":
    case "pet_mood_changed":
    case "pet_fortune_phase_changed":
    case "pet_trajectory_branch_changed":
      return "生命观察"
    case "incubator_progress_changed":
      return "孵化记录"
    case "time_period_changed":
      return "环境变化"
    case "interaction":
      return "世界互动"
    default:
      return "世界记录"
  }
}

function getNarrativeLabel(narrativeType?: NarrativeType): string {
  switch (narrativeType) {
    case "observe_environment":
      return "观察环境"
    case "discover":
      return "发现变化"
    case "approach_target":
      return "尝试靠近"
    case "keep_distance":
      return "保持距离"
    case "satisfy_need":
      return "满足需求"
    case "recover":
      return "恢复状态"
    case "linger":
      return "短暂停留"
    case "unknown":
      return "自然反应"
    default:
      return "自然反应"
  }
}

function getActionObservation(action?: string): string | null {
  switch (action) {
    case "sleeping":
      return "进入了更深的休息状态，外界刺激对它的影响暂时降低。"
    case "eating":
      return "正在补充食物，当前行为明显受到生存需求牵引。"
    case "walking":
      return "开始移动，但节奏并不急促，像是在重新确认周围的位置关系。"
    case "exploring":
      return "正在扩大活动范围，会边走边停下来感知附近变化。"
    case "approaching":
      return "正在靠近某个目标，但是否继续接触仍取决于它自己的判断。"
    case "idle":
      return "暂时停在原地，没有立刻进入新的行为。"
    case "observing":
      return "正在观察周围变化，行动前的判断过程变得更明显。"
    case "resting":
      return "放慢了节奏，优先恢复体力和安全感。"
    case "alert_idle":
      return "保持警觉，暂时没有继续靠近或探索。"
    default:
      return null
  }
}

function getIntensityText(intensity?: number): string {
  if (typeof intensity !== "number") return ""

  if (intensity >= 0.75) {
    return "这次反应比较明显。"
  }

  if (intensity >= 0.45) {
    return "这次反应强度中等。"
  }

  if (intensity > 0) {
    return "这只是一个轻微反应。"
  }

  return ""
}

function getPayloadText(payload?: Record<string, unknown>): string {
  if (!payload) return ""

  const continuityStep = payload.continuityStep

  if (typeof continuityStep === "number" && continuityStep > 1) {
    return `这是连续行为里的第 ${continuityStep} 段。`
  }

  return ""
}

function rewriteButlerOpportunityMessage(event: WorldEvent): string {
  const payload = event.payload ?? {}
  const petName = event.petName ?? "宠物"
  const accepted = payload.accepted
  const opportunityType = payload.opportunityType
  const baseMessage = event.message

  if (opportunityType === "food_offer") {
    if (accepted === true) {
      return `${baseMessage} 管家只是提供食物机会，真正的进食决定来自 ${petName} 自己。`
    }

    return `${baseMessage} 这说明管家无法直接控制 ${petName}，它只能创造条件。`
  }

  if (opportunityType === "rest_offer") {
    if (accepted === true) {
      return `${baseMessage} 管家改善了环境，但休息行为仍然来自 ${petName} 当前的自主状态。`
    }

    return `${baseMessage} 恢复环境已经存在，但 ${petName} 还没有选择停下来。`
  }

  if (opportunityType === "approach_offer") {
    if (accepted === true) {
      return `${baseMessage} 这是一段关系距离正在缩短的观察信号。`
    }

    return `${baseMessage} 它还在保持自己的距离边界。`
  }

  return baseMessage
}

function rewritePetActionEvent(event: WorldEvent): string {
  const petName = event.petName ?? "宠物"
  const actionObservation = getActionObservation(event.sourceAction)
  const narrativeLabel = getNarrativeLabel(event.narrativeType)
  const intensityText = getIntensityText(event.intensity)
  const payloadText = getPayloadText(event.payload)

  const baseText = actionObservation
    ? `${petName}${actionObservation}`
    : event.message

  return [
    baseText,
    `观察倾向：${narrativeLabel}。`,
    intensityText,
    payloadText,
  ]
    .filter(Boolean)
    .join("")
}

function rewriteInteractionMessage(event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") {
    return rewriteButlerOpportunityMessage(event)
  }

  if (interactionKind === "pet_recovery") {
    return event.message
  }

  return event.message
}

function rewriteMessage(event: WorldEvent): string {
  const petName = event.petName ?? "宠物"

  switch (event.type) {
    case "pet_hatched":
      return `${petName}刚刚来到这个世界。它还没有形成稳定的行动节奏，正在通过环境、温度和管家的靠近来建立最初的安全感。`

    case "pet_action_changed":
    case "pet_action_narrative":
      return rewritePetActionEvent(event)

    case "pet_action_end":
      return `${petName}完成了上一段行为。它没有被直接命令切换动作，而是在当前状态和环境刺激之间重新做出选择。`

    case "pet_mood_changed":
      return `${petName}的情绪状态发生变化。这个变化会影响它接下来更愿意靠近、观察、探索，还是先恢复。`

    case "pet_fortune_phase_changed":
      return `${petName}进入了新的生命阶段倾向。后续行为的概率会被轻微改写，但不会变成固定脚本。`

    case "pet_trajectory_branch_changed":
      return `${petName}的成长轨迹出现了新的分支。它之后可能会更偏向某一种长期行为路径。`

    case "time_period_changed":
      return "光线、温度和环境节奏正在变化。世界进入了新的时间段，生命体的行为优先级也可能随之调整。"

    case "incubator_progress_changed":
      return "孵化器状态有了新的推进。管家会继续优先确认稳定度，但不会替未来的生命决定它将成为什么样。"

    case "interaction":
      return rewriteInteractionMessage(event)

    default:
      return event.message
  }
}

function getEventDisplayKey(event: WorldEvent): string {
  return [
    event.type,
    event.petName ?? "",
    event.sourceAction ?? "",
    event.narrativeType ?? "",
    event.continuityId ?? "",
    event.payload?.interactionKind ?? "",
    event.payload?.opportunityType ?? "",
    rewriteMessage(event),
  ].join("::")
}

function getDedupedLatestEvents(events: WorldEvent[]): WorldEvent[] {
  const latestEvents = [...events].reverse()
  const result: WorldEvent[] = []
  const usedKeys = new Set<string>()

  for (const event of latestEvents) {
    const key = getEventDisplayKey(event)

    if (usedKeys.has(key)) {
      continue
    }

    usedKeys.add(key)
    result.push(event)

    if (result.length >= 7) {
      break
    }
  }

  return result
}

export default function WorldObservationPanel({ events }: Props) {
  const latest = getDedupedLatestEvents(events)

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>OBSERVATION</div>
          <h2 className={styles.title}>世界观察</h2>
        </div>
      </div>

      <div className={styles.list}>
        {latest.length === 0 && (
          <article className={styles.empty}>
            世界暂时很安静。孵化器正在等待第一段生命反应。
          </article>
        )}

        {latest.map((event) => (
          <article key={event.id} className={styles.item}>
            <div className={styles.topRow}>
              <span className={styles.category}>
                {getCategoryLabel(event.type, event)}
              </span>

              <span className={styles.time}>
                Day {event.day} · {event.hour}:00
              </span>
            </div>

            {event.petName && (
              <div className={styles.focus}>
                {event.petName}
              </div>
            )}

            <p className={styles.message}>
              {rewriteMessage(event)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}