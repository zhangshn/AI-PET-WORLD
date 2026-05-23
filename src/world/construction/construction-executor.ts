/**
 * 当前文件职责：保持建设执行器的稳定入口，实际运行逻辑由 runtime 文件承载。
 */

export {
  advanceConstructionPlan,
  buildConstructionExecutionResult,
} from "./construction-executor-runtime"
