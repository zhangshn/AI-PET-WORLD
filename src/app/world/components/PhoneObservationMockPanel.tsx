/**
 * 当前文件负责：预览未来手机观察模块。
 */

import type { WorldEvent } from "@/types/event"

import { buildPhoneObservationModuleData } from "../utils/phoneObservationMappers"

import styles from "@/styles/world-styles/phone-observation-mock-panel.module.css"

type Props = {
  events: WorldEvent[]
}

export default function PhoneObservationMockPanel({ events }: Props) {
  const moduleData = buildPhoneObservationModuleData(events, 20)

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PHONE MODULE MOCK</p>
          <h2 className={styles.title}>手机观察模块</h2>
        </div>

        <span className={styles.badge}>
          {moduleData.totalCount}
        </span>
      </div>

      <div className={styles.phone}>
        <div className={styles.phoneTopBar}>
          <span>AI-PET-WORLD</span>
          <strong>观察</strong>
        </div>

        <div className={styles.moduleHeader}>
          <div>
            <p className={styles.moduleEyebrow}>
              OBSERVATION
            </p>

            <h3 className={styles.moduleTitle}>
              {moduleData.moduleTitle}
            </h3>
          </div>

          <span className={styles.unreadBadge}>
            {moduleData.unreadCount}
          </span>
        </div>

        <p className={styles.subtitle}>
          {moduleData.moduleSubtitle}
        </p>

        <article className={styles.latestCard}>
          <span>最新记录</span>
          <strong>{moduleData.latestTitle}</strong>
          <p>{moduleData.latestSummary}</p>
        </article>

        <div className={styles.logList}>
          {moduleData.groups.length === 0 && (
            <div className={styles.empty}>
              暂无观察记录。
            </div>
          )}

          {moduleData.groups.map((group) => (
            <section
              className={styles.group}
              key={group.groupLabel}
            >
              <h4>{group.groupLabel}</h4>

              <div className={styles.groupItems}>
                {group.items.map((item) => (
                  <article
                    className={styles.logItem}
                    key={item.id}
                  >
                    <div className={styles.logTopRow}>
                      <span>{item.category}</span>
                      <strong>{item.timeLabel}</strong>
                    </div>

                    <div className={styles.logTitleRow}>
                      {item.focus && (
                        <span className={styles.focus}>
                          {item.focus}
                        </span>
                      )}

                      <h5>{item.title}</h5>
                    </div>

                    <p>{item.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}