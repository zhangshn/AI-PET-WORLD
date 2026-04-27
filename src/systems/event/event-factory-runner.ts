/**
 * 当前文件负责：把事件参数统一组装成 WorldEvent。
 */

import type { WorldEvent } from "@/types/event"
import type {
  MakeWorldEventInput,
  MakeWorldEventResult,
} from "./event-schema"
import { createEventId } from "./event-id-runner"

export function makeWorldEvent(
  params: MakeWorldEventInput
): MakeWorldEventResult {
  return {
    id: createEventId(),
    tick: params.tick,
    day: params.day,
    hour: params.hour,
    type: params.type as WorldEvent["type"],
    petName: params.petName,
    message: params.message,
    sourceAction: params.sourceAction,
    narrativeType: params.narrativeType,
    continuityId: params.continuityId,
    intensity: params.intensity,
    payload: params.payload ?? {},
  } as WorldEvent
}