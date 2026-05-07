/**
 * 当前文件负责：展示 P-Phone 短信会话列表。
 */

import type { PPhoneMessageThreadId } from "../PPhoneTypes"
import type { PPhoneMessageThread } from "./pPhoneMessageMappers"

import styles from "@/styles/world-styles/phone/messages/p-phone-messages-app.module.css"

type Props = {
  threads: PPhoneMessageThread[]
  onBack: () => void
  onOpenThread: (threadId: PPhoneMessageThreadId) => void
}

export default function PPhoneMessagesApp({
  threads,
  onBack,
  onOpenThread,
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
          <h2>短信</h2>
        </div>
      </header>

      <div className={styles.threadList}>
        {threads.map((thread) => (
          <button
            className={styles.threadItem}
            key={thread.id}
            type="button"
            onClick={() => onOpenThread(thread.id)}
          >
            <span className={styles.avatar}>
              {thread.title.slice(0, 1).toUpperCase()}
            </span>

            <span className={styles.threadBody}>
              <span className={styles.threadTop}>
                <strong>{thread.title}</strong>

                {thread.unreadCount > 0 && (
                  <em>{Math.min(99, thread.unreadCount)}</em>
                )}
              </span>

              <small>{thread.subtitle}</small>
              <span className={styles.preview}>{thread.latestText}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}