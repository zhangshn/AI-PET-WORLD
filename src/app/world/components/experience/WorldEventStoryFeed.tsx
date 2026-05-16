/**
 * 当前文件负责展示世界事件故事流。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type WorldEventStoryFeedProps = {
  events: WorldExperienceModel["events"]
}

export function WorldEventStoryFeed({ events }: WorldEventStoryFeedProps) {
  return (
    <section style={{ ...styles.card, ...styles.fullWidth }}>
      <h2 style={styles.cardTitle}>最近发生的事</h2>
      <div style={styles.eventList}>
        {events.map((event) => (
          <article
            key={event.id}
            style={{
              ...styles.event,
              borderLeftColor: getEventColor(event.tone),
            }}
          >
            <p style={styles.body}>{event.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function getEventColor(
  tone: WorldExperienceModel["events"][number]["tone"]
): string {
  if (tone === "building") return "#ffe082"
  if (tone === "care") return "#bbdefb"
  if (tone === "complete") return "#c8e6c9"
  return "#9fb0b9"
}
