/**
 * 当前文件负责：作为 behavior 下管家提供机会动作的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 butler-opportunity-runner 实现，不改变运行逻辑。
 * 管家创建机会不等于宠物必须接受，机会必须进入宠物自身判断链。
 */

export {
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
} from "../../butler-opportunity-runner"
