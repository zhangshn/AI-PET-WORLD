/**
 * 当前文件负责：作为 daily-state 下宠物情绪状态映射的公开入口。
 *
 * 注意：
 * 当前阶段只包装既有 pet-mood 实现，不改变运行逻辑。
 * 后续再逐步把 pet-mood 的状态类逻辑迁入 daily-state。
 */

export {
  mapTimelineStateToPetMood,
} from "../../pet-mood/pet-mood-gateway"
