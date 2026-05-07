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

export default function PPhoneLauncher({
  isOpen,
  unreadCount,
  onToggle,
}: Props) {
  const displayUnreadCount = Math.min(99, Math.max(0, unreadCount))

  return (
    <button
      className={`${styles.launcher} ${isOpen ? styles.open : ""}`}
      type="button"
      aria-pressed={isOpen}
      aria-label={isOpen ? "收起 P-Phone" : "打开 P-Phone"}
      onClick={onToggle}
    >
      <span className={styles.phoneBody}>
        <span className={styles.speakerSlot} />
        <span className={styles.phoneScreen}>
          <span className={styles.petSignal} />
        </span>
        <span className={styles.homeBar} />
      </span>

      {displayUnreadCount > 0 && (
        <span className={styles.badge}>{displayUnreadCount}</span>
      )}
    </button>
  )
}