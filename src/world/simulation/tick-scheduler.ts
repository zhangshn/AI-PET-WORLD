/**
 * 当前文件负责：判断不同世界系统是否应该在当前 tick 执行。
 */

export function shouldRunEvery(input: {
  tick: number
  interval: number
}): boolean {
  if (input.interval <= 1) return true
  return input.tick % input.interval === 0
}