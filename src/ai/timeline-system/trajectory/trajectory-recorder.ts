/**
 * AI-PET-WORLD
 * 时间线系统 - 生命轨迹记录器（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责把“对生命轨迹有意义的事情”记录到 LifeTrajectory 里。
 *
 * 它的核心职责是：
 * 1. 生成统一格式的 TimelineEventRecord
 * 2. 追加到 LifeTrajectory.history
 * 3. 控制历史记录长度
 * 4. 为未来趋势计算、分支判断、摘要生成提供原始材料
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不负责：
 * - 更新状态
 * - 计算趋势方向
 * - 计算 branchTag
 * - 生成摘要文案
 * - 计算 fortune 偏移
 *
 * 它只是“把重要事情写进时间线历史”。
 */

import type {
  LifeTrajectory,
  TimelineEventRecord,
} from "./trajectory-types";

/* -------------------------------------------------------------------------- */
/* 一、基础配置                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 默认最多保留多少条历史记录
 *
 * 为什么要限制？
 * - 避免时间线 history 无限膨胀
 * - 避免后续 worldEngine 长时间运行后数据越来越重
 * - 让当前系统保持轻量
 *
 * 当前第一版先保留最近 120 条。
 * 后续可以根据你项目节奏调整。
 */
export const DEFAULT_TIMELINE_HISTORY_LIMIT = 120;

/* -------------------------------------------------------------------------- */
/* 二、输入结构定义                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 创建轨迹记录时的输入参数
 *
 * 这里故意做成独立类型，
 * 是为了让 recorder 的入口更清晰，后续也方便统一扩展。
 */
export interface CreateTimelineEventRecordInput {
  /**
   * 世界时间 tick
   */
  tick: number;

  /**
   * 第几天
   */
  day: number;

  /**
   * 第几小时
   */
  hour: number;

  /**
   * 事件类型
   *
   * 示例：
   * - "born"
   * - "fed"
   * - "behavior_shift"
   * - "state_shift"
   * - "bonding"
   * - "disturbed"
   */
  type: string;

  /**
   * 事件说明
   */
  message: string;

  /**
   * 事件影响强度，建议范围 0 ~ 1
   */
  impact?: number;

  /**
   * 附加数据
   */
  payload?: Record<string, unknown>;
}

/**
 * 记录行为变化时的输入参数
 */
export interface RecordBehaviorShiftInput {
  tick: number;
  day: number;
  hour: number;
  previousAction?: string | null;
  nextAction: string;
  impact?: number;
}

/**
 * 记录状态变化时的输入参数
 *
 * 当前第一版先保持通用，
 * 后续你可以继续细拆成 emotional / physical / relational 等专用结构。
 */
export interface RecordStateShiftInput {
  tick: number;
  day: number;
  hour: number;
  category: string;
  previousLabel?: string | null;
  nextLabel: string;
  impact?: number;
}

/**
 * 记录关系事件时的输入参数
 */
