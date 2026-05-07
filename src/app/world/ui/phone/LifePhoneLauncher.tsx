"use client"

/**
 * 当前文件负责：展示 /world 右下角 Life Phone 入口按钮。
 */

import styles from "@/styles/world-styles/phone/life-phone-launcher.module.css"

type Props = {
  isOpen: boolean
  unreadCount: number
  onToggle: () => void
}

export default function LifePhoneLauncher({
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
      aria-label={isOpen ? "关闭 Life Phone" : "打开 Life Phone"}
      onClick={onToggle}
    >
      <span className={styles.deviceIcon}>
        <span className={styles.deviceScreen} />
      </span>

      <span className={styles.textBlock}>
        <span className={styles.eyebrow}>LIFE PHONE</span>
        <strong>{isOpen ? "关闭终端" : "打开终端"}</strong>
      </span>

      {displayUnreadCount > 0 && (
        <span className={styles.badge}>{displayUnreadCount}</span>
      )}
    </button>
  )
}