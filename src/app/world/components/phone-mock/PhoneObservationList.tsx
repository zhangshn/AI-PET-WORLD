/**
 * 当前文件负责：展示手机观察模块中的日志列表。
 */

import type { PhoneObservationEntryModuleData } from "../../utils/phoneModuleMappers"

import styles from "@/styles/world-styles/phone-home-mock-panel.module.css"

type Props = {
  observationModule: PhoneObservationEntryModuleData
}

export default function PhoneObservationList({ observationModule }: Props) {
  const observation = observationModule.observation

  return (
    <section className={styles.observationPanel}>
      <div className={styles.observationHeader}>
        <span>观察列表</span>
        <strong>{observation.totalCount}</strong>
      </div>

      <div className={styles.observationList}>
        {observation.groups.length === 0 && (
          <div className={styles.empty}>暂无观察记录。</div>
        )}

        {observation.groups.map((group) => (
          <section className={styles.group} key={group.groupLabel}>
            <h5>{group.groupLabel}</h5>

            <div className={styles.groupItems}>
              {group.items.map((item) => (
                <article className={styles.logItem} key={item.id}>
                  <div className={styles.logTopRow}>
                    <span>{item.category}</span>
                    <strong>{item.timeLabel}</strong>
                  </div>

                  <div className={styles.logTitleRow}>
                    {item.focus && (
                      <span className={styles.focus}>{item.focus}</span>
                    )}

                    <h6>{item.title}</h6>
                  </div>

                  <p>{item.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}