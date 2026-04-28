/**
 * Current file responsibility:
 * render recent world observations in a stable, readable way.
 */

import type { WorldEvent } from "@/types/event"

import styles from "@/styles/world-styles/world-observation-panel.module.css"

type Props = {
  events: WorldEvent[]
}

function getCategoryLabel(type: WorldEvent["type"]): string {
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

function getActionLabel(action?: string): string | null {
  if (!action) return null

  switch (action) {
    case "sleeping":
      return "正在休息，恢复状态中。"
    case "eating":
      return "正在进食，补充体力。"
    case "walking":
      return "在场景里缓慢移动。"
    case "exploring":
      return "正在探索新的区域。"
    case "approaching":
      return "试着靠近新的目标。"
    case "idle":
      return "暂时停在原地观察。"
    case "observing":
      return "在安静观察周围变化。"
    case "resting":
      return "把节奏放慢，进入恢复阶段。"
    case "alert_idle":
      return "保持警觉，暂时没有进一步动作。"
    default:
      return null
  }
}

function rewriteMessage(event: WorldEvent): string {
  const petName = event.petName ?? "宠物"
  const actionLabel = getActionLabel(event.sourceAction)

  switch (event.type) {
    case "pet_hatched":
      return `${petName}刚刚来到这个世界，正在适应周围环境。`
    case "pet_action_changed":
    case "pet_action_narrative":
      return actionLabel ? `${petName}${actionLabel}` : event.message
    case "pet_action_end":
      return `${petName}完成了上一段行为，状态正在切换。`
    case "pet_mood_changed":
      return `${petName}的情绪发生了变化。`
    case "pet_fortune_phase_changed":
      return `${petName}进入了新的阶段倾向。`
    case "pet_trajectory_branch_changed":
      return `${petName}的成长轨迹出现了新的分支。`
    case "time_period_changed":
      return "光线和环境在变化，世界进入了新的时间段。"
    case "incubator_progress_changed":
      return "孵化器的状态有了新的推进，管家在持续关注。"
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
                {getCategoryLabel(event.type)}
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
