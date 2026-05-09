/**
 * 当前文件负责：作为 tuning 下管家人格倾向调参的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 butler-profile-tuning 实现，不改变运行逻辑。
 * butler-profile-tuning 当前把 ButlerProfile 转换为任务选择层可读取的轻量调参。
 * 后续会逐步把 profile tendency adapter 迁入 tuning/profile-tendency。
 */

export {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "../../butler-profile-tuning"