export interface RecordRelationalEventInput {
  tick: number;
  day: number;
  hour: number;
  relationType: string;
  message: string;
  impact?: number;
  payload?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* 三、基础工具函数                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 创建时间线事件记录 ID
 *
 * 当前第一版使用：
 * `${type}-${tick}-${day}-${hour}-${random}`
 *
 * 理由：
 * - 简单直接
 * - 足够当前本地系统使用
 * - 不需要额外依赖库
 *
 * 后续如果你想更稳定，可以替换成更正式的 ID 生成器。
 */
export function buildTimelineEventRecordId(
  type: string,
  tick: number,
  day: number,
  hour: number
): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${type}-${tick}-${day}-${hour}-${randomPart}`;
}

/**
 * 规范化 impact 数值
 *
 * 目标：
 * - 保证 impact 在 0 ~ 1 之间
 * - 如果没有传，就返回 undefined
 *
 * 这样后续 branch-calculator 读取时会更稳。
 */
export function normalizeImpactValue(
  impact?: number
): number | undefined {
  if (impact === undefined || impact === null) {
    return undefined;
  }

  if (Number.isNaN(impact)) {
    return undefined;
  }

  if (impact < 0) {
    return 0;
  }

  if (impact > 1) {
    return 1;
  }

  return impact;
}

/**
 * 裁剪历史记录长度
 *
 * 规则：
 * - 只保留最近 limit 条
 * - 超出的旧记录从前面裁掉
 *
 * 这样可以保证：
 * - 时间线始终保留近期有效信息
 * - 数据不会无限膨胀
 */
export function trimTimelineHistory(
  history: TimelineEventRecord[],
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): TimelineEventRecord[] {
  if (history.length <= limit) {
    return history;
  }

  return history.slice(history.length - limit);
}

/* -------------------------------------------------------------------------- */
/* 四、基础记录构建函数                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 创建一条标准的 TimelineEventRecord
 *
 * 这是所有记录入口的底层基础方法。
 */
export function createTimelineEventRecord(
  input: CreateTimelineEventRecordInput
): TimelineEventRecord {
  return {
    id: buildTimelineEventRecordId(
      input.type,
      input.tick,
      input.day,
      input.hour
    ),
    tick: input.tick,
    day: input.day,
    hour: input.hour,
    type: input.type,
    message: input.message,
    impact: normalizeImpactValue(input.impact),
    payload: input.payload,
  };
}

/**
 * 往生命轨迹里追加一条记录
 *
 * 注意：
 * - 返回的是“新的轨迹对象”
 * - 不直接修改原对象
 *
 * 这样更安全，也更适合后面接入函数式更新风格。
 */
export function appendTimelineEventRecord(
  trajectory: LifeTrajectory,
  record: TimelineEventRecord,
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  const nextHistory = trimTimelineHistory(
    [...trajectory.history, record],
    limit
  );

  return {
    ...trajectory,
    history: nextHistory,
  };
}

/* -------------------------------------------------------------------------- */
/* 五、通用记录入口                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 记录通用时间线事件
 *
 * 用法：
 * - 当你已经明确知道要写什么 type / message / payload 时
 * - 这是最通用的入口
 */
export function recordTimelineEvent(
  trajectory: LifeTrajectory,
  input: CreateTimelineEventRecordInput,
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  const record = createTimelineEventRecord(input);
  return appendTimelineEventRecord(trajectory, record, limit);
}

/* -------------------------------------------------------------------------- */
/* 六、专用记录入口：行为变化                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 记录行为变化
 *
 * 作用：
 * - 当宠物行为发生切换时，把这个变化写进时间线
 *
 * 示例：
 * - walking -> sleeping
 * - sleeping -> eating
 * - eating -> walking
 */
export function recordBehaviorShift(
  trajectory: LifeTrajectory,
  input: RecordBehaviorShiftInput,
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  const previous = input.previousAction ?? "unknown";
  const next = input.nextAction;

  return recordTimelineEvent(
    trajectory,
    {
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "behavior_shift",
      message: `行为从 ${previous} 变化为 ${next}`,
      impact: input.impact ?? 0.2,
      payload: {
        previousAction: input.previousAction ?? null,
        nextAction: input.nextAction,
      },
    },
    limit
  );
}

/* -------------------------------------------------------------------------- */
/* 七、专用记录入口：状态变化                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 记录状态标签变化
 *
 * 当前第一版先用 category + label 方式记录。
 *
 * 示例：
 * - emotional: neutral -> alert
 * - relational: neutral -> attached
 * - physical: stable -> tired
 */
export function recordStateShift(
  trajectory: LifeTrajectory,
  input: RecordStateShiftInput,
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  const previous = input.previousLabel ?? "unknown";
  const next = input.nextLabel;

  return recordTimelineEvent(
    trajectory,
    {
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "state_shift",
      message: `${input.category} 状态从 ${previous} 变化为 ${next}`,
      impact: input.impact ?? 0.18,
      payload: {
        category: input.category,
        previousLabel: input.previousLabel ?? null,
        nextLabel: input.nextLabel,
      },
    },
    limit
  );
}

/* -------------------------------------------------------------------------- */
/* 八、专用记录入口：关系事件                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 记录关系相关事件
 *
 * 示例：
 * - bonding
 * - comforted
 * - guarded_response
 * - trust_gain
 */
export function recordRelationalEvent(
  trajectory: LifeTrajectory,
  input: RecordRelationalEventInput,
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  return recordTimelineEvent(
    trajectory,
    {
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: input.relationType,
      message: input.message,
      impact: input.impact ?? 0.25,
      payload: input.payload,
    },
    limit
  );
}

/* -------------------------------------------------------------------------- */
/* 九、专用记录入口：出生事件                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 记录出生事件
 *
 * 说明：
 * - 这是很重要的时间线起点事件
 * - 但是否在宠物创建时立刻写入，取决于你后续想把它放在：
 *   1. worldEngine
 *   2. timeline-gateway
 *   3. pet 创建流程
 *   哪一层触发
 */
export function recordBirthEvent(
  trajectory: LifeTrajectory,
  input: {
    tick: number;
    day: number;
    hour: number;
    petName?: string;
    impact?: number;
  },
  limit: number = DEFAULT_TIMELINE_HISTORY_LIMIT
): LifeTrajectory {
  const petLabel = input.petName ? `${input.petName} 出生` : "宠物出生";

  return recordTimelineEvent(
    trajectory,
    {
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "born",
      message: petLabel,
      impact: input.impact ?? 0.9,
      payload: {
        petName: input.petName ?? null,
      },
    },
    limit
  );
}