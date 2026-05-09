/**
 * 当前文件负责：统一导出管家 tuning / profile tendency 相关入口。
 *
 * tuning 只负责把管家先天人格、倾向和偏置转换为运行层可读取的轻量调参。
 * tuning 不直接决定任务、消息或行为。
 */

export {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "./profile-tendency/butler-profile-tendency-gateway"