/**
 * 当前文件负责：提供紫微动态层使用的地支移动工具。
 */

import type { BranchPalace } from "../schema"

import {
  ZIWEI_BRANCH_ORDER,
  getBranchFullLabel,
  getBranchLabel
} from "../knowledge/branches"

export function safeModulo(value: number, base: number): number {
  return ((value % base) + base) % base
}

export function getBranchIndex(branch: BranchPalace): number {
  return ZIWEI_BRANCH_ORDER.indexOf(branch)
}

export function getBranchByIndex(index: number): BranchPalace {
  return ZIWEI_BRANCH_ORDER[safeModulo(index, ZIWEI_BRANCH_ORDER.length)]
}

export function moveBranch(
  startBranch: BranchPalace,
  steps: number
): BranchPalace {
  const startIndex = getBranchIndex(startBranch)

  if (startIndex < 0) {
    return startBranch
  }

  return getBranchByIndex(startIndex + steps)
}

export function getForwardBranch(
  startBranch: BranchPalace,
  steps: number
): BranchPalace {
  return moveBranch(startBranch, Math.abs(steps))
}

export function getBackwardBranch(
  startBranch: BranchPalace,
  steps: number
): BranchPalace {
  return moveBranch(startBranch, -Math.abs(steps))
}

export function getBranchDisplayName(branch: BranchPalace): string {
  return getBranchFullLabel(branch)
}

export function getBranchShortName(branch: BranchPalace): string {
  return getBranchLabel(branch)
}