/**
 * 当前文件负责：统一导出宠物 cognition / perception 相关公开入口。
 *
 * cognition 属于第 7 层：自主驱动层中的感知与主体解释入口。
 * 它只把 world signal 转换为宠物可理解的主体解释，不直接决定 action。
 */

export {
  runPetStimulusPerception,
  type RunPetStimulusPerceptionInput,
  type RunPetStimulusPerceptionResult,
} from "./perception/pet-perception-gateway"
