/**
 * 当前文件负责：展示 P-Phone 档案应用。
 */

import type { PhoneDetailPageData } from "../../../utils/phoneDetailMappers"

import styles from "@/styles/world-styles/phone/profile/p-phone-profile-app.module.css"

type Props = {
  detail: PhoneDetailPageData
  onBack: () => void
}

export default function PPhoneProfileApp({ detail, onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ‹
        </button>

        <div>
          <p>Profile</p>
          <h2>档案</h2>
        </div>
      </header>

      <section className={styles.profileCard}>
        <p>{detail.statusLabel}</p>
        <h3>{detail.subtitle}</h3>
        <span>{detail.summary}</span>
      </section>

      <div className={styles.tagList}>
        {detail.tags.slice(0, 8).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className={styles.sectionList}>
        {detail.sections.map((section) => (
          <section className={styles.infoSection} key={section.title}>
            <h4>{section.title}</h4>

            {section.rows.map((row) => (
              <article className={styles.infoRow} key={`${section.title}-${row.label}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}