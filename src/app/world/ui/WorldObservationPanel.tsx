/**
 * 当前文件负责：展示 world 页面右侧观察记录。
 */

import type { WorldEvent } from "@/types/event"

import {
  getDedupedLatestWorldObservations,
  getWorldObservationCategoryLabel,
  rewriteWorldObservationMessage,
} from "../utils/worldObservationMappers"

import styles from "@/styles/world-styles/world-observation-panel.module.css"

type Props = {
  events: WorldEvent[]
}

export default function WorldObservationPanel({ events }: Props) {
  const latest = getDedupedLatestWorldObservations(events)

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
                {getWorldObservationCategoryLabel(event)}
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
              {rewriteWorldObservationMessage(event)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}