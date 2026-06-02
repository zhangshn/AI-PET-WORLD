/**
 * 当前文件负责：定义 Timeline 测试面板使用的局部类型。
 */

export type TimelineClock = {
  day: number
  hour: number
  period: string
}

export type DiffItem = {
  label: string
  before: string | number
  after: string | number
}

export type TimelineLogEntry = {
  id: string
  actionLabel: string
  beforeClock: TimelineClock
  afterClock: TimelineClock
  diffs: DiffItem[]
  snapshotSummary: {
    phase: string
    emotional: string
    energy: number
    hunger: number
    cognitive: string
    relational: string
    drive: string
    branch: string
  }
  createdAt: string
}