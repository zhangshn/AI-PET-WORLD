/**
 * 当前文件负责：定义八字五行统计权重。
 */

export const BAZI_ELEMENT_WEIGHTS = {
  yearStem: 0.8,
  yearBranch: 0.8,
  monthStem: 1.1,
  monthBranch: 1.6,
  dayStem: 1.3,
  dayBranch: 1.0,
  hourStem: 0.7,
  hourBranch: 0.7,
  hiddenStem: 0.35,
} as const