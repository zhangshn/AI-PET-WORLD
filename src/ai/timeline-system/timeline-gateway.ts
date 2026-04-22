/**
 * AI-PET-WORLD
 * 时间线系统统一入口（第四版 + playerRelation 最小接入版）
 *
 * ----------------------------------------------------------------------------
 * 【这一版升级目标】
 * ----------------------------------------------------------------------------
 * 这一版继续强化 gateway 的“统一入口”定位。
 *
 * 当前第四版在第三版基础上新增：
 * 1. 自动比较旧状态和新状态
 * 2. 自动记录 state_shift 到 trajectory.history
 * 3. 可选记录 behavior_shift
 * 4. 更新后统一刷新 trajectory
 * 5. 最小接入 playerRelation，并透传给 state-updater.ts
 *
 * 这样外部系统后续更少需要自己操作：
 * - state-updater.ts
 * - trajectory-recorder.ts
 * - trajectory-branch-calculator.ts
 * - trajectory-summary-builder.ts
 *
 * ----------------------------------------------------------------------------
 * 【当前推荐外部使用方式】
 * ----------------------------------------------------------------------------
 * - buildPetTimelineSnapshot(...)
 * - buildPetTimelineView(...)
 * - updatePetTimelineSnapshot(...)
 * - buildPetTimelineViewFromSnapshot(...)
 *
 * ----------------------------------------------------------------------------
 * 【当前这一版仍未完全接入的内容】
 * ----------------------------------------------------------------------------
 * 当前这一版仍然没有正式接入：
 * - personality-core 个性化初始偏移
 * - trajectory trend 自动演化
 * - 行为系统自动对接（这里只做可选行为记录）
 * - fortune 与 personality / trajectory 深度耦合
 * - playerRelation 持久化写入 snapshot 主结构
 */

import type { PetState } from "./state/state-types";
import { buildDefaultPetState } from "./state/state-defaults";
import type {
  StateUpdateEvent,
  UpdatePetStateInput,
  PlayerRelationInput,
} from "./state/state-updater";
import { updatePetState } from "./state/state-updater";

import type {
  BranchTag,
  LifeTrajectory,
  TimelineEventRecord,
  TrajectoryTrend,
} from "./trajectory/trajectory-types";
import {
  withBuiltTrajectorySummary,
} from "./trajectory/trajectory-summary-builder";
import {
  withCalculatedBranchTag,
} from "./trajectory/trajectory-branch-calculator";
import {
  recordBehaviorShift,
  recordStateShift,
} from "./trajectory/trajectory-recorder";

import type {
  FortuneDisplayResult,
  FortuneProjectionDisplayResult,
} from "./fortune/fortune-mapper";
import {
  mapFortuneProjectionToDisplayResult,
  mapTemporalInfluenceToDisplayResult,
} from "./fortune/fortune-mapper";

import type {
  BuildFortuneProjectionInput,
  BuildTemporalInfluenceInput,
} from "./fortune/fortune-engine";
import {
  buildFortuneProjection,
  buildTemporalInfluence,
} from "./fortune/fortune-engine";

import type {
  FortuneProjection,
  TemporalInfluence,
} from "./fortune/fortune-types";

/* -------------------------------------------------------------------------- */
/* 一、时间线系统总结构                                                         */
/* -------------------------------------------------------------------------- */

export interface PetTimelineSnapshot {
  state: PetState;
  trajectory: LifeTrajectory;
  fortune: TemporalInfluence;
}

export interface PetTimelineView {
  snapshot: PetTimelineSnapshot;
  fortuneDisplay: FortuneDisplayResult;
  projectionDisplay: FortuneProjectionDisplayResult;
}

/**
 * 行为变化记录输入
 *
 * 当前阶段由于行为系统还没正式并入 timeline-system，
 * 所以这里先由外部可选传入。
 */
export interface TimelineBehaviorShiftInput {
  previousAction?: string | null;
  nextAction: string;
  impact?: number;
}

