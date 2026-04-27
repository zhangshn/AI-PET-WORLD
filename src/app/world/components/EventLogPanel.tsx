/**
 * 当前文件负责：
 * 1. 世界观察日记展示
 * 2. 展示 AI 世界最近发生的叙事
 * 3. 强化“观察感”
 * 4. 隐藏工程化调试气息
 */

import type { WorldEvent } from "@/types/event"

import styles from "@/styles/world-styles/event-log-panel.module.css"

type Props = {
  events: WorldEvent[]
}

function buildNarrativeLabel(type: string): string {
  switch (type) {
    case "pet_action_narrative":
      return "行为叙事"

    case "pet_action_end":
      return "行为结束"

    case "pet_mood_changed":
      return "情绪变化"

    case "pet_fortune_phase_changed":
      return "命运阶段"

    case "pet_trajectory_branch_changed":
      return "生命偏移"

    case "interaction":
      return "世界互动"

    default:
      return "世界记录"
  }
}

function getTimeLabel(day: number, hour: number) {
  return `Day ${day} · ${hour}:00`
}

export default function EventLogPanel({ events }: Props) {
  const safeEvents = Array.isArray(events) ? events : []
  const reversed = [...safeEvents].reverse().slice(0, 24)

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>WORLD OBSERVATION</div>

          <h2 className={styles.title}>世界观察日记</h2>
        </div>

        <div className={styles.count}>
          {safeEvents.length}
        </div>
      </div>

      <div className={styles.logList}>
        {reversed.length === 0 && (
          <div className={styles.empty}>
            世界暂时还很安静。
          </div>
        )}

        {reversed.map((event) => (
          <article key={event.id} className={styles.eventItem}>
            <div className={styles.topRow}>
              <span className={styles.time}>
                {getTimeLabel(event.day, event.hour)}
              </span>

              <span className={styles.type}>
                {buildNarrativeLabel(event.type)}
              </span>
            </div>

            {event.petName && (
              <div className={styles.petName}>
                {event.petName}
              </div>
            )}

            <p className={styles.message}>
              {event.message}
            </p>

            <div className={styles.footer}>
              {event.sourceAction && (
                <span>当前行为：{event.sourceAction}</span>
              )}

              {event.intensity !== undefined && (
                <span>强度 {event.intensity}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}