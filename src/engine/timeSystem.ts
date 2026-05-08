/**
 * 当前文件负责：管理世界时间状态，并支持时间推进与存档恢复。
 */

export type TimePeriod =
  | "Morning"
  | "Daytime"
  | "Evening"
  | "Night"

export type TimeState = {
  day: number
  hour: number
  period: TimePeriod
}

export class TimeSystem {
  private time: TimeState

  constructor() {
    this.time = {
      day: 1,
      hour: 6,
      period: "Morning",
    }
  }

  update() {
    this.time.hour++

    if (this.time.hour > 23) {
      this.time.hour = 0
      this.time.day++
    }

    this.time.period = this.getPeriodByHour(this.time.hour)
  }

  restore(time: TimeState): void {
    const safeDay = Number.isFinite(time.day)
      ? Math.max(1, Math.floor(time.day))
      : 1

    const safeHour = Number.isFinite(time.hour)
      ? Math.min(23, Math.max(0, Math.floor(time.hour)))
      : 6

    this.time = {
      day: safeDay,
      hour: safeHour,
      period: this.getPeriodByHour(safeHour),
    }
  }

  private getPeriodByHour(hour: number): TimePeriod {
    if (hour >= 6 && hour < 12) {
      return "Morning"
    }

    if (hour >= 12 && hour < 18) {
      return "Daytime"
    }

    if (hour >= 18 && hour < 22) {
      return "Evening"
    }

    return "Night"
  }

  getTime(): TimeState {
    return { ...this.time }
  }

  getFormattedTime(): string {
    const hourString = this.time.hour.toString().padStart(2, "0")
    return `Day ${this.time.day} - ${hourString}:00 - ${this.time.period}`
  }
}