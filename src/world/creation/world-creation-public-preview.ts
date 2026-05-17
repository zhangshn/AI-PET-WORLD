/**
 * 当前文件负责：把世界创建运行时结果转换为用户可读预览。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

import type { WorldCreationRuntimeResult } from "./world-creation-schema"

export type WorldCreationPreviewStyleItem = {
  key: keyof ButlerConstructionStyleVector
  label: string
  score: number
  level: "low" | "medium" | "high"
  summary: string
}

export type WorldCreationPublicPreview = {
  title: string
  subtitle: string
  sourceLabel: string
  dominantStyles: WorldCreationPreviewStyleItem[]
  styleItems: WorldCreationPreviewStyleItem[]
  worldSeedSummary: string
  note: string
}

const STYLE_LABELS: Record<keyof ButlerConstructionStyleVector, string> = {
  structuredBuilder: "秩序建设",
  warmCaretaker: "温和照护",
  protectiveKeeper: "保护边界",
  aestheticOrganizer: "整理美化",
  quietMaintainer: "安静维护",
  adaptivePlanner: "灵活规划",
}

const STYLE_SUMMARIES: Record<keyof ButlerConstructionStyleVector, string> = {
  structuredBuilder: "更倾向先整理结构、确定区域，再慢慢建设。",
  warmCaretaker: "更倾向优先照顾宠物休息、食物和舒适感。",
  protectiveKeeper: "更倾向先保证边界、安全和稳定环境。",
  aestheticOrganizer: "更倾向增加花草、细节和可观察的生活感。",
  quietMaintainer: "更倾向低调维护家园，让世界稳定地持续运行。",
  adaptivePlanner: "更倾向根据宠物状态和世界变化调整建设顺序。",
}

export function buildWorldCreationPublicPreview(
  runtime: WorldCreationRuntimeResult
): WorldCreationPublicPreview {
  const styleItems = buildStyleItems(runtime.butlerConstructionStyle)
  const dominantStyles = [...styleItems]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)

  return {
    title: "你的世界正在形成",
    subtitle: buildSubtitle(dominantStyles),
    sourceLabel:
      runtime.styleSource === "life_profile_core"
        ? "已接入生命核心"
        : "使用稳定备用生成",
    dominantStyles,
    styleItems,
    worldSeedSummary: `世界种子：${runtime.birthSignature}`,
    note:
      "这里只展示世界生成结果，不展示后台命理术语。出生信息会影响管家的建设倾向、家园初始结构和后续世界成长方向。",
  }
}

function buildStyleItems(
  style: ButlerConstructionStyleVector
): WorldCreationPreviewStyleItem[] {
  return (
    Object.keys(STYLE_LABELS) as Array<keyof ButlerConstructionStyleVector>
  ).map((key) => {
    const score = normalizeScore(style[key])

    return {
      key,
      label: STYLE_LABELS[key],
      score,
      level: buildLevel(score),
      summary: STYLE_SUMMARIES[key],
    }
  })
}

function buildSubtitle(styles: WorldCreationPreviewStyleItem[]): string {
  if (styles.length === 0) {
    return "管家会根据你的输入，逐步形成自己的建设习惯。"
  }

  return `当前管家更偏向「${styles.map((style) => style.label).join(" / ")}」。`
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 50

  return Math.max(0, Math.min(100, Math.round(value * 100)))
}

function buildLevel(score: number): WorldCreationPreviewStyleItem["level"] {
  if (score >= 70) return "high"
  if (score >= 45) return "medium"

  return "low"
}
