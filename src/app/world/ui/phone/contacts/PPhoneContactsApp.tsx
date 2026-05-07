/**
 * 当前文件负责：展示 P-Phone 联系人列表。
 */

import type { PPhoneContactId } from "../PPhoneTypes"
import type { PPhoneContact } from "./pPhoneContactMappers"

import styles from "@/styles/world-styles/phone/contacts/p-phone-contacts-app.module.css"

type Props = {
  contacts: PPhoneContact[]
  onBack: () => void
  onOpenContact: (contactId: PPhoneContactId) => void
}

export default function PPhoneContactsApp({
  contacts,
  onBack,
  onOpenContact,
}: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          type="button"
          aria-label="返回 P-Phone 桌面"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <p>P-Phone</p>
          <h2>联系人</h2>
        </div>
      </header>

      <div className={styles.contactList}>
        {contacts.map((contact) => (
          <button
            className={styles.contactItem}
            key={contact.id}
            type="button"
            onClick={() => onOpenContact(contact.id)}
          >
            <span className={styles.avatar}>
              {contact.name.slice(0, 1).toUpperCase()}
            </span>

            <span>
              <strong>{contact.name}</strong>
              <small>{contact.role}</small>
              <em>{contact.description}</em>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}