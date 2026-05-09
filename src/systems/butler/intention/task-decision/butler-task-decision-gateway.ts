/**
 * 当前文件负责：作为 intention 下管家任务意图选择与决策痕迹的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 task 实现，不改变运行逻辑。
 * task 当前负责管家任务选择与任务决策 trace。
 * 后续会逐步把任务意图判断迁入 intention/task-decision。
 */

export {
  chooseButlerTask,
} from "../../task/butler-task-runner"

export {
  buildButlerTaskDecisionTrace,
} from "../../task/butler-task-decision-trace"

export type {
  ButlerTaskDecisionGate,
  ButlerTaskDecisionScore,
  ButlerTaskDecisionTrace,
} from "../../task/butler-task-decision-trace"