import type { BranchPalace } from "../contracts"

import { PHYSICAL_BRANCH_ORDER } from "./branch-order"
import { mod12 } from "./mod-utils"

export function getBranchIndex(branch: BranchPalace): number {
  const index = PHYSICAL_BRANCH_ORDER.indexOf(branch)

  if (index < 0) {
    throw new Error(`Unknown branch palace: ${branch}`)
  }

  return index
}

export function getBranchByIndex(index: number): BranchPalace {
  return PHYSICAL_BRANCH_ORDER[mod12(index)]
}

export function moveBranch(
  branch: BranchPalace,
  offset: number
): BranchPalace {
  return getBranchByIndex(getBranchIndex(branch) + offset)
}

export function getOppositeBranch(branch: BranchPalace): BranchPalace {
  return moveBranch(branch, 6)
}
