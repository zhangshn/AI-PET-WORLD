/**
 * 当前文件职责：提供 MVP 核心闭环 debug 与展示模型统一出口。
 */

export * from "./mvp-core-schema"
export * from "./mvp-core-debug-runner"
export * from "./mvp-core-pipeline"
export * from "./mvp-presentation-model"
export * from "./mvp-initial-world-builder"
export * from "./mvp-world-runtime-tick"
export * from "./mvp-persistence-dry-run"
export * from "./mvp-visual-refresh"
export * from "./mvp-formal-visual-refresh"
export { buildMvpWorldLogEntries } from "./mvp-world-log"
export type { MvpWorldLogEntry as MvpPipelineWorldLogEntry } from "./mvp-world-log"
export * from "./mvp-butler-explanation"
export { buildMvpPPhoneData } from "./mvp-pphone-data"
export type {
  MvpPPhoneData as MvpPipelinePPhoneData,
  MvpPPhoneMessage,
} from "./mvp-pphone-data"
export * from "./mvp-smoke-scenarios"
export * from "./mvp-smoke-audit"
