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

function findShortcut(
  shortcuts: PPhoneAppShortcut[],
  appId: PPhoneAppId
): PPhoneAppShortcut | undefined {
  return shortcuts.find((shortcut) => shortcut.id === appId)
}

function buildSystemDateLabel(): string {
  const now = new Date()

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
    .format(now)
    .replace(/\s/g, "")
}

function formatBadgeCount(count: number): string {
  if (count > 99) return "99+"

  return String(count)
}

export default function PPhoneHomeScreen({
  timeLabel,
  periodLabel,
  weatherLabel,
  shortcuts,
  onOpenApp,
}: Props) {
  const systemDateLabel = buildSystemDateLabel()

  const dockShortcuts = [
    findShortcut(shortcuts, "messages"),
    findShortcut(shortcuts, "contacts"),
    findShortcut(shortcuts, "homeApp"),
    findShortcut(shortcuts, "settings"),
  ].filter((shortcut): shortcut is PPhoneAppShortcut => Boolean(shortcut))

  return (
    <div className={styles.homeScreen}>
      <section className={styles.widgetGrid} aria-label="P-Phone 桌面组件">
        <article
          className={styles.clockWidget}
          aria-label={`时钟，当前世界时间 ${timeLabel}`}
        >
          <div className={styles.clockFace}>
            <span className={styles.clockMarkTop}>12</span>
            <span className={styles.clockMarkLeft}>9</span>
            <span className={styles.clockMarkRight}>3</span>
            <span className={styles.clockMarkBottom}>6</span>

            <span className={styles.hourHand} />
            <span className={styles.minuteHand} />
            <span className={styles.clockCenter} />
          </div>

          <strong>时钟</strong>
        </article>

        <article className={styles.weatherWidget}>
          <div className={styles.weatherCard}>
            <span>天气</span>
            <strong>{weatherLabel}</strong>

            <div className={styles.weatherIcon}>
              <span className={styles.sun} />
              <span className={styles.cloudA} />
              <span className={styles.cloudB} />
            </div>

            <em>
              {systemDateLabel} · {periodLabel}
            </em>
          </div>

          <strong>天气</strong>
        </article>
      </section>

      <div className={styles.appGrid} aria-label="P-Phone 应用">
        {shortcuts.map((shortcut) => (
          <button
            className={styles.appButton}
            key={shortcut.id}
            type="button"
            onClick={() => onOpenApp(shortcut.id)}
          >
            <span className={styles.iconWrap}>
              <PPhoneIcon kind={shortcut.icon} />

              {typeof shortcut.badgeCount === "number" &&
                shortcut.badgeCount > 0 && (
                  <strong className={styles.badge}>
                    {formatBadgeCount(shortcut.badgeCount)}
                  </strong>
                )}
            </span>

            <strong>{shortcut.title}</strong>
            <small>{shortcut.subtitle}</small>
          </button>
        ))}
      </div>

      <nav className={styles.quickDock} aria-label="P-Phone 快捷栏">
        {dockShortcuts.map((shortcut) => (
          <button
            className={styles.dockButton}
            key={shortcut.id}
            type="button"
            aria-label={`打开${shortcut.title}`}
            onClick={() => onOpenApp(shortcut.id)}
          >
            <PPhoneIcon kind={shortcut.icon} />
          </button>
        ))}
      </nav>
    </div>
  )
}