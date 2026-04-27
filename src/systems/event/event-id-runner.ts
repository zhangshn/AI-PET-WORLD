/**
 * 当前文件负责：生成事件系统使用的事件 ID 与连续叙事 ID。
 */

let eventSequence = 0
let continuitySequence = 0

export function createEventId(): string {
  eventSequence += 1
  return `event_${Date.now()}_${eventSequence}`
}

export function createContinuityId(): string {
  continuitySequence += 1
  return `continuity_${Date.now()}_${continuitySequence}`
}