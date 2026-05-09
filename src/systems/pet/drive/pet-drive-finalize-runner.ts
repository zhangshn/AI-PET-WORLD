/**
 * 当前文件负责：归一化 drive 分数，并选择当前主导 drive。
 */

import type {
  DriveScores,
  DriveSnapshot,
  DriveType,
} from "./pet-drive-types"
import { clamp, round } from "./pet-drive-score-utils"

export function normalizeDriveScores(scores: DriveScores) {
  ;(Object.keys(scores) as DriveType[]).forEach((key) => {
    scores[key] = clamp(round(scores[key]))
  })
}

export function chooseDominantDrive(scores: DriveScores): {
  dominant: DriveType
  dominantScore: number
} {
  const drivePriority: DriveType[] = [
    "eat",
    "rest",
    "avoid",
    "approach",
    "explore",
    "observe",
  ]

  let dominant: DriveType = "observe"
  let dominantScore = -1

  for (const drive of drivePriority) {
    const score = scores[drive]

    if (score > dominantScore) {
      dominant = drive
      dominantScore = score
    }
  }

  return {
    dominant,
    dominantScore,
  }
}

export function buildDriveSummary(snapshot: DriveSnapshot): string {
  return `当前主导 drive 为 ${snapshot.dominant}（${snapshot.dominantScore}）`
}