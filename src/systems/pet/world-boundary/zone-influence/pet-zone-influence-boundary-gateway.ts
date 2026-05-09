/**
 * 当前文件负责：作为 world-boundary 下世界区域对宠物影响输入的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-zone 实现，不改变运行逻辑。
 * pet-zone 属于第 9 层边界：世界区域影响输入。
 * 世界区域只能形成影响和 signal，不能直接决定宠物 action。
 */

export {
  runPetZoneInfluence,
  type RunPetZoneInfluenceInput,
  type RunPetZoneInfluenceResult,
} from "../../pet-zone/pet-zone-gateway"
