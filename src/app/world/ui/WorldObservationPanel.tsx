/**
 * 当前文件负责：展示 world 页面右侧观察记录。
 */

import type { WorldEvent } from "@/types/event"

import {
  buildLatestWorldObservationViewModels,
} from "../utils/worldObservationMappers"

import styles from "@/styles/world-styles/observation/world-observation-panel.module.css"

type Props = {
  events: WorldEvent[]
}

export default function WorldObservationPanel({ events }: Props) {
  const latest = buildLatestWorldObservationViewModels(events)

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>OBSERVATION</div>
          <h2 className={styles.title}>世界观察</h2>
        </div>

        <p className={styles.hint}>简短日志</p>
      </div>

      <div className={styles.list}>
        {latest.length === 0 && (
          <article className={styles.empty}>
            世界暂时很安静。管家正在等待领养中心完成宠物送达。
          </article>
        )}

        {latest.map((event) => (
          <article key={event.id} className={styles.item}>
            <div className={styles.topRow}>
              <span className={styles.category}>
                {event.category}
              </span>

              <span className={styles.time}>
                {event.timeLabel}
              </span>
            </div>

            <div className={styles.titleRow}>
              <div>
                {event.focus && (
                  <div className={styles.focus}>
                    {event.focus}
                  </div>
                )}

                <h3 className={styles.itemTitle}>
                  {event.title}
                </h3>
              </div>
            </div>

            <p className={styles.summary}>
              {event.summary}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
