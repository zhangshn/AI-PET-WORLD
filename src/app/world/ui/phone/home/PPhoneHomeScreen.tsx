"use client"

/**
 * 当前文件负责：展示 P-Phone 桌面应用入口。
 */

import { useEffect, useMemo, useState } from "react"

import type { CSSProperties } from "react"
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

function buildSystemDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
    .format(date)
    .replace(/\s/g, "")
}

function buildCalendarTitle(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    weekday: "short",
  })
    .format(date)
    .replace(/\s/g, "")
}

function buildRealTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function buildClockHandStyles(date: Date): {
  hourHandStyle: CSSProperties
  minuteHandStyle: CSSProperties
  secondHandStyle: CSSProperties
} {
  const seconds = date.getSeconds()
  const minutes = date.getMinutes()
  const hours = date.getHours() % 12

  const secondDegrees = seconds * 6
  const minuteDegrees = minutes * 6 + seconds * 0.1
  const hourDegrees = hours * 30 + minutes * 0.5

  return {
    hourHandStyle: {
      transform: `translate(-50%, -100%) rotate(${hourDegrees}deg)`,
    },
    minuteHandStyle: {
      transform: `translate(-50%, -100%) rotate(${minuteDegrees}deg)`,
    },
    secondHandStyle: {
      transform: `translate(-50%, -100%) rotate(${secondDegrees}deg)`,
    },
  }
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
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const systemDateLabel = useMemo(() => buildSystemDateLabel(now), [now])
  const calendarTitle = useMemo(() => buildCalendarTitle(now), [now])
  const realTimeLabel = useMemo(() => buildRealTimeLabel(now), [now])

  const { hourHandStyle, minuteHandStyle, secondHandStyle } = useMemo(() => {
    return buildClockHandStyles(now)
  }, [now])

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
          aria-label={`真实时钟，当前时间 ${realTimeLabel}`}
        >
          <div className={styles.clockFace}>
            <span className={styles.clockMarkTop}>12</span>
            <span className={styles.clockMarkLeft}>9</span>
            <span className={styles.clockMarkRight}>3</span>
            <span className={styles.clockMarkBottom}>6</span>

            <span className={styles.hourHand} style={hourHandStyle} />
            <span className={styles.minuteHand} style={minuteHandStyle} />
            <span className={styles.secondHand} style={secondHandStyle} />
            <span className={styles.clockCenter} />
          </div>

          <strong>时钟</strong>
        </article>

        <button
          className={styles.weatherWidget}
          type="button"
          aria-label={`打开天气，当前游戏天气 ${weatherLabel}`}
          onClick={() => onOpenApp("weather")}
        >
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
        </button>
      </section>

      <button
        className={styles.calendarWidget}
        type="button"
        aria-label={`打开日历，今天是 ${calendarTitle}`}
        onClick={() => onOpenApp("calendar")}
      >
        <span>日历</span>
        <strong>{calendarTitle}</strong>
        <em>系统日期</em>
      </button>

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

      <span className={styles.hiddenWorldTime}>世界时间：{timeLabel}</span>
    </div>
  )
}