/**
 * 更新完整时间线快照时的输入
 */
export interface UpdatePetTimelineSnapshotInput {
  currentSnapshot: PetTimelineSnapshot;
  day: number;
  hour: number;
  period?: string;
  events?: StateUpdateEvent[];
  tickDelta?: number;
  shouldRefreshTrajectory?: boolean;

  /**
   * 可选：行为变化
   *
   * 当前如果外部系统已经知道这一轮行为发生切换，
   * 可以直接传进来，由 gateway 统一写 recorder。
   */
  behaviorShift?: TimelineBehaviorShiftInput;

  /**
   * 新增：玩家关系（最小接入版）
   *
   * 当前只作为状态计算的外部上下文透传，
   * 暂不写入 timelineSnapshot 主结构。
   */
  playerRelation?: PlayerRelationInput;
}

/* -------------------------------------------------------------------------- */
/* 二、轨迹层默认值                                                             */
/* -------------------------------------------------------------------------- */

export function buildDefaultTrajectoryTrend(): TrajectoryTrend {
  return {
    direction: "stable",
    strength: 0,
  };
}

export function buildDefaultTimelineHistory(): TimelineEventRecord[] {
  return [];
}

export function buildDefaultBranchTag(): BranchTag {
  return "balanced";
}

export function buildBaseLifeTrajectory(): LifeTrajectory {
  return {
    history: buildDefaultTimelineHistory(),

    trustTrend: buildDefaultTrajectoryTrend(),
    stressTrend: buildDefaultTrajectoryTrend(),
    explorationTrend: buildDefaultTrajectoryTrend(),
    attachmentTrend: buildDefaultTrajectoryTrend(),
    avoidanceTrend: buildDefaultTrajectoryTrend(),

    branchTag: buildDefaultBranchTag(),
    summary: "生命时间线刚刚开始，尚未形成明确的长期分支倾向。",
  };
}

export function buildDefaultLifeTrajectory(): LifeTrajectory {
  return refreshLifeTrajectory(buildBaseLifeTrajectory());
}

/* -------------------------------------------------------------------------- */
/* 三、状态层统一入口                                                           */
/* -------------------------------------------------------------------------- */

export function buildDefaultPetTimelineState(): PetState {
  return buildDefaultPetState();
}

export function updatePetTimelineState(
  input: UpdatePetStateInput
): PetState {
  return updatePetState(input);
}

/* -------------------------------------------------------------------------- */
/* 四、fortune 层统一入口                                                       */
/* -------------------------------------------------------------------------- */

export function buildCurrentTemporalInfluence(
  input: BuildTemporalInfluenceInput
): TemporalInfluence {
  return buildTemporalInfluence(input);
}

export function buildNextFortuneProjection(
  input: BuildFortuneProjectionInput
): FortuneProjection {
  return buildFortuneProjection(input);
}

/* -------------------------------------------------------------------------- */
/* 五、轨迹层统一入口                                                           */
/* -------------------------------------------------------------------------- */

export function refreshLifeTrajectory(
  trajectory: LifeTrajectory
): LifeTrajectory {
  const withBranch = withCalculatedBranchTag(trajectory);
  return withBuiltTrajectorySummary(withBranch);
}

export function refreshPetTimelineTrajectory(
  snapshot: PetTimelineSnapshot
): PetTimelineSnapshot {
  return {
    ...snapshot,
    trajectory: refreshLifeTrajectory(snapshot.trajectory),
  };
}

/* -------------------------------------------------------------------------- */
/* 六、总快照初始化                                                             */
/* -------------------------------------------------------------------------- */

export function buildPetTimelineSnapshot(
  input: BuildTemporalInfluenceInput
): PetTimelineSnapshot {
  return {
    state: buildDefaultPetTimelineState(),
    trajectory: buildDefaultLifeTrajectory(),
    fortune: buildCurrentTemporalInfluence(input),
  };
}

/* -------------------------------------------------------------------------- */
/* 七、自动 recorder 接入：状态比较与记录                                        */
/* -------------------------------------------------------------------------- */

