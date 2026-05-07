/**
 * 当前文件负责：展示 P-Phone 桌面应用入口。
 */

import type { PPhoneAppId, PPhoneAppShortcut } from "../PPhoneTypes"

import PPhoneIcon from "../PPhoneIcon"

import styles from "@/styles/world-styles/phone/home/p-phone-home-screen.module.css"

type Props = {
  timeLabel: string
  periodLabel: string
  weatherLabel: string
  shortcuts: PPhoneAppShortcut[]
  onOpenApp: (appId: PPhoneAppId) => void
}

export default function PPhoneHomeScreen({
  timeLabel,
  periodLabel,
  weatherLabel,
  shortcuts,
  onOpenApp,
}: Props) {
  return (
    <div className={styles.homeScreen}>
      <section className={styles.hero}>
        <p>P-Phone</p>
        <h1>{timeLabel}</h1>
        <span>
          今天 · {periodLabel} · {weatherLabel}
        </span>
      </section>

      <div className={styles.appGrid}>
        {shortcuts.map((shortcut) => (
          <button
            className={styles.appButton}
            key={shortcut.id}
            type="button"
            onClick={() => onOpenApp(shortcut.id)}
          >
            <span className={styles.iconWrap}>
              <PPhoneIcon kind={shortcut.icon} />

              {Boolean(shortcut.badgeCount) && (
                <strong className={styles.badge}>
                  {Math.min(99, shortcut.badgeCount ?? 0)}
                </strong>
              )}
            </span>

            <strong>{shortcut.title}</strong>
            <small>{shortcut.subtitle}</small>
          </button>
        ))}
      </div>
    </div>
  )
}