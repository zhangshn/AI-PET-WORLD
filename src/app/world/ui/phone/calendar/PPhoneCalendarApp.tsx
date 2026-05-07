/**
 * 当前文件负责：展示 P-Phone 日历 App。
 */

import styles from "@/styles/world-styles/phone/calendar/p-phone-calendar-app.module.css"

type Props = {
  onBack: () => void
}

type CalendarDay = {
  key: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

function buildMonthDays(current: Date): CalendarDay[] {
  const year = current.getFullYear()
  const month = current.getMonth()
  const todayDate = current.getDate()

  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days: CalendarDay[] = []

  for (let index = startWeekday - 1; index >= 0; index -= 1) {
    const dayNumber = daysInPrevMonth - index

    days.push({
      key: `prev-${dayNumber}`,
      dayNumber,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    days.push({
      key: `current-${dayNumber}`,
      dayNumber,
      isCurrentMonth: true,
      isToday: dayNumber === todayDate,
    })
  }

  while (days.length % 7 !== 0) {
    const dayNumber = days.length - startWeekday - daysInMonth + 1

    days.push({
      key: `next-${dayNumber}`,
      dayNumber,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  return days
}

function buildMonthTitle(current: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(current)
}

function buildTodayLabel(current: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "long",
  })
    .format(current)
    .replace(/\s/g, "")
}

export default function PPhoneCalendarApp({ onBack }: Props) {
  const now = new Date()
  const days = buildMonthDays(now)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          type="button"
          aria-label="返回 P-Phone 首页"
          onClick={onBack}
        >
          ‹
        </button>

        <div>
          <p>CALENDAR</p>
          <h2>日历</h2>
        </div>
      </header>

      <section className={styles.todayCard}>
        <p>今天</p>
        <h3>{buildTodayLabel(now)}</h3>
      </section>

      <section className={styles.calendarPanel}>
        <h4>{buildMonthTitle(now)}</h4>

        <div className={styles.weekGrid}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className={styles.dayGrid}>
          {days.map((day) => (
            <span
              className={[
                styles.dayCell,
                day.isCurrentMonth ? styles.currentMonth : styles.otherMonth,
                day.isToday ? styles.today : "",
              ].join(" ")}
              key={day.key}
            >
              {day.dayNumber}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}