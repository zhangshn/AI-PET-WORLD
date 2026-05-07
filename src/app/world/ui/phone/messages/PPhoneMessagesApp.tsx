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

function getThreadAvatarLabel(thread: PPhoneMessageThread): string {
  if (thread.id === "butler") return "管"
  if (thread.id === "world-notice") return "世"

  return thread.title.slice(0, 1).toUpperCase()
}

function getThreadStatusLabel(thread: PPhoneMessageThread): string {
  if (thread.unreadCount > 0) {
    return `${thread.unreadCount} 条未读`
  }

  if (thread.messages.length === 0) {
    return "暂无新内容"
  }

  return "已读"
}

function buildThreadItemClassName(thread: PPhoneMessageThread): string {
  const classNames = [styles.threadItem]

  if (thread.messages.length === 0) {
    classNames.push(styles.quietThread)
  }

  return classNames.join(" ")
}

export default function PPhoneMessagesApp({
  threads,
  onBack,
  onOpenThread,
}: Props) {
  const hasAnyMessage = threads.some((thread) => thread.messages.length > 0)

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
            className={buildThreadItemClassName(thread)}
            key={thread.id}
            type="button"
            onClick={() => onOpenThread(thread.id)}
          >
            <span className={styles.avatar}>{getThreadAvatarLabel(thread)}</span>

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

            <span className={styles.threadStatus}>
              {getThreadStatusLabel(thread)}
            </span>
          </button>
        ))}
      </div>

      {!hasAnyMessage && (
        <section className={styles.emptyInbox}>
          <strong>暂无短信</strong>
          <p>有重要变化时，管家或世界通知会出现在这里。</p>
        </section>
      )}
    </div>
  )
}