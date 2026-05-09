/**
 * 当前文件负责：统一导出宠物系统与世界运行层之间的边界入口。
 *
 * world-boundary 属于第 9 层：世界运行边界。
 * 它只负责世界输入影响与事件材料输出，不负责宠物主体判断。
 */

export {
  buildPetStateEvents,
  type PetStateEvent,
} from "./state-events/pet-state-events-boundary-gateway"

export {
  runPetZoneInfluence,
  type RunPetZoneInfluenceInput,
  type RunPetZoneInfluenceResult,
} from "./zone-influence/pet-zone-influence-boundary-gateway"
