/**
 * 当前文件负责：集中管理 Timeline 测试面板使用的中文标签。
 */

export const PHASE_LABELS: Record<string, string> = {
  stable_phase: "平稳阶段",
  growth_phase: "成长扩张阶段",
  sensitive_phase: "敏感波动阶段",
  recovery_phase: "修整恢复阶段",
  attachment_phase: "亲近依附阶段",
  withdrawal_phase: "收缩回避阶段"
}

export const EMOTIONAL_LABELS: Record<string, string> = {
  relaxed: "放松",
  content: "满足",
  curious: "好奇",
  excited: "兴奋",
  alert: "警觉",
  irritated: "烦躁",
  anxious: "不安",
  low: "低落",
  neutral: "平稳"
}

export const COGNITIVE_LABELS: Record<string, string> = {
  idle: "松散观察",
  observing: "观察中",
  focused: "专注",
  curious: "探索留意",
  hesitant: "犹豫",
  stressed: "紧张",
  avoidant: "回避"
}

export const RELATIONAL_LABELS: Record<string, string> = {
  secure: "安心",
  attached: "亲近",
  neutral: "中性",
  guarded: "保留",
  distant: "疏离"
}

export const DRIVE_LABELS: Record<string, string> = {
  rest: "休息",
  eat: "进食",
  explore: "探索",
  approach: "靠近",
  avoid: "回避",
  observe: "观察",
  idle: "待机"
}

export const BRANCH_LABEL_MAP: Record<string, string> = {
  balanced: "平衡路径",
  attachment: "亲近路径",
  defense: "防御路径",
  curiosity: "探索路径",
  recovery: "恢复路径",
  survival: "应对路径"
}