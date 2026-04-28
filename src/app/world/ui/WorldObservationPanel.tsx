/**
 * 当前文件负责：世界观察叙事流。
 */

import type { WorldEvent } from "@/types/event"

import styles from "@/styles/world-styles/world-observation-panel.module.css"

type Props = {
  events: WorldEvent[]
}

function getCategoryLabel(type: string): string {
  if (type.includes("pet")) return "生命观察"
  if (type.includes("incubator")) return "孵化记录"
  if (type.includes("time")) return "环境变化"
  if (type.includes("mood")) return "情绪变化"
  if (type.includes("interaction")) return "世界互动"

  return "世界记录"
}

function rewriteMessage(event: WorldEvent): string {
  const message = event.message

  if (message.includes("孵化器的进度又向前推进了一些")) {
    return "孵化器里传来轻微的稳定波动。管家靠近检查了一会儿，确认里面的新生命仍在缓慢成长。"
  }

  if (message.includes("管家正在照看孵化器")) {
    return "管家停在孵化器旁，安静地确认温度、稳定度和周围环境。"
  }

  if (message.includes("时间进入新的阶段")) {
    return "光线慢慢改变了草地的颜色，世界进入了新的时间段。"
  }

  if (message.includes("Mochi诞生出世了")) {
    return "Mochi 从孵化器中醒来。它没有立刻行动，只是安静地感受这个陌生的世界。"
  }

  if (message.includes("正在休息")) {
    return "Mochi 放慢了动作，停在较安静的位置恢复精力。"
  }

  if (message.includes("安静地看着周围")) {
    return "Mochi 停在原地观察了一会儿，像是在确认这个世界的边界。"
  }

  if (message.includes("观察")) {
    return message
  }

  return message
}

function getEventDisplayKey(event: WorldEvent): string {
  return [
    event.type,
    event.petName ?? "",
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