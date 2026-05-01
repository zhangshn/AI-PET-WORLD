/**
 * 当前文件负责：定义紫微核心使用的地支顺序与展示资料。
 */

import type { BranchPalace } from "../schema"

export const ZIWEI_BRANCH_ORDER: BranchPalace[] = [
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
  "chou"
]

export const ZIWEI_BRANCH_LABELS: Record<BranchPalace, string> = {
  yin: "寅",
  mao: "卯",
  chen: "辰",
  si: "巳",
  wu: "午",
  wei: "未",
  shen: "申",
  you: "酉",
  xu: "戌",
  hai: "亥",
  zi: "子",
  chou: "丑"
}

export const ZIWEI_BRANCH_FULL_LABELS: Record<BranchPalace, string> = {
  yin: "寅宫",
  mao: "卯宫",
  chen: "辰宫",
  si: "巳宫",
  wu: "午宫",
  wei: "未宫",
  shen: "申宫",
  you: "酉宫",
  xu: "戌宫",
  hai: "亥宫",
  zi: "子宫",
  chou: "丑宫"
}

export function isZiweiBranchPalace(value: string): value is BranchPalace {
  return ZIWEI_BRANCH_ORDER.includes(value as BranchPalace)
}

export function getBranchLabel(branch: BranchPalace): string {
  return ZIWEI_BRANCH_LABELS[branch]
}

export function getBranchFullLabel(branch: BranchPalace): string {
  return ZIWEI_BRANCH_FULL_LABELS[branch]
}