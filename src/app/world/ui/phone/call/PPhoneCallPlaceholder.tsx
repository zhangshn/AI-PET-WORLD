/**
 * 当前文件负责：展示 P-Phone 电话功能占位页。
 */

import type { PPhoneContact } from "../contacts/pPhoneContactMappers"

import styles from "@/styles/world-styles/phone/call/p-phone-call-placeholder.module.css"

type Props = {
  contact: PPhoneContact
  onBack: () => void
}

export default function PPhoneCallPlaceholder({ contact, onBack }: Props) {
  return (
    <div className={styles.page}>
      <button
        className={styles.backButton}
        type="button"
        aria-label="返回联系人"
        onClick={onBack}
      >
        ‹
      </button>

      <section className={styles.callCard}>
        <span className={styles.avatar}>
          {contact.name.slice(0, 1).toUpperCase()}
        </span>

        <p>正在准备通话功能</p>
        <h2>{contact.name}</h2>

        <span className={styles.status}>
          电话功能未来可接入 AI 语音或自研语音系统。
        </span>
      </section>
    </div>
  )
}