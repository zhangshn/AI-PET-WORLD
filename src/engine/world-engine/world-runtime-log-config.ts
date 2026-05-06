/**
 * 当前文件负责：集中配置世界运行时日志开关。
 */

export const WORLD_RUNTIME_LOG_CONFIG = {
  worldTick: true,
  ecology: false,
  stimulus: false,
  incubator: true,

  petRuntime: true,
  petCognition: true,
  petDecision: true,
  petDecisionAudit: true,
  petAgentTrace: true,

  butlerAgentTrace: true,
  butlerAgentTraceDetail: false,

  birthProfile: true,
} as const