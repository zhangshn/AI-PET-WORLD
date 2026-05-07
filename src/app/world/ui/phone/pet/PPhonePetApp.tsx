/**
 * 当前文件负责：展示 P-Phone 宠物公开档案。
 */

import type { PhoneDetailPageData } from "../../../utils/phoneDetailMappers"

import styles from "@/styles/world-styles/phone/pet/p-phone-pet-app.module.css"

type Props = {
  detail: PhoneDetailPageData
  onBack: () => void
}

export default function PPhonePetApp({ detail, onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ‹
        </button>

        <div>
          <p>Pet</p>
          <h2>宠物</h2>
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

            {section.description && <p>{section.description}</p>}

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