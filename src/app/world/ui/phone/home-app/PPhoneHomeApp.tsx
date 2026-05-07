/**
 * 当前文件负责：展示 P-Phone 家园应用。
 */

import type { PhoneDetailPageData } from "../../../utils/phoneDetailMappers"

import styles from "@/styles/world-styles/phone/home-app/p-phone-home-app.module.css"

type Props = {
  detail: PhoneDetailPageData
  onBack: () => void
}

export default function PPhoneHomeApp({ detail, onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ‹
        </button>

        <div>
          <p>Home</p>
          <h2>家园</h2>
        </div>
      </header>

      <section className={styles.profileCard}>
        <p>{detail.statusLabel}</p>
        <h3>{detail.subtitle}</h3>
        <span>{detail.summary}</span>
      </section>

      <div className={styles.sectionList}>
        {detail.sections.map((section) => (
          <section className={styles.infoSection} key={section.title}>
            <h4>{section.title}</h4>

            {section.rows.map((row) => (
              <article className={styles.infoRow} key={`${section.title}-${row.label}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>

                {row.meter && (
                  <div className={styles.meterTrack}>
                    <div
                      className={styles.meterFill}
                      style={{
                        width: `${Math.min(100, Math.max(0, row.meter.value))}%`,
                      }}
                    />
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}