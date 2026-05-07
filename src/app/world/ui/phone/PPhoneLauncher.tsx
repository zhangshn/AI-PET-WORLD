"use client"

/**
 * 当前文件负责：展示 /world 右下角 P-Phone 手机入口。
 */

import styles from "@/styles/world-styles/phone/p-phone-launcher.module.css"

type Props = {
  isOpen: boolean
  unreadCount: number
  onToggle: () => void
}

function formatUnreadCount(unreadCount: number): string {
  if (unreadCount > 99) return "99+"

  return String(Math.max(0, unreadCount))
}

export default function PPhoneLauncher({
  isOpen,
  unreadCount,
  onToggle,
}: Props) {
  const hasUnread = unreadCount > 0

  return (
    <button
      className={`${styles.launcher} ${isOpen ? styles.open : ""}`}
      type="button"
      aria-pressed={isOpen}
      aria-label={isOpen ? "收起 P-Phone" : "打开 P-Phone"}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return

        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <span className={styles.phoneBody}>
        <span className={styles.speakerSlot} />
        <span className={styles.phoneScreen}>
          <span className={styles.petSignal} />
        </span>
        <span className={styles.homeBar} />
      </span>

      {hasUnread && <span className={styles.badge}>{formatUnreadCount(unreadCount)}</span>}
    </button>
  )
}