/**
 * 比较单层 label 是否变化
 */
export function hasLabelChanged(
  previousLabel: string,
  nextLabel: string
): boolean {
  return previousLabel !== nextLabel;
}

/**
 * 自动记录 state label 变化
 *
 * 当前会检查：
 * - emotional
 * - physical
 * - cognitive
 * - relational
 *
 * 如果 label 变化，就自动写入 trajectory.history。
 */
export function recordStateShiftsFromStateDiff(
  trajectory: LifeTrajectory,
  previousState: PetState,
  nextState: PetState,
  context: {
    tick: number;
    day: number;
    hour: number;
  }
): LifeTrajectory {
  let nextTrajectory = trajectory;

  if (
    hasLabelChanged(
      previousState.emotional.label,
      nextState.emotional.label
    )
  ) {
    nextTrajectory = recordStateShift(nextTrajectory, {
      tick: context.tick,
      day: context.day,
      hour: context.hour,
      category: "emotional",
      previousLabel: previousState.emotional.label,
      nextLabel: nextState.emotional.label,
      impact: 0.22,
    });
  }

  if (
    hasLabelChanged(
      previousState.physical.label,
      nextState.physical.label
    )
  ) {
    nextTrajectory = recordStateShift(nextTrajectory, {
      tick: context.tick,
      day: context.day,
      hour: context.hour,
      category: "physical",
      previousLabel: previousState.physical.label,
      nextLabel: nextState.physical.label,
      impact: 0.18,
    });
  }

  if (
    hasLabelChanged(
      previousState.cognitive.label,
      nextState.cognitive.label
    )
  ) {
    nextTrajectory = recordStateShift(nextTrajectory, {
      tick: context.tick,
      day: context.day,
      hour: context.hour,
      category: "cognitive",
      previousLabel: previousState.cognitive.label,
      nextLabel: nextState.cognitive.label,
      impact: 0.2,
    });
  }

  if (
    hasLabelChanged(
      previousState.relational.label,
      nextState.relational.label
    )
  ) {
    nextTrajectory = recordStateShift(nextTrajectory, {
      tick: context.tick,
      day: context.day,
      hour: context.hour,
      category: "relational",
      previousLabel: previousState.relational.label,
      nextLabel: nextState.relational.label,
      impact: 0.24,
    });
  }

  return nextTrajectory;
}

/**
 * 自动记录行为变化
 *
 * 当前是可选记录，因为行为系统还没正式完全并入 timeline-system。
 */
export function recordBehaviorShiftIfNeeded(
  trajectory: LifeTrajectory,
  behaviorShift: TimelineBehaviorShiftInput | undefined,
  context: {
    tick: number;
    day: number;
    hour: number;
  }
): LifeTrajectory {
  if (!behaviorShift) {
    return trajectory;
  }

  return recordBehaviorShift(trajectory, {
    tick: context.tick,
    day: context.day,
    hour: context.hour,
    previousAction: behaviorShift.previousAction ?? null,
    nextAction: behaviorShift.nextAction,
    impact: behaviorShift.impact ?? 0.2,
  });
}

/**
 * 自动把本轮状态变化和行为变化写入 trajectory.history
 *
 * 当前第一版职责非常明确：
 * - 只写 recorder
 * - 不改趋势
 * - 不直接算分支
 *
 * 分支和摘要刷新在后续统一做。
 */
export function recordTimelineChangesFromSnapshotUpdate(
  trajectory: LifeTrajectory,
  previousState: PetState,
  nextState: PetState,
  context: {
    tick: number;
    day: number;
    hour: number;
  },
  behaviorShift?: TimelineBehaviorShiftInput
): LifeTrajectory {
  let nextTrajectory = trajectory;

  nextTrajectory = recordStateShiftsFromStateDiff(
    nextTrajectory,
    previousState,
    nextState,
    context
  );

  nextTrajectory = recordBehaviorShiftIfNeeded(
    nextTrajectory,
    behaviorShift,
    context
  );

  return nextTrajectory;
}

