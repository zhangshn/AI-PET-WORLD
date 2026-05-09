/**
 * 当前文件负责：作为 intention 下管家状态解释 / 情绪表现推导的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 butler-mood-runner 实现，不改变运行逻辑。
 * butler-mood-runner 当前根据管家任务推导 mood。
 * 后续会逐步把管家状态解释逻辑迁入 intention/state-interpretation。
 */

export {
  deriveButlerMood,
} from "../../butler-mood-runner"