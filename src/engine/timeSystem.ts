/**
 * ======================================================
 * AI-PET-WORLD
 * 时间系统 TimeSystem
 * ======================================================
 *
 * 当前文件负责：
 * 1. 管理世界天数
 * 2. 管理世界小时
 * 3. 判断当前时间段
 *
 * 规则：
 * - 每次 update()，时间前进 1 小时
 * - 一天 24 小时
 * - 小时范围 0 ~ 23
 *
 * 示例：
 * Day 1 - 06:00 - Morning
 * Day 1 - 14:00 - Daytime
 * Day 1 - 19:00 - Evening
 * Day 1 - 23:00 - Night
 * ======================================================
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
  /**
   * 当前时间状态
   */
  private time: TimeState

  constructor() {
    /**
     * 初始化世界时间
     * 默认从 Day 1 06:00 开始
     */
    this.time = {
      day: 1,
      hour: 6,
      period: "Morning",
    }
  }

  /**
   * ======================================================
   * 时间推进
   * 每调用一次，世界前进 1 小时
   * ======================================================
   */
  update() {
    this.time.hour++

    /**
     * 超过 23 点，进入下一天
     */
    if (this.time.hour > 23) {
      this.time.hour = 0
      this.time.day++
    }

    /**
     * 根据小时重新判断时间段
     */
    this.time.period = this.getPeriodByHour(this.time.hour)
  }

  /**
   * ======================================================
   * 根据小时判断当前时间段
   * ======================================================
   */
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

  /**
   * ======================================================
   * 获取当前时间对象
   * 返回副本，防止外部直接修改内部状态
   * ======================================================
   */
  getTime(): TimeState {
    return { ...this.time }
  }

  /**
   * ======================================================
   * 获取格式化时间字符串
   * 例如：
   * Day 1 - 06:00 - Morning
   * ======================================================
   */
  getFormattedTime(): string {
    const hourString = this.time.hour.toString().padStart(2, "0")
    return `Day ${this.time.day} - ${hourString}:00 - ${this.time.period}`
  }
}