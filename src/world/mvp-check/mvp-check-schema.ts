/**
 * 当前文件负责：定义 MVP 全链路检查报告类型。
 */

export type MvpCheckStatus = "pass" | "warn" | "fail"

export type MvpCheckItem = {
  id: string
  title: string
  status: MvpCheckStatus
  message: string
  tags: string[]
}

export type MvpCheckReport = {
  generatedAt: number
  overallStatus: MvpCheckStatus
  items: MvpCheckItem[]
  summary: string
  tags: string[]
}
