/**
 * 当前文件负责：展示 P-Phone 联系人详情。
 */

import type { PPhoneContactId, PPhoneMessageThreadId } from "../PPhoneTypes"
import type { PPhoneContact } from "./pPhoneContactMappers"

import styles from "@/styles/world-styles/phone/contacts/p-phone-contact-detail.module.css"

type Props = {
  contact: PPhoneContact
  onBack: () => void
  onOpenMessage: (threadId: PPhoneMessageThreadId) => void
  onOpenCall: (contactId: PPhoneContactId) => void
}

function toThreadId(contactId: PPhoneContactId): PPhoneMessageThreadId {
  if (contactId === "p-system") return "p-system"
  if (contactId === "world-notice") return "world-notice"

  return "butler"
}

export default function PPhoneContactDetail({
  contact,
  onBack,
  onOpenMessage,
  onOpenCall,
}: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          type="button"
          aria-label="返回联系人"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <p>{contact.role}</p>
          <h2>{contact.name}</h2>
        </div>
      </header>

      <section className={styles.profileCard}>
        <span className={styles.avatar}>
          {contact.name.slice(0, 1).toUpperCase()}
        </span>

        <h3>{contact.name}</h3>
        <p>{contact.description}</p>
      </section>

      <div className={styles.actionGrid}>
        <button type="button" onClick={() => onOpenMessage(toThreadId(contact.id))}>
          短信
        </button>

        <button type="button" onClick={() => onOpenCall(contact.id)}>
          电话
        </button>
      </div>
    </div>
  )
}