/* -------------------------------------------------------------------------- */
/* 八、完整快照更新                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 更新完整时间线快照
 *
 * 当前第四版更新顺序：
 *
 * 1. 根据当前时间重算 fortune
 * 2. 使用新 fortune 更新 state
 * 3. 自动比较前后 state，写入 recorder
 * 4. 可选记录 behavior_shift
 * 5. 统一刷新 trajectory
 *
 * 注意：
 * - 当前 recorder 只记录 label 级变化
 * - 还没有自动推进 trajectory trend
 */
export function updatePetTimelineSnapshot(
  input: UpdatePetTimelineSnapshotInput
): PetTimelineSnapshot {
  const tickDelta = input.tickDelta ?? 1;

  const nextFortune = buildCurrentTemporalInfluence({
    day: input.day,
    hour: input.hour,
    period: input.period,
  });

  const previousState = input.currentSnapshot.state;

  const nextState = updatePetTimelineState({
    currentState: previousState,
    tickDelta,
    fortune: nextFortune,
    events: input.events,
    playerRelation: input.playerRelation,
  });

  let nextTrajectory = input.currentSnapshot.trajectory;

  const context = {
    tick: input.day * 24 + input.hour,
    day: input.day,
    hour: input.hour,
  };

  nextTrajectory = recordTimelineChangesFromSnapshotUpdate(
    nextTrajectory,
    previousState,
    nextState,
    context,
    input.behaviorShift
  );

  if (input.shouldRefreshTrajectory !== false) {
    nextTrajectory = refreshLifeTrajectory(nextTrajectory);
  }

  return {
    ...input.currentSnapshot,
    state: nextState,
    trajectory: nextTrajectory,
    fortune: nextFortune,
  };
}

/* -------------------------------------------------------------------------- */
/* 九、展示结果构建                                                             */
/* -------------------------------------------------------------------------- */

export function buildPetTimelineViewFromSnapshot(
  snapshot: PetTimelineSnapshot,
  input: {
    day: number;
    hour: number;
    period?: string;
    projectionTitle?: string;
  }
): PetTimelineView {
  const fortuneDisplay = mapTemporalInfluenceToDisplayResult(snapshot.fortune);

  const projection = buildNextFortuneProjection({
    day: input.day,
    hour: input.hour,
    period: input.period,
    title: input.projectionTitle ?? "下一阶段预估",
  });

  const projectionDisplay =
    mapFortuneProjectionToDisplayResult(projection);

  return {
    snapshot,
    fortuneDisplay,
    projectionDisplay,
  };
}

export function buildPetTimelineView(
  input: BuildTemporalInfluenceInput & {
    projectionTitle?: string;
  }
): PetTimelineView {
  const snapshot = buildPetTimelineSnapshot(input);

  return buildPetTimelineViewFromSnapshot(snapshot, {
    day: input.day,
    hour: input.hour,
    period: input.period,
    projectionTitle: input.projectionTitle,
  });
}

/* -------------------------------------------------------------------------- */
/* 十、未来预留接口                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 未来：根据先天人格创建个性化初始时间线
 *
 * 后续建议新增：
 * buildInitialPetTimelineSnapshotFromPersonality(...)
 */

/**
 * 未来：自动把行为系统完整接入
 *
 * 当前 behaviorShift 还是由外部可选传入，
 * 后续可让 petSystem 统一提供 oldAction / newAction，
 * 再由 gateway 自动记录。
 */

/**
 * 未来：trajectory trend 自动演化
 *
 * 当前 recorder 只负责写 history，
 * 后续可在 gateway 里进一步统一串：
 * - recorder
 * - trend updater
 * - branch calculator
 * - summary builder
 */

/**
 * 未来：playerRelation 正式写入 timelineSnapshot / 独立 relation-system
 *
 * 当前这一版只做最小透传，不做持久化主结构改造。
 */