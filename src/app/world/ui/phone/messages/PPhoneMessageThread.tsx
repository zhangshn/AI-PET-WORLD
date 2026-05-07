/**
 * 当前文件负责：展示 P-Phone 单个短信线程。
 */

import type {
  PPhoneMessageItem,
  PPhoneMessageThread,
} from "./pPhoneMessageMappers"

import styles from "@/styles/world-styles/phone/messages/p-phone-message-thread.module.css"

type Props = {
  thread: PPhoneMessageThread
  onBack: () => void
}

function getBubbleClassName(sender: PPhoneMessageItem["sender"]): string {
  if (sender === "player") return styles.playerBubble
  if (sender === "butler") return styles.butlerBubble
  if (sender === "system") return styles.systemBubble

  return styles.worldBubble
}

export default function PPhoneMessageThread({ thread, onBack }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          type="button"
          aria-label="返回短信列表"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <p>{thread.subtitle}</p>
          <h2>{thread.title}</h2>
        </div>
      </header>

      <div className={styles.messageList}>
        {thread.messages.length === 0 && (
          <article className={styles.emptyState}>暂时没有短信。</article>
        )}

        {thread.messages.map((message) => (
          <article
            className={`${styles.messageBubble} ${getBubbleClassName(
              message.sender
            )}`}
            key={message.id}
          >
            <span>{message.senderName}</span>
            <p>{message.text}</p>
            <small>{message.timeLabel}</small>
          </article>
        ))}
      </div>

      <form className={styles.inputBar}>
        <input
          aria-label={`发送短信给${thread.title}`}
          placeholder={`发送短信给${thread.title}`}
          type="text"
        />

        <button type="button">发送</button>
      </form>
    </div>
  )
}