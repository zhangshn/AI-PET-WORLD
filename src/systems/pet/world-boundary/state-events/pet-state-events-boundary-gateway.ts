/**
 * 当前文件负责：作为 world-boundary 下宠物状态事件输出的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-state-events 实现，不改变运行逻辑。
 * pet-state-events 属于第 9 层边界：事件输出材料。
 * 它只把宠物状态变化转换为事件材料，不负责主体判断。
 */

export {
  buildPetStateEvents,
  type PetStateEvent,
} from "../../pet-state-events/pet-state-events-gateway"
