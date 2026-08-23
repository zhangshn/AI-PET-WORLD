"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CurrentTrainingDashboardSnapshot,
  StrictValidationBatch,
  StrictValidationTrajectory,
  TrainingEpochMetric,
  TrainingStagePreview,
  TrainingStageDetail,
} from "../_lib/current-training-dashboard-types";
import { trainingParameterCatalog } from "../_lib/training-parameter-catalog";
import { stageLabel } from "../_lib/training-stage-label";
import {
  ParameterHelpCenter,
  TrainingRecordSelector,
} from "./training-dashboard-controls";
import styles from "./page.module.css";

const activeRefreshDelayMs = 2_000;
const idleRefreshDelayMs = 5_000;
type WorkspaceView =
  | "runs"
  | "validation"
  | "overview"
  | "data"
  | "events"
  | "hardware"
  | "accounting";

const workspaceItems: Array<{
  id: WorkspaceView;
  label: string;
  eyebrow: string;
}> = [
  { id: "runs", label: "Stage训练记录", eyebrow: "TRAINING RECORDS" },
  { id: "validation", label: "严格复验", eyebrow: "VALIDATION REVIEW" },
  { id: "overview", label: "模型与数据", eyebrow: "MODEL & DATA" },
  { id: "data", label: "64组绑定", eyebrow: "CAPACITY ROWS" },
  { id: "events", label: "程序事件", eyebrow: "PROGRAM EVENTS" },
  { id: "hardware", label: "本机硬件", eyebrow: "HARDWARE" },
  { id: "accounting", label: "Token与迁移", eyebrow: "LOCAL AI" },
];

export function CurrentTrainingDashboard() {
  const [snapshot, setSnapshot] =
    useState<CurrentTrainingDashboardSnapshot | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("runs");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    async function refreshAndSchedule() {
      let nextDelayMs = idleRefreshDelayMs;
      try {
        const response = await fetch("/api/ai-painter/current-training", {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(`训练控制台接口返回 ${response.status}`);
        const next =
          (await response.json()) as CurrentTrainingDashboardSnapshot;
        nextDelayMs =
          next.activity.lifecycle === "running" ||
          next.activity.lifecycle === "reviewing" ||
          next.activity.lifecycle === "initializing"
            ? activeRefreshDelayMs
            : idleRefreshDelayMs;
        if (!cancelled) {
          setSnapshot(next);
          setError("");
        }
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "读取当前训练失败",
          );
      } finally {
        if (!cancelled)
          timer = window.setTimeout(
            () => void refreshAndSchedule(),
            nextDelayMs,
          );
      }
    }
    void refreshAndSchedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const latestStage = useMemo(
    () =>
      snapshot
        ? (snapshot.execution.stages.at(-1) ?? null)
        : null,
    [snapshot],
  );
  const activeStage = useMemo(
    () =>
      snapshot
        ? ([...snapshot.execution.stages]
            .reverse()
            .find(
              (stage) =>
                stage.status === "running" || stage.status === "starting",
            ) ?? null)
        : null,
    [snapshot],
  );
  const currentStage = activeStage ?? latestStage;

  if (!snapshot)
    return (
      <section className={styles.loadingPanel}>
        <p className={styles.kicker}>TRAINING CONTROL PLANE</p>
        <h1>正在读取本地训练证据</h1>
        <p>{error || "加载manifest、数据集、整机硬件和程序事件……"}</p>
      </section>
    );

  const selectedStage =
    snapshot.execution.stages.find((stage) => stage.runId === selectedRunId) ??
    currentStage;
  const accountingStage = currentStage?.tokenAccounting
    ? currentStage
    : ([...snapshot.execution.stages]
        .reverse()
        .find((stage) => stage.tokenAccounting) ?? null);
  const headerGpuMemoryPercent = snapshot.gpu.memoryTotalMiB
    ? (snapshot.gpu.memoryUsedMiB / snapshot.gpu.memoryTotalMiB) * 100
    : 0;

  function selectRun(runId: string) {
    setSelectedRunId(runId);
    setActiveView("runs");
  }

  return (
    <div className={styles.monitorShell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.back} href="/ai-painter-progress">
            ← 返回训练主控台
          </Link>
          <Link className={styles.back} href="/ai-painter-progress/task-console">
            本地AI任务操作台 →
          </Link>
          <p className={styles.kicker}>AI PAINTER / V7 LIVE MONITOR</p>
          <h1>当前训练监控台</h1>
          <p>
            顶部固定说明正在做什么；下方工作区按模块局部切换，不离开监控台。
          </p>
        </div>
        <section
          className={styles.headerHardwareDashboard}
          aria-label="顶部实时硬件仪表盘"
          data-testid="header-hardware-dashboard"
        >
          <GaugeMetric
            label="CPU负载"
            value={snapshot.hardware.cpu.loadPercent}
            detail={`${snapshot.hardware.cpu.logicalProcessorCount} 线程`}
            subdetail="实时处理器利用率"
          />
          <GaugeMetric
            label="内存占用"
            value={snapshot.hardware.memory.usagePercent}
            detail={`${formatMib(snapshot.hardware.memory.usedMiB)} / ${formatMib(snapshot.hardware.memory.totalMiB)}`}
            subdetail="物理内存"
          />
          <GaugeMetric
            label="GPU负载"
            value={snapshot.gpu.utilizationPercent}
            detail={snapshot.gpu.name}
            subdetail="图形处理器"
          />
          <GaugeMetric
            label="GPU显存"
            value={headerGpuMemoryPercent}
            detail={`${snapshot.gpu.memoryUsedMiB}/${snapshot.gpu.memoryTotalMiB} MiB`}
            subdetail="显存使用"
          />
        </section>
        <div className={styles.headerTools}>
          <ParameterHelpCenter compact />
          <div className={styles.liveState} data-state={snapshot.status.code}>
            <span>当前系统终态</span>
            <strong>{snapshot.status.label}</strong>
            <small>刷新于 {formatDate(snapshot.generatedAtUtc)}</small>
          </div>
        </div>
      </header>

      <TrainingMission snapshot={snapshot} />

      <section className={styles.workspaceBar} aria-label="训练监控模块导航">
        <nav className={styles.workspaceTabs}>
          {workspaceItems.map((item) => (
            <button
              aria-pressed={activeView === item.id}
              data-testid={`workspace-tab-${item.id}`}
              key={item.id}
              onClick={() => setActiveView(item.id)}
              type="button"
            >
              <span>{item.eyebrow}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>
        <div className={styles.topRecordSelector}>
          <TrainingRecordSelector
            stages={snapshot.execution.stages}
            selectedRunId={selectedStage?.runId}
            onSelectRun={selectRun}
          />
        </div>
      </section>

      <section className={styles.workspaceFrame} data-view={activeView}>
        <header className={styles.workspaceHeader}>
          <div>
            <span>
              {workspaceItems.find((item) => item.id === activeView)?.eyebrow}
            </span>
            <h2>
              {workspaceItems.find((item) => item.id === activeView)?.label}
            </h2>
          </div>
          <small>内容只在本框内切换和滚动 · 顶部训练任务保持可见</small>
        </header>
        <div className={styles.workspaceContent}>
          {activeView === "runs" ? (
            <RunWorkspace
              stage={selectedStage}
              events={snapshot.events.filter(
                (event) => event.runId === selectedStage?.runId,
              )}
            />
          ) : null}
          {activeView === "validation" ? (
            <ValidationWorkspace snapshot={snapshot} />
          ) : null}
          {activeView === "overview" ? (
            <OverviewWorkspace snapshot={snapshot} />
          ) : null}
          {activeView === "data" ? <DataWorkspace snapshot={snapshot} /> : null}
          {activeView === "events" ? (
            <EventsWorkspace snapshot={snapshot} />
          ) : null}
          {activeView === "hardware" ? (
            <HardwareWorkspace snapshot={snapshot} />
          ) : null}
          {activeView === "accounting" ? (
            <AccountingWorkspace snapshot={snapshot} stage={accountingStage} />
          ) : null}
        </div>
      </section>
      {error ? (
        <p className={styles.error}>
          自动刷新失败：{error}；页面保留上一次成功快照。
        </p>
      ) : null}
    </div>
  );
}

function TrainingMission({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  const [liveOutputOpen, setLiveOutputOpen] = useState(false);
  const activity = snapshot.activity;
  const isTraining = activity.localAiProcessActive;
  const activeProgressStage = [...snapshot.execution.stages]
    .reverse()
    .find((stage) => stage.runId === activity.progress.runId) ?? null;
  const stageChain = [0, 1, 2].map(
    (index) =>
      [...snapshot.execution.stages]
        .reverse()
        .find(
          (stage) => stage.kind === "stage" && stage.resolutionStage === index,
        ) ?? null,
  );
  const targetEpoch = snapshot.model.epochTargetPerStage ?? 40;
  const gpuMemoryPercent = snapshot.gpu.memoryTotalMiB
    ? (snapshot.gpu.memoryUsedMiB / snapshot.gpu.memoryTotalMiB) * 100
    : 0;
  useEffect(() => {
    if (!liveOutputOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setLiveOutputOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [liveOutputOpen]);
  return (
    <section
      className={styles.missionBoard}
      data-lifecycle={activity.lifecycle}
      data-testid="execution-actor-board"
      data-training={isTraining}
    >
      <button
        aria-expanded={liveOutputOpen}
        aria-haspopup="dialog"
        aria-live="polite"
        className={styles.executionSafetyNotice}
        data-active={isTraining}
        data-stalled={activity.stalled}
        data-testid="training-continuation-notice"
        onClick={() => setLiveOutputOpen(true)}
        title="点击查看只读实时训练输出"
        type="button"
      >
        <strong>
          {isTraining
            ? "● 训练持续执行中｜请勿重复启动"
            : activity.stalled
              ? "● 训练心跳异常｜请先查看证据，不要重复启动"
              : "● 当前未检测到训练进程"}
        </strong>
        <span>
          {isTraining
            ? `${activity.progress.stageLabel ?? "训练阶段"} · Epoch ${activity.progress.epoch ?? "—"}/${activity.progress.epochTarget ?? "—"} · 优化步 ${activity.progress.optimizerStep ?? "—"}/${activity.progress.optimizerStepTarget ?? "—"}`
            : activity.lifecycleLabelZh}
        </span>
        <small>
          {isTraining
            ? `最新落盘心跳：${formatDetailedTimestamp(activity.lastHeartbeatAtAsiaShanghai ?? activity.lastHeartbeatAtUtc)}；点击查看实时输出，刷新或关闭本页面不会中断训练。`
            : "点击查看只读状态；本提示不会启动、暂停或修改训练。"}
        </small>
      </button>
      <div className={styles.missionIdentity}>
        <div className={styles.trainingBeacon}>
          <i />
          <div>
            <span>当前执行主体</span>
            <strong>{activity.actorLabelZh}</strong>
          </div>
        </div>
        <p>{activity.taskLabelZh} · {activity.lifecycleLabelZh}</p>
        <strong
          className={styles.localAiIndicator}
          data-active={activity.localAiProcessActive}
          data-testid="local-ai-active-indicator"
        >
          {activity.localAiProcessActive
            ? "本地AI正在工作"
            : "本地AI未运行"}
        </strong>
        <small>{activity.detailZh}</small>
      </div>
      <div className={styles.missionFacts}>
        <Definition
          label="当前任务"
          value={activity.taskId ?? "没有活动任务"}
          mono
        />
        <Definition
          label="本地命令"
          value={activity.process.commandIdentity ?? "没有活动命令"}
          mono
        />
        <Definition
          label="进程"
          value={`控制器 ${activity.process.controllerPid ?? "—"} / 子进程 ${activity.process.childPid ?? "—"}`}
          mono
        />
        <Definition
          label="最新心跳"
          value={formatDetailedTimestamp(activity.lastHeartbeatAtAsiaShanghai ?? activity.lastHeartbeatAtUtc)}
        />
        <small
          className={styles.heartbeatLine}
          data-stalled={activity.stalled}
          data-testid="execution-heartbeat"
        >
          {activity.heartbeatAgeSeconds === null
            ? "无心跳记录"
            : `${Math.round(activity.heartbeatAgeSeconds)} 秒前 · ${activity.process.childAlive ? "子进程存活" : "子进程不存在"}`}
        </small>
      </div>
      <div className={styles.missionProgress}>
        <div className={styles.stageRail}>
          {stageChain.map((stage, index) => (
            <article
              data-active={stage?.resolutionStage === activity.progress.stageIndex && isTraining}
              data-complete={
                stage?.status ===
                  "conditional_denoiser_training_completed_pending_validation" ||
                stage?.status === "completed"
              }
              key={index}
            >
              <span>STAGE {index}</span>
              <strong>
                {stage?.resolution
                  ? `${stage.resolution.width}×${stage.resolution.height}`
                  : "等待"}
              </strong>
              <small>
                {stage
                  ? `${stage.epochCount}/${targetEpoch} Epoch`
                  : "尚无记录"}
              </small>
            </article>
          ))}
        </div>
        <div className={styles.progressLine}>
          <div>
            <span>当前任务实时进度</span>
            <strong>
              {activity.progress.epoch === null
                ? "当前没有运行任务"
                : `Epoch ${activity.progress.epoch}/${activity.progress.epochTarget ?? "?"}${activity.progress.batch === null ? "" : ` · Batch ${activity.progress.batch}/${activity.progress.batchTarget ?? "?"}`}`}
            </strong>
          </div>
          <span>
            <i
              style={{
                width: `${activity.progress.percentage ?? 0}%`,
              }}
            />
          </span>
        </div>
        <div className={styles.missionTelemetry} data-testid="execution-progress">
          <span>
            阶段 <b>{formatLivePhase(activity.progress.phase)}</b>
          </span>
          <span>
            Loss <b>{formatMetric(activity.progress.trainCompositeLoss)}</b>
          </span>
          <span>
            优化步 <b>{activity.progress.optimizerStep ?? "—"}/{activity.progress.optimizerStepTarget ?? "—"}</b>
          </span>
          <span>
            速度 <b>{activity.progress.optimizerStepsPerSecond === null ? "—" : `${activity.progress.optimizerStepsPerSecond.toFixed(3)} step/s`}</b>
          </span>
          <span>
            ETA <b>{activity.progress.etaSeconds === null ? "—" : formatUptime(activity.progress.etaSeconds)}</b>
          </span>
          <span>
            GPU <b>{snapshot.gpu.utilizationPercent}% / 显存 {Math.round(gpuMemoryPercent)}%</b>
          </span>
        </div>
      </div>
      <div className={styles.missionAccounting} data-testid="token-source-boundaries">
        <span>COMPUTE / TOKEN来源</span>
        <dl>
          <Definition
            label="本地模型计算量"
            value={activity.accounting.localModel.available
              ? `${formatInteger(activity.accounting.localModel.total ?? undefined)} ${activity.accounting.localModel.unit}`
              : "当前任务未记录"}
            mono
          />
          <Definition
            label="外部API Token"
            value={activity.accounting.externalApi.available
              ? formatInteger(activity.accounting.externalApi.totalTokens ?? undefined)
              : "当前任务未使用/未记录"}
          />
          <Definition label="Codex Token" value="本地程序不可读取" />
        </dl>
        <small>{activity.accounting.codex.noteZh}</small>
      </div>
      <div
        className={styles.missionCapsule}
        data-integrity={snapshot.taskCapsule.integrity.status}
        data-testid="local-task-capsule"
      >
        <span>LOCAL TASK CAPSULE / V1</span>
        <strong>{snapshot.taskCapsule.module.nameZh}</strong>
        <dl>
          <Definition
            label="固定总进度"
            value={`${snapshot.taskCapsule.fixedOverallProgress.completedStages ?? "—"}/${snapshot.taskCapsule.fixedOverallProgress.totalStages ?? "—"}（${snapshot.taskCapsule.fixedOverallProgress.percent ?? "—"}%）`}
          />
          <Definition
            label="当前阶段"
            value={`${snapshot.taskCapsule.currentStage.number}/${snapshot.taskCapsule.currentStage.total} · ${snapshot.taskCapsule.currentStage.status}`}
          />
          <Definition
            label="候选终态"
            value={`${snapshot.taskCapsule.candidateTerminal.status} · 预览 ${snapshot.taskCapsule.candidateTerminal.previewPassCount ?? "—"}/${snapshot.taskCapsule.candidateTerminal.previewCount ?? "—"}`}
          />
          <Definition
            label="证据完整性"
            value={`${snapshot.taskCapsule.integrity.status} · ${snapshot.taskCapsule.evidence.filter((item) => item.sha256Verified).length}/${snapshot.taskCapsule.evidence.length}`}
          />
        </dl>
        <code>{snapshot.taskCapsule.latestBlocker.code}</code>
        <small>
          禁止动作 {snapshot.taskCapsule.forbiddenActions.length} 项 · 样本 {snapshot.taskCapsule.taskIdentity.conditionLabel ?? "未记录"} · Seed {snapshot.taskCapsule.taskIdentity.seed ?? "未记录"}
        </small>
      </div>
      <div className={styles.missionGate}>
        <span>业务终态 / OWNER ACTION</span>
        <strong>{snapshot.taskCapsule.latestBlocker.summaryZh}</strong>
        <p>{snapshot.taskCapsule.nextAllowedAction.labelZh}</p>
        <code>{snapshot.taskCapsule.nextAllowedAction.code}</code>
        <small className={styles.gateTimestamp}>
          记录时间：
          {formatDetailedTimestamp(
            snapshot.taskCapsule.candidateTerminal.recordedAtAsiaShanghai ??
              snapshot.taskCapsule.candidateTerminal.recordedAtUtc,
          )}
        </small>
      </div>
      {liveOutputOpen ? (
        <LiveTrainingOutputDialog
          onClose={() => setLiveOutputOpen(false)}
          snapshot={snapshot}
          stage={activeProgressStage}
        />
      ) : null}
    </section>
  );
}

function LiveTrainingOutputDialog({
  snapshot,
  stage,
  onClose,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
  stage: TrainingStageDetail | null;
  onClose: () => void;
}) {
  const [followLatest, setFollowLatest] = useState(true);
  const outputStreamRef = useRef<HTMLDivElement>(null);
  const activity = snapshot.activity;
  const progress = activity.progress;
  const epochHistory = stage?.metrics ?? [];
  const recentMetrics = [...epochHistory].reverse().slice(0, 8);
  const eventHistory = snapshot.events
    .filter((event) => !progress.runId || event.runId === progress.runId)
    .reverse();
  const heartbeatTimestamp = formatDetailedTimestamp(
    activity.lastHeartbeatAtAsiaShanghai ?? activity.lastHeartbeatAtUtc,
  );
  useEffect(() => {
    if (!followLatest) return;
    const frame = window.requestAnimationFrame(() => {
      const output = outputStreamRef.current;
      if (output) output.scrollTop = output.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [followLatest, progress.optimizerStep, epochHistory.length, eventHistory.length]);

  function resumeFollowingLatest() {
    setFollowLatest(true);
    window.requestAnimationFrame(() => {
      const output = outputStreamRef.current;
      if (output) output.scrollTop = output.scrollHeight;
    });
  }
  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label="只读实时训练输出"
        aria-modal="true"
        className={styles.liveOutputDialog}
        data-testid="live-training-output-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span>LOCAL READ-ONLY TRAINING OUTPUT</span>
            <h2>实时训练输出</h2>
            <p>本窗口约每2秒读取本地进度证据，不会控制或修改训练。</p>
          </div>
          <button
            aria-label="关闭实时训练输出"
            data-testid="live-training-output-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className={styles.liveOutputStatusGrid}>
          <Definition label="运行状态" value={`${activity.lifecycleLabelZh} · ${activity.process.childAlive ? "训练进程存活" : "未检测到训练子进程"}`} />
          <Definition label="当前阶段" value={`${progress.stageLabel ?? "—"} · ${progress.resolution ?? "—"}`} />
          <Definition label="Epoch / Batch" value={`${progress.epoch ?? "—"}/${progress.epochTarget ?? "—"} · ${progress.batch ?? "—"}/${progress.batchTarget ?? "—"}`} />
          <Definition label="优化步" value={`${progress.optimizerStep ?? "—"}/${progress.optimizerStepTarget ?? "—"}`} />
          <Definition label="阶段进度" value={`${(progress.percentage ?? 0).toFixed(2)}%`} />
          <Definition label="动态 ETA" value={progress.etaSeconds === null ? "—" : formatUptime(progress.etaSeconds)} />
          <Definition label="当前 Loss" value={formatMetric(progress.trainCompositeLoss)} />
          <Definition label="训练速度" value={progress.optimizerStepsPerSecond === null ? "—" : `${progress.optimizerStepsPerSecond.toFixed(3)} step/s`} />
        </div>

        <div className={styles.liveOutputProgressBar}>
          <span style={{ width: `${progress.percentage ?? 0}%` }} />
        </div>

        <section className={styles.liveOutputConsolePanel}>
          <header>
            <div>
              <strong>本次运行输出历史</strong>
              <small>已落盘 {epochHistory.length} 个Epoch · 最新内容在底部</small>
            </div>
            <button
              data-following={followLatest}
              onClick={resumeFollowingLatest}
              type="button"
            >
              {followLatest ? "正在跟随最新" : "回到最新"}
            </button>
          </header>
          <div
            className={styles.liveOutputConsole}
            data-testid="live-training-output-stream"
            onScroll={(event) => {
              const output = event.currentTarget;
              const atBottom =
                output.scrollHeight - output.scrollTop - output.clientHeight < 24;
              setFollowLatest(atBottom);
            }}
            ref={outputStreamRef}
          >
            <code>[RUN] {progress.runId ?? activity.taskId ?? "no-active-run"}</code>
            <code>[SOURCE] {activity.sourcePath ?? activity.source}</code>
            {eventHistory.map((event) => (
              <code key={`event-${event.id}`}>[{formatDetailedTimestamp(event.timestamp)}] EVENT {event.status} · {event.title}</code>
            ))}
            {epochHistory.map((metric) => (
              <code key={`epoch-${metric.epoch}`}>
                [{formatDetailedTimestamp(metric.recordedAtAsiaShanghai ?? metric.recordedAtUtc)}] EPOCH {metric.epoch} completed · trainLoss={formatMetric(metric.trainCompositeLoss)} · validation={formatMetric(metric.validationCompositeScore)} · checkpoint={formatMetric(metric.validationCheckpointScore)}
              </code>
            ))}
            <code>[{heartbeatTimestamp}] HEARTBEAT received</code>
            <code>[PHASE] {formatLivePhase(progress.phase)}</code>
            <code>[PROGRESS] Epoch {progress.epoch ?? "—"}/{progress.epochTarget ?? "—"} · Batch {progress.batch ?? "—"}/{progress.batchTarget ?? "—"} · Step {progress.optimizerStep ?? "—"}/{progress.optimizerStepTarget ?? "—"}</code>
            <code>[GPU] utilization={snapshot.gpu.utilizationPercent}% memory={snapshot.gpu.memoryUsedMiB}/{snapshot.gpu.memoryTotalMiB} MiB</code>
          </div>
        </section>

        <section className={styles.liveOutputEpochs}>
          <header>
            <strong>最近完成的 Epoch</strong>
            <small>{recentMetrics.length ? `显示 ${recentMetrics.length} 条最新记录` : "正在等待首个Epoch落盘"}</small>
          </header>
          <div>
            {recentMetrics.map((metric) => (
              <article key={metric.epoch}>
                <strong>Epoch {metric.epoch}</strong>
                <span>训练Loss {formatMetric(metric.trainCompositeLoss)}</span>
                <span>验证分 {formatMetric(metric.validationCompositeScore)}</span>
                <span>Checkpoint分 {formatMetric(metric.validationCheckpointScore)}</span>
                <small>{formatDetailedTimestamp(metric.recordedAtAsiaShanghai ?? metric.recordedAtUtc)}</small>
              </article>
            ))}
          </div>
        </section>

        <footer className={styles.liveOutputFooter}>
          <span>聊天定时推送已关闭；此窗口由本地监控台持续更新。</span>
          <code>{progress.runId ?? "no-active-run"}</code>
        </footer>
      </section>
    </div>
  );
}

function RunWorkspace({
  stage,
  events,
}: {
  stage: TrainingStageDetail | null;
  events: CurrentTrainingDashboardSnapshot["events"];
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] =
    useState<TrainingStagePreview | null>(null);
  if (!stage)
    return <p className={styles.empty}>当前没有可显示的Stage训练记录。</p>;
  return (
    <>
      <div className={styles.inlineRunWorkspace}>
        <section className={styles.inlineRunSummary}>
          <div className={styles.inlineRunTitle}>
            <div>
              <span>SELECTED RUN</span>
              <h3>{stageLabel(stage)}</h3>
              <code>{stage.runId}</code>
            </div>
            <button
              className={styles.openEvidenceButton}
              data-testid="run-evidence-dialog-open"
              onClick={() => setEvidenceOpen(true)}
              type="button"
            >
              查看完整证据
            </button>
          </div>
          <dl className={styles.stageSummary}>
            <Definition label="状态" value={stage.status} />
            <Definition label="处置" value={verdictLabel(stage.verdict)} />
            <Definition label="Epoch" value={`${stage.epochCount}`} />
            <Definition
              label="最佳Epoch"
              value={`${stage.bestEpoch ?? "--"}`}
            />
            <Definition
              label="最佳验证值"
              value={formatMetric(stage.bestValidationMetric)}
            />
            <Definition
              label="分辨率"
              value={
                stage.resolution
                  ? `${stage.resolution.width}×${stage.resolution.height}`
                  : "--"
              }
            />
            <Definition
              label="实际V7样本"
              value={`${stage.actualLoadedV7CapacityCount ?? "--"}`}
            />
            <Definition
              label="耗时"
              value={
                stage.durationSeconds === null
                  ? "--"
                  : `${stage.durationSeconds.toFixed(1)}秒`
              }
            />
            <Definition
              label="记录时间"
              value={formatDetailedTimestamp(
                stage.createdAtAsiaShanghai ?? stage.createdAtUtc,
              )}
            />
            {stage.liveProgress ? (
              <>
                <Definition
                  label="实时阶段"
                  value={formatLivePhase(stage.liveProgress.phase)}
                />
                <Definition
                  label="实时Epoch"
                  value={`${stage.liveProgress.epoch ?? "—"}/${stage.liveProgress.epochTarget ?? "—"}`}
                />
                <Definition
                  label="实时Batch"
                  value={`${stage.liveProgress.batch ?? "—"}/${stage.liveProgress.batchTarget ?? "—"}`}
                />
                <Definition
                  label="优化步"
                  value={`${stage.liveProgress.optimizerStep ?? "—"}/${stage.liveProgress.optimizerStepTarget ?? "—"}`}
                />
                <Definition
                  label="Batch Loss"
                  value={formatMetric(stage.liveProgress.batchLoss)}
                />
                <Definition
                  label="Epoch滚动Loss"
                  value={formatMetric(stage.liveProgress.rollingEpochLoss)}
                />
                <Definition
                  label="实时速度"
                  value={stage.liveProgress.optimizerStepsPerSecond === null
                    ? "—"
                    : `${stage.liveProgress.optimizerStepsPerSecond.toFixed(3)} step/s`}
                />
                <Definition
                  label="预计剩余"
                  value={stage.liveProgress.etaSeconds === null
                    ? "—"
                    : formatUptime(stage.liveProgress.etaSeconds)}
                />
                <Definition
                  label="本地计算Token"
                  value={formatInteger(stage.liveProgress.localTrainingTokenCount ?? undefined)}
                />
                <Definition
                  label="实时更新时间"
                  value={formatDetailedTimestamp(
                    stage.liveProgress.recordedAtAsiaShanghai ??
                      stage.liveProgress.recordedAtUtc,
                  )}
                />
              </>
            ) : null}
          </dl>
          <section
            className={styles.runPreviewSection}
            data-testid="run-preview-section"
          >
            <header>
              <div>
                <span>STAGE PREVIEWS</span>
                <h3>训练过程图 · {stage.previews.length} 张</h3>
              </div>
              <small>
                {stage.previewGateStatus ?? "没有程序保存的预览审核记录"}
              </small>
            </header>
            {stage.previews.length ? (
              <div className={styles.runPreviewGrid}>
                {stage.previews.map((preview) => (
                  <button
                    className={styles.runPreviewCard}
                    data-passed={preview.machineReviewPassed}
                    data-testid={`run-preview-card-${preview.epoch}`}
                    key={`${stage.runId}-${preview.epoch}`}
                    onClick={() => setSelectedPreview(preview)}
                    type="button"
                  >
                    <Image
                      alt={`${stageLabel(stage)} Epoch ${preview.epoch} 训练预览`}
                      height={192}
                      src={validationImageUrl(preview.normalizedReviewImagePath ?? preview.imagePath)}
                      unoptimized
                      width={256}
                    />
                    <span>
                      <strong>Epoch {preview.epoch}</strong>
                      <small>
                        {formatDetailedTimestamp(
                          preview.recordedAtAsiaShanghai ?? preview.recordedAtUtc,
                        )}
                      </small>
                    </span>
                    <b>
                      {preview.machineReviewPassed === null
                        ? "未审核"
                        : preview.machineReviewPassed
                          ? "通过"
                          : "拒绝"}
                    </b>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>
                该 Run 没有程序保存的训练预览图，不使用占位图代替。
              </p>
            )}
          </section>
          {stage.metrics.length ? (
            <MetricChart metrics={stage.metrics} />
          ) : (
            <p className={styles.empty}>该记录尚无Epoch指标。</p>
          )}
          <div className={styles.checkpointBox}>
            <div>
              <span>Checkpoint</span>
              <code>{stage.checkpointPath ?? "未创建"}</code>
              <small>{stage.checkpointSha256 ?? "--"}</small>
            </div>
            <div>
              <span>Parent Checkpoint</span>
              <code>{stage.parentCheckpointPath ?? "无父Checkpoint"}</code>
              <small>{stage.parentCheckpointSha256 ?? "--"}</small>
            </div>
            <div>
              <span>Manifest / Progress</span>
              <code>{stage.manifestPath}</code>
              <small>{stage.manifestSha256 ?? "--"}</small>
            </div>
          </div>
        </section>
        <section className={styles.inlineEpochPanel}>
          <header>
            <div>
              <span>EPOCH RECORDS</span>
              <h3>全部 {stage.metrics.length} 个Epoch</h3>
            </div>
            <small>表格在本框内滚动</small>
          </header>
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th>详细时间戳</th>
                  <th>本地Token</th>
                  <th>训练综合损失</th>
                  <th>验证综合分</th>
                  <th>Checkpoint选择分</th>
                  <th>最坏轨迹</th>
                  <th>最佳更新</th>
                </tr>
              </thead>
              <tbody>
                {stage.metrics.map((metric) => (
                  <tr key={metric.epoch}>
                    <td>{metric.epoch}</td>
                    <td>
                      {formatDetailedTimestamp(
                        metric.recordedAtAsiaShanghai ?? metric.recordedAtUtc,
                      )}
                    </td>
                    <td>
                      {formatInteger(
                        stage.tokenAccounting?.perEpoch.latentSpatialTokens,
                      )}
                    </td>
                    <td>{formatMetric(metric.trainCompositeLoss)}</td>
                    <td>{formatMetric(metric.validationCompositeScore)}</td>
                    <td>{formatMetric(metric.validationCheckpointScore)}</td>
                    <td>{formatMetric(metric.rolloutWorstTrajectoryScore)}</td>
                    <td>
                      <StatusMark value={metric.bestCheckpointUpdated} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stage.tokenAccounting ? (
            <div className={styles.inlineTokenStrip}>
              <span>
                本地潜空间Token{" "}
                <b>
                  {formatInteger(
                    stage.tokenAccounting.runTotals.latentSpatialTokens,
                  )}
                </b>
              </span>
              <span>
                优化步{" "}
                <b>
                  {formatInteger(
                    stage.tokenAccounting.runTotals.optimizerSteps,
                  )}
                </b>
              </span>
              <span>
                RGB预测像素{" "}
                <b>
                  {formatInteger(
                    stage.tokenAccounting.runTotals.decodedRgbPixelPredictions,
                  )}
                </b>
              </span>
              <span>
                外部API Token{" "}
                <b>
                  {formatInteger(stage.tokenAccounting.externalApi.totalTokens)}
                </b>
              </span>
            </div>
          ) : null}
          {events.length ? (
            <div className={styles.inlineEvents}>
              {events.slice(0, 8).map((event) => (
                <article key={event.id}>
                  <span data-status={event.status}>{event.status}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{formatDate(event.timestamp)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
      {evidenceOpen ? (
        <RunEvidenceDialog
          stage={stage}
          onClose={() => setEvidenceOpen(false)}
        />
      ) : null}
      {selectedPreview ? (
        <RunPreviewDialog
          onClose={() => setSelectedPreview(null)}
          preview={selectedPreview}
          stage={stage}
        />
      ) : null}
    </>
  );
}

function ValidationWorkspace({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedTrajectory, setSelectedTrajectory] =
    useState<StrictValidationTrajectory | null>(null);
  const batch =
    snapshot.validation.batches.find(
      (item) => item.batchId === selectedBatchId,
    ) ?? snapshot.validation.batches.at(0) ?? null;

  if (!batch)
    return (
      <p className={styles.empty} data-testid="strict-validation-workspace">
        当前没有程序保存的严格复验批次。
      </p>
    );

  return (
    <>
      <div
        className={styles.validationWorkspace}
        data-testid="strict-validation-workspace"
      >
        <aside className={styles.validationBatchRail}>
          <div>
            <span>VALIDATION BATCH</span>
            <h3>严格复验批次</h3>
            <p>选择批次只切换本工作区，不离开训练监控台。</p>
          </div>
          <select
            aria-label="选择严格复验批次"
            data-testid="strict-validation-batch-selector"
            onChange={(event) => setSelectedBatchId(event.target.value)}
            value={batch.batchId}
          >
            {snapshot.validation.batches.map((item) => (
              <option key={item.batchId} value={item.batchId}>
                {formatDetailedTimestamp(
                  item.createdAtAsiaShanghai ?? item.createdAtUtc,
                )} · {item.completedTrajectoryCount}/{item.plannedTrajectoryCount}
              </option>
            ))}
          </select>
          <dl className={styles.validationBatchSummary}>
            <Definition label="状态" value={batch.status} mono />
            <Definition
              label="创建时间（北京时间）"
              value={formatDetailedTimestamp(
                batch.createdAtAsiaShanghai ?? batch.createdAtUtc,
              )}
            />
            <Definition
              label="完成时间（北京时间）"
              value={formatDetailedTimestamp(
                batch.completedAtAsiaShanghai ?? batch.completedAtUtc,
              )}
            />
            <Definition
              label="完成轨迹"
              value={`${batch.completedTrajectoryCount}/${batch.plannedTrajectoryCount}`}
            />
            <Definition
              label="机器通过 / 拒绝"
              value={`${batch.machinePassedCount} / ${batch.machineRejectedCount}`}
            />
            <Definition
              label="本地潜空间Token"
              value={formatInteger(
                batch.validationTokenAccounting.latentSpatialTokens,
              )}
            />
            <Definition
              label="重复输出Hash"
              value={`${batch.duplicateOutputHashes.length}`}
            />
            <Definition
              label="训练权重改动"
              value={batch.trainingWeightsModified ? "是" : "否"}
            />
          </dl>
          <div className={styles.validationEligibility}>
            <StatusMark value={batch.formalInferenceEligible} /> 正式推理
            <StatusMark value={batch.runtimeFrameEligible} /> RuntimeFrame
            <StatusMark value={batch.canEnterWorld} /> 进入世界
          </div>
          <EvidenceFile
            label="批次报告"
            path={batch.reportPath}
            sha256={batch.reportSha256}
          />
        </aside>

        <section className={styles.validationTrajectoryPanel}>
          <header>
            <div>
              <span>VISUAL TRAJECTORY REVIEW</span>
              <h3>{batch.trajectories.length} 张复验图</h3>
            </div>
            <p>点击图片查看条件、Seed、门禁、拒绝原因、Hash和Token。</p>
          </header>
          <div className={styles.validationTrajectoryGrid}>
            {batch.trajectories.map((trajectory, index) => (
              <button
                className={styles.validationTrajectoryCard}
                data-status={trajectory.status}
                data-testid={`strict-validation-trajectory-card-${index}`}
                key={`${trajectory.runId}-${trajectory.seedIndex}`}
                onClick={() => setSelectedTrajectory(trajectory)}
                type="button"
              >
                <div className={styles.validationThumbnail}>
                  {trajectory.outputImagePath ? (
                    <Image
                      alt={`${trajectory.conditionLabel} 严格复验图`}
                      height={768}
                      src={validationImageUrl(trajectory.outputImagePath)}
                      unoptimized
                      width={1024}
                    />
                  ) : (
                    <span>本轨迹未生成图片</span>
                  )}
                  <b>{trajectory.status === "machine_passed" ? "通过" : "拒绝"}</b>
                </div>
                <div className={styles.validationCardBody}>
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <strong>{trajectory.conditionLabel}</strong>
                  <small>
                    Seed {trajectory.seed} · {trajectory.split} ·{" "}
                    {(trajectory.durationMs / 1000).toFixed(3)}秒
                  </small>
                  <div className={styles.validationIssueChips}>
                    {trajectory.machineReviewIssueCodes.map((code) => (
                      <code key={code}>{code}</code>
                    ))}
                    {!trajectory.machineReviewIssueCodes.length ? (
                      <code>没有机器拒绝码</code>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
      {selectedTrajectory ? (
        <ValidationTrajectoryDialog
          batch={batch}
          onClose={() => setSelectedTrajectory(null)}
          trajectory={selectedTrajectory}
        />
      ) : null}
    </>
  );
}

function RunPreviewDialog({
  stage,
  preview,
  onClose,
}: {
  stage: TrainingStageDetail;
  preview: TrainingStagePreview;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.validationDialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label={`${stageLabel(stage)} Epoch ${preview.epoch} 训练预览详情`}
        aria-modal="true"
        className={styles.validationDialog}
        data-testid="run-preview-dialog"
        role="alertdialog"
      >
        <header>
          <div>
            <span>TRAINING PREVIEW EVIDENCE</span>
            <h2>{stageLabel(stage)} · Epoch {preview.epoch}</h2>
            <code>{stage.runId}</code>
          </div>
          <button
            aria-label="关闭训练预览详情"
            data-testid="run-preview-dialog-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.validationDialogBody}>
          <div className={styles.runPreviewDialogImage}>
            <Image
              alt={`${stageLabel(stage)} Epoch ${preview.epoch} 训练预览原图`}
              height={192}
              priority
              src={validationImageUrl(preview.normalizedReviewImagePath ?? preview.imagePath)}
              unoptimized
              width={256}
            />
          </div>
          <div className={styles.validationDialogDetails}>
            <section>
              <PanelTitle eyebrow="IDENTITY & TIME" title="Epoch、状态与详细时间戳" />
              <dl className={styles.definitionGrid}>
                <Definition label="Epoch" value={`${preview.epoch}`} />
                <Definition
                  label="机器审核"
                  value={
                    preview.machineReviewPassed === null
                      ? "未审核"
                      : preview.machineReviewPassed
                        ? "通过"
                        : "拒绝"
                  }
                />
                <Definition
                  label="记录时间（北京时间）"
                  value={formatDetailedTimestamp(
                    preview.recordedAtAsiaShanghai ?? preview.recordedAtUtc,
                  )}
                />
                <Definition
                  label="记录时间（UTC原值）"
                  value={preview.recordedAtUtc ?? "未记录"}
                  mono
                />
              </dl>
            </section>
            <section>
              <PanelTitle eyebrow="MACHINE REVIEW" title="机器拒绝码" />
              <div className={styles.validationIssueChips}>
                {preview.machineReviewIssueCodes.map((code) => (
                  <code key={code}>{code}</code>
                ))}
                {!preview.machineReviewIssueCodes.length ? (
                  <code>没有机器拒绝码</code>
                ) : null}
              </div>
            </section>
            <section>
              <PanelTitle eyebrow="IMMUTABLE FILES" title="预览图与审核文件" />
              <div className={styles.evidenceDialogFiles}>
                <EvidenceFile
                  label="训练预览原图"
                  path={preview.imagePath}
                  sha256={preview.imageSha256}
                />
                <EvidenceFile
                  label="规范化审核图"
                  path={preview.normalizedReviewImagePath}
                  sha256={preview.normalizedReviewImageSha256}
                />
                <EvidenceFile
                  label="预览审核报告"
                  path={stage.previewReviewPath}
                  sha256={stage.previewReviewSha256}
                />
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function ValidationTrajectoryDialog({
  batch,
  trajectory,
  onClose,
}: {
  batch: StrictValidationBatch;
  trajectory: StrictValidationTrajectory;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.validationDialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label={`${trajectory.conditionLabel}严格复验详情`}
        aria-modal="true"
        className={styles.validationDialog}
        data-testid="strict-validation-trajectory-dialog"
        role="alertdialog"
      >
        <header>
          <div>
            <span>STRICT VALIDATION EVIDENCE</span>
            <h2>{trajectory.conditionLabel} · 可视化审核</h2>
            <code>{trajectory.runId}</code>
          </div>
          <button
            aria-label="关闭严格复验详情"
            data-testid="strict-validation-trajectory-dialog-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.validationDialogBody}>
          <div className={styles.validationDialogImage}>
            {trajectory.outputImagePath ? (
              <Image
                alt={`${trajectory.conditionLabel} 1024×768严格复验原图`}
                height={768}
                priority
                src={validationImageUrl(trajectory.outputImagePath)}
                unoptimized
                width={1024}
              />
            ) : (
              <p>执行失败，程序没有保存输出图片。</p>
            )}
          </div>
          <div className={styles.validationDialogDetails}>
            <section>
              <PanelTitle eyebrow="IDENTITY" title="条件、Seed与时间" />
              <dl className={styles.definitionGrid}>
                <Definition label="Record ID" value={trajectory.recordId} mono />
                <Definition
                  label="Condition Label"
                  value={trajectory.conditionLabel}
                  mono
                />
                <Definition label="Split" value={trajectory.split} />
                <Definition label="Seed Index" value={`${trajectory.seedIndex}`} />
                <Definition label="Seed" value={`${trajectory.seed}`} mono />
                <Definition
                  label="耗时"
                  value={`${(trajectory.durationMs / 1000).toFixed(3)}秒`}
                />
                <Definition
                  label="审核时间（北京时间）"
                  value={formatDetailedTimestamp(
                    trajectory.reviewedAtAsiaShanghai ?? trajectory.reviewedAtUtc,
                  )}
                />
                <Definition
                  label="审核时间（UTC原值）"
                  value={trajectory.reviewedAtUtc ?? "未记录"}
                  mono
                />
              </dl>
            </section>
            <section>
              <PanelTitle eyebrow="MACHINE GATES" title="机器审核门禁" />
              <div className={styles.validationGates}>
                {trajectory.gates.map((gate) => (
                  <div key={gate.gate} data-passed={gate.passed}>
                    <StatusMark value={gate.passed} />
                    <strong>{gate.gate}</strong>
                    <small>
                      {gate.issueCodes.length
                        ? gate.issueCodes.join(" · ")
                        : "没有拒绝码"}
                    </small>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <PanelTitle eyebrow="REJECTION DICTIONARY" title="机器拒绝原因" />
              <div className={styles.validationIssueDetails}>
                {trajectory.machineReviewIssueCodes.map((code) => {
                  const evidence = trajectory.issues.find(
                    (issue) => issue.code === code,
                  );
                  const definition = trainingParameterCatalog.find(
                    (item) => item.code === code,
                  );
                  return (
                    <article key={code}>
                      <code>{code}</code>
                      <strong>
                        {evidence?.messageZh ??
                          definition?.plainLanguage ??
                          "机器审核未保存中文解释"}
                      </strong>
                      <p>
                        {definition?.interpretation ?? evidence?.message ?? "--"}
                      </p>
                      <small>
                        区域：{evidence?.affectedRegion ?? "未记录"} · 修复目标：
                        {evidence?.nextTrainingTarget ?? "未记录"}
                      </small>
                    </article>
                  );
                })}
              </div>
            </section>
            <section>
              <PanelTitle eyebrow="TOKEN & FILES" title="本地计算与不可变文件" />
              <dl className={styles.definitionGrid}>
                <Definition
                  label="本地潜空间Token"
                  value={formatInteger(
                    trajectory.validationTokenAccounting.latentSpatialTokens,
                  )}
                />
                <Definition
                  label="Denoiser前向"
                  value={formatInteger(
                    trajectory.validationTokenAccounting
                      .denoiserSampleForwardPasses,
                  )}
                />
                <Definition
                  label="RGB预测像素"
                  value={formatInteger(
                    trajectory.validationTokenAccounting
                      .decodedRgbPixelPredictions,
                  )}
                />
                <Definition
                  label="外部API Token"
                  value={formatInteger(
                    trajectory.validationTokenAccounting.externalApiTokens,
                  )}
                />
              </dl>
              <div className={styles.evidenceDialogFiles}>
                <EvidenceFile
                  label="复验输出图"
                  path={trajectory.outputImagePath}
                  sha256={trajectory.outputImageSha256}
                />
                <EvidenceFile
                  label="机器审核"
                  path={trajectory.machineReviewPath}
                  sha256={trajectory.machineReviewSha256}
                />
                <EvidenceFile
                  label="轨迹Manifest"
                  path={trajectory.manifestPath}
                  sha256={null}
                />
                <EvidenceFile
                  label="批次报告"
                  path={batch.reportPath}
                  sha256={batch.reportSha256}
                />
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function validationImageUrl(imagePath: string) {
  return `/api/ai-painter/training-data-image?path=${encodeURIComponent(imagePath)}`;
}

function RunEvidenceDialog({
  stage,
  onClose,
}: {
  stage: TrainingStageDetail;
  onClose: () => void;
}) {
  const accounting = stage.tokenAccounting;
  return (
    <div
      className={styles.evidenceDialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label={`${stageLabel(stage)}完整训练证据`}
        aria-modal="true"
        className={styles.evidenceDialog}
        data-testid="run-evidence-dialog"
        role="alertdialog"
      >
        <header>
          <div>
            <span>RUN EVIDENCE INSPECTOR</span>
            <h2>{stageLabel(stage)} · 完整训练证据</h2>
            <code>{stage.runId}</code>
          </div>
          <button
            aria-label="关闭完整训练证据弹窗"
            data-testid="run-evidence-dialog-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.evidenceDialogBody}>
          <section>
            <PanelTitle eyebrow="IDENTITY & TIME" title="身份与详细时间戳" />
            <dl className={styles.definitionGrid}>
              <Definition label="Run ID" value={stage.runId} mono />
              <Definition label="状态" value={stage.status} mono />
              <Definition
                label="记录时间（北京时间）"
                value={formatDetailedTimestamp(stage.createdAtAsiaShanghai)}
                mono
              />
              <Definition
                label="记录时间（UTC原值）"
                value={stage.createdAtUtc ?? "未记录"}
                mono
              />
              <Definition
                label="分辨率"
                value={
                  stage.resolution
                    ? `${stage.resolution.width}×${stage.resolution.height}`
                    : "--"
                }
              />
              <Definition label="设备" value={stage.device} />
              <Definition label="Epoch" value={`${stage.epochCount}`} />
              <Definition
                label="耗时"
                value={
                  stage.durationSeconds === null
                    ? "--"
                    : `${stage.durationSeconds.toFixed(3)}秒`
                }
              />
            </dl>
          </section>
          <section>
            <PanelTitle
              eyebrow="IMMUTABLE FILES"
              title="文件、哈希与父子关系"
            />
            <div className={styles.evidenceDialogFiles}>
              <EvidenceFile
                label="Checkpoint"
                path={stage.checkpointPath}
                sha256={stage.checkpointSha256}
              />
              <EvidenceFile
                label="Parent Checkpoint"
                path={stage.parentCheckpointPath}
                sha256={stage.parentCheckpointSha256}
              />
              <EvidenceFile
                label="Manifest / Progress"
                path={stage.manifestPath}
                sha256={stage.manifestSha256}
              />
              <EvidenceFile
                label="Token Ledger"
                path={stage.tokenLedgerPath}
                sha256={stage.tokenLedgerSha256}
              />
              <EvidenceFile
                label="训练预览机器审核"
                path={stage.previewReviewPath}
                sha256={stage.previewReviewSha256}
              />
            </div>
          </section>
          <section>
            <PanelTitle
              eyebrow="DATA & ACCOUNTING"
              title="数据绑定与本地计算"
            />
            <dl className={styles.definitionGrid}>
              <Definition
                label="条件样本"
                value={`${stage.actualLoadedConditionalSampleCount ?? "--"}`}
              />
              <Definition
                label="新64组样本"
                value={`${stage.actualLoadedV7CapacityCount ?? "--"}`}
              />
              <Definition
                label="实际分割"
                value={formatSplits(stage.actualLoadedSplitCounts)}
              />
              <Definition
                label="最佳Epoch"
                value={`${stage.bestEpoch ?? "--"}`}
              />
              <Definition
                label="本地潜空间Token"
                value={formatInteger(accounting?.runTotals.latentSpatialTokens)}
              />
              <Definition
                label="优化步"
                value={formatInteger(accounting?.runTotals.optimizerSteps)}
              />
              <Definition
                label="RGB预测像素"
                value={formatInteger(
                  accounting?.runTotals.decodedRgbPixelPredictions,
                )}
              />
              <Definition
                label="外部API Token"
                value={formatInteger(accounting?.externalApi.totalTokens)}
              />
            </dl>
          </section>
          <section>
            <PanelTitle eyebrow="BLOCKERS" title="阻断与错误证据" />
            {stage.blockers.length ? (
              <div className={styles.issueList}>
                {stage.blockers.map((blocker) => (
                  <p key={blocker}>× {blocker}</p>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>该Run没有保存阻断项。</p>
            )}
            {stage.error ? (
              <pre className={styles.errorDetail}>{stage.error}</pre>
            ) : null}
            <p className={styles.timestampNotice}>
              所有时间均来自程序保存证据；旧数据缺少时间时显示“未记录”，不会使用页面刷新时间代替。
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function EvidenceFile({
  label,
  path,
  sha256,
}: {
  label: string;
  path: string | null;
  sha256: string | null;
}) {
  return (
    <article>
      <strong>{label}</strong>
      <code>{path ?? "未记录"}</code>
      <small>SHA-256: {sha256 ?? "未记录"}</small>
    </article>
  );
}

function OverviewWorkspace({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  const gpuMemoryPercent = snapshot.gpu.memoryTotalMiB
    ? (snapshot.gpu.memoryUsedMiB / snapshot.gpu.memoryTotalMiB) * 100
    : 0;
  return (
    <div className={styles.overviewWorkspace}>
      <section className={styles.kpiGrid} aria-label="训练关键指标">
        <Metric
          label="目标V7容量"
          value={`${snapshot.dataset.expectedCapacityCount}`}
          unit="张"
          tone="good"
        />
        <Metric
          label="已登记容量"
          value={`${snapshot.dataset.registeredCapacityCount}`}
          unit="张"
          tone="good"
        />
        <Metric
          label="实际训练样本"
          value={`${snapshot.dataset.loadedConditionalSampleCount}`}
          unit="张"
          tone={
            snapshot.dataset.loadedConditionalSampleCount ===
            snapshot.dataset.expectedCapacityCount
              ? "good"
              : "bad"
          }
        />
        <Metric
          label="实际新64组"
          value={`${snapshot.dataset.loadedV7CapacityCount}`}
          unit="张"
          tone={snapshot.dataset.loadedV7CapacityCount === 64 ? "good" : "bad"}
        />
        <GaugeMetric
          label="CPU负载"
          value={snapshot.hardware.cpu.loadPercent}
          detail={`${snapshot.hardware.cpu.logicalProcessorCount} 线程`}
          subdetail="实时处理器利用率"
        />
        <GaugeMetric
          label="内存占用"
          value={snapshot.hardware.memory.usagePercent}
          detail={`${formatMib(snapshot.hardware.memory.usedMiB)} / ${formatMib(snapshot.hardware.memory.totalMiB)}`}
          subdetail="物理内存"
        />
        <GaugeMetric
          label="GPU负载"
          value={snapshot.gpu.utilizationPercent}
          detail={snapshot.gpu.name}
          subdetail="图形处理器"
        />
        <GaugeMetric
          label="GPU显存"
          value={gpuMemoryPercent}
          detail={`${snapshot.gpu.memoryUsedMiB}/${snapshot.gpu.memoryTotalMiB} MiB`}
          subdetail="显存使用"
        />
      </section>
      <article className={styles.panel}>
        <PanelTitle eyebrow="MODEL CONTRACT" title="当前模型参数" />
        <div className={styles.panelScroll}>
          <dl className={styles.definitionGrid}>
            <Definition label="模型ID" value={snapshot.model.modelId} />
            <Definition
              label="架构版本"
              value={snapshot.model.architectureVersion}
            />
            <Definition
              label="Denoiser"
              value={snapshot.model.denoiserArchitecture}
            />
            <Definition
              label="预测目标"
              value={snapshot.model.predictionTarget}
            />
            <Definition
              label="条件通道"
              value={`${snapshot.model.conditionChannels ?? "--"} channels`}
            />
            <Definition
              label="Batch"
              value={`${snapshot.model.batchSize ?? "--"}`}
            />
            <Definition
              label="每阶段Epoch"
              value={`${snapshot.model.epochTargetPerStage ?? "--"}`}
            />
            <Definition
              label="授权状态"
              value={snapshot.model.authorizationStatus}
            />
          </dl>
          <div className={styles.channelList}>
            {snapshot.model.conditionChannelOrder.map((channel, index) => (
              <span key={channel}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                {channel}
              </span>
            ))}
          </div>
        </div>
      </article>
      <article className={styles.panel}>
        <PanelTitle eyebrow="DATA BINDING" title="当前数据绑定" />
        <div className={styles.panelScroll}>
          <SplitComparison snapshot={snapshot} />
          <div className={styles.issueList}>
            {snapshot.dataset.mismatchReasons.map((reason) => (
              <p key={reason}>× {reason}</p>
            ))}
          </div>
          <dl className={styles.definitionGrid}>
            <Definition label="数据包" value={snapshot.dataset.packageId} />
            <Definition
              label="Manifest SHA-256"
              value={snapshot.dataset.manifestSha256}
              mono
            />
            <Definition
              label="数据包创建时间（北京时间）"
              value={formatDetailedTimestamp(
                snapshot.dataset.createdAtAsiaShanghai ??
                  snapshot.dataset.createdAtUtc,
              )}
            />
            <Definition
              label="数据包创建时间（UTC原值）"
              value={snapshot.dataset.createdAtUtc ?? "未记录"}
              mono
            />
            <Definition
              label="Checkpoint处置"
              value={snapshot.execution.checkpointDisposition}
            />
            <Definition
              label="实际分割"
              value={formatSplits(snapshot.dataset.actualSplits)}
            />
          </dl>
        </div>
      </article>
    </div>
  );
}

function DataWorkspace({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  return (
    <div className={styles.singleTableWorkspace}>
      <div className={styles.tableScroll}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>槽位</th>
              <th>Split</th>
              <th>记录</th>
              <th>创建时间（北京时间）</th>
              <th>更新时间（北京时间）</th>
              <th>条件</th>
              <th>容量登记</th>
              <th>旧身份匹配</th>
              <th>实际入训</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.dataset.rows.map((row) => (
              <tr key={row.recordId}>
                <td>{row.slotId ?? "--"}</td>
                <td>{row.split}</td>
                <td>
                  <code>{row.recordId}</code>
                </td>
                <td>
                  <time dateTime={row.createdAtUtc ?? undefined}>
                    {formatDetailedTimestamp(
                      row.createdAtAsiaShanghai ?? row.createdAtUtc,
                    )}
                  </time>
                </td>
                <td>
                  <time dateTime={row.updatedAtUtc ?? undefined}>
                    {formatDetailedTimestamp(
                      row.updatedAtAsiaShanghai ?? row.updatedAtUtc,
                    )}
                  </time>
                </td>
                <td>{row.conditionLabel ?? "--"}</td>
                <td>
                  <StatusMark value={row.capacityRegistered} />
                </td>
                <td>
                  <StatusMark value={row.currentConditionIdentityMatches} />
                </td>
                <td>
                  <StatusMark value={row.selectedByCurrentPythonDataset} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsWorkspace({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  return (
    <div className={styles.eventList}>
      {snapshot.events.map((event) => (
        <article className={styles.event} key={event.id}>
          <span data-status={event.status}>{event.status}</span>
          <div>
            <strong>{event.title}</strong>
            <small>
              {formatDetailedTimestamp(event.timestamp)} · {event.kind} ·{" "}
              {event.runId}
            </small>
            <p>{event.detail ?? event.currentStep ?? "无附加详情"}</p>
            {event.evidencePath ? <code>{event.evidencePath}</code> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function HardwareWorkspace({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  return (
    <div className={styles.hardwareWorkspace}>
      <HardwareSection title="CPU">
        <strong className={styles.hardwareName}>
          {snapshot.hardware.cpu.model}
        </strong>
        <UsageBar label="当前负载" value={snapshot.hardware.cpu.loadPercent} />
        <dl className={styles.hardwareGrid}>
          <Definition
            label="物理核心"
            value={`${snapshot.hardware.cpu.physicalCoreCount}`}
          />
          <Definition
            label="逻辑线程"
            value={`${snapshot.hardware.cpu.logicalProcessorCount}`}
          />
          <Definition
            label="当前频率"
            value={formatClock(snapshot.hardware.cpu.currentClockMhz)}
          />
          <Definition
            label="最高频率"
            value={formatClock(snapshot.hardware.cpu.maxClockMhz)}
          />
        </dl>
      </HardwareSection>
      <HardwareSection title="内存">
        <UsageBar
          label="内存占用"
          value={snapshot.hardware.memory.usagePercent}
        />
        <dl className={styles.hardwareGrid}>
          <Definition
            label="已用"
            value={formatMib(snapshot.hardware.memory.usedMiB)}
          />
          <Definition
            label="可用"
            value={formatMib(snapshot.hardware.memory.availableMiB)}
          />
          <Definition
            label="总量"
            value={formatMib(snapshot.hardware.memory.totalMiB)}
          />
        </dl>
      </HardwareSection>
      <HardwareSection title="GPU">
        <strong className={styles.hardwareName}>{snapshot.gpu.name}</strong>
        <UsageBar label="GPU负载" value={snapshot.gpu.utilizationPercent} />
        <UsageBar
          label="显存占用"
          value={
            snapshot.gpu.memoryTotalMiB
              ? (snapshot.gpu.memoryUsedMiB / snapshot.gpu.memoryTotalMiB) * 100
              : 0
          }
        />
        <dl className={styles.hardwareGrid}>
          <Definition
            label="温度"
            value={`${snapshot.gpu.temperatureCelsius}°C`}
          />
          <Definition
            label="显存"
            value={`${snapshot.gpu.memoryUsedMiB}/${snapshot.gpu.memoryTotalMiB} MiB`}
          />
          <Definition label="驱动" value={snapshot.gpu.driver} />
          <Definition
            label="计算进程"
            value={`${snapshot.gpu.activeComputeProcessCount}`}
          />
        </dl>
      </HardwareSection>
      <HardwareSection title="固定磁盘">
        {snapshot.hardware.disks.map((disk) => (
          <article className={styles.hardwareItem} key={disk.name}>
            <strong>
              {disk.name} {disk.volumeName ?? ""}
            </strong>
            <small>
              {disk.fileSystem ?? "--"} · {disk.usedGiB}/{disk.totalGiB} GiB ·
              可用 {disk.freeGiB} GiB
            </small>
            <UsageBar label="磁盘占用" value={disk.usagePercent} />
          </article>
        ))}
      </HardwareSection>
      <HardwareSection title="物理网卡">
        {snapshot.hardware.networkAdapters.map((adapter) => (
          <article
            className={styles.hardwareItem}
            key={`${adapter.name}-${adapter.interfaceDescription}`}
          >
            <strong>{adapter.name}</strong>
            <small>
              {adapter.status} · {adapter.linkSpeed ?? "未知速率"}
            </small>
            <small>{adapter.interfaceDescription ?? "--"}</small>
          </article>
        ))}
      </HardwareSection>
      <HardwareSection title="系统">
        <dl className={styles.hardwareGrid}>
          <Definition
            label="操作系统"
            value={snapshot.hardware.system.osCaption}
          />
          <Definition
            label="版本 / Build"
            value={`${snapshot.hardware.system.version} / ${snapshot.hardware.system.buildNumber}`}
          />
          <Definition
            label="架构"
            value={snapshot.hardware.system.architecture}
          />
          <Definition
            label="主机名"
            value={snapshot.hardware.system.hostname}
          />
          <Definition
            label="运行时长"
            value={formatUptime(snapshot.hardware.system.uptimeSeconds)}
          />
          <Definition label="状态来源" value={snapshot.status.source} />
        </dl>
      </HardwareSection>
    </div>
  );
}

function AccountingWorkspace({
  snapshot,
  stage,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
  stage: TrainingStageDetail | null;
}) {
  const accounting = stage?.tokenAccounting;
  return (
    <div className={styles.accountingWorkspace}>
      <article className={styles.panel}>
        <PanelTitle
          eyebrow="LOCAL AI ACCOUNTING"
          title="本地模型训练计算账本"
        />
        <div className={styles.panelScroll}>
          {accounting ? (
            <>
              <dl className={styles.definitionGrid}>
                <Definition label="当前Run" value={stage?.runId ?? null} />
                <Definition
                  label="账本所属Run时间"
                  value={formatDetailedTimestamp(
                    stage?.createdAtAsiaShanghai ?? stage?.createdAtUtc ?? null,
                  )}
                />
                <Definition
                  label="本地潜空间Token"
                  value={formatInteger(
                    accounting.runTotals.latentSpatialTokens,
                  )}
                />
                <Definition
                  label="优化步"
                  value={formatInteger(accounting.runTotals.optimizerSteps)}
                />
                <Definition
                  label="去噪样本前向"
                  value={formatInteger(
                    accounting.runTotals.denoiserSampleForwardPasses,
                  )}
                />
                <Definition
                  label="条件标量处理"
                  value={formatInteger(
                    accounting.runTotals.conditionScalarValues,
                  )}
                />
                <Definition
                  label="RGB预测像素"
                  value={formatInteger(
                    accounting.runTotals.decodedRgbPixelPredictions,
                  )}
                />
                <Definition
                  label="外部API Token"
                  value={formatInteger(accounting.externalApi.totalTokens)}
                />
                <Definition
                  label="Tokenizer"
                  value={
                    accounting.terminology.tokenizerUsed ? "使用" : "未使用"
                  }
                />
              </dl>
              <p className={styles.accountingNote}>
                {accounting.terminology.noteZh}
              </p>
            </>
          ) : (
            <p className={styles.empty}>当前记录尚无本地Token账本。</p>
          )}
        </div>
      </article>
      <article className={styles.panel}>
        <PanelTitle
          eyebrow="CAPABILITY MIGRATION"
          title="本地能力迁移状态"
          subtitle={snapshot.migration.objectiveZh ?? "--"}
        />
        <div className={styles.capabilityList}>
          {snapshot.migration.capabilities.map((capability) => (
            <article key={capability.id}>
              <div>
                <b>{capability.nameZh}</b>
                <small>
                  {capability.currentOwner} → {capability.targetOwner}
                </small>
                <small>{capability.nextGateZh ?? "--"}</small>
              </div>
              <span data-status={capability.status}>{capability.status}</span>
            </article>
          ))}
        </div>
      </article>
      <article className={styles.panel}>
        <PanelTitle eyebrow="IMMUTABLE EVIDENCE" title="不可变证据" />
        <div className={styles.evidenceList}>
          {snapshot.evidence.map((item) => (
            <article key={`${item.label}-${item.path}`}>
              <strong>{item.label}</strong>
              <code>{item.path}</code>
              <small>SHA-256: {item.sha256 ?? "--"}</small>
              <small>
                记录时间：
                {formatDetailedTimestamp(
                  item.recordedAtAsiaShanghai ?? item.recordedAtUtc,
                )}
              </small>
            </article>
          ))}
        </div>
      </article>
    </div>
  );
}

function MetricChart({ metrics }: { metrics: TrainingEpochMetric[] }) {
  const train = chartPoints(metrics, "trainCompositeLoss");
  const validation = chartPoints(metrics, "validationCheckpointScore");
  return (
    <div className={styles.chart} aria-label="epoch指标曲线">
      <div className={styles.chartLegend}>
        <span data-line="train">训练综合损失</span>
        <span data-line="validation">验证选择分</span>
      </div>
      <svg role="img" viewBox="0 0 920 250" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((row) => (
          <line
            key={row}
            x1="36"
            x2="900"
            y1={26 + row * 48}
            y2={26 + row * 48}
          />
        ))}
        <polyline className={styles.trainLine} points={train} />
        <polyline className={styles.validationLine} points={validation} />
      </svg>
      <div className={styles.chartAxis}>
        <span>Epoch 1</span>
        <span>Epoch {metrics.at(-1)?.epoch ?? metrics.length}</span>
      </div>
    </div>
  );
}
function SplitComparison({
  snapshot,
}: {
  snapshot: CurrentTrainingDashboardSnapshot;
}) {
  return (
    <div className={styles.splitGrid}>
      <div>
        <span>Split</span>
        <b>目标</b>
        <b>容量登记</b>
        <b>实际训练</b>
      </div>
      {Object.keys(snapshot.dataset.expectedSplits).map((split) => (
        <div key={split}>
          <span>{split}</span>
          <strong>{snapshot.dataset.expectedSplits[split]}</strong>
          <strong>{snapshot.dataset.capacitySplits[split] ?? 0}</strong>
          <strong
            data-bad={
              (snapshot.dataset.actualSplits[split] ?? 0) !==
              snapshot.dataset.expectedSplits[split]
            }
          >
            {snapshot.dataset.actualSplits[split] ?? 0}
          </strong>
        </div>
      ))}
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <article className={styles.metric} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  );
}
function GaugeMetric({
  label,
  value,
  detail,
  subdetail,
}: {
  label: string;
  value: number | null;
  detail: string;
  subdetail: string;
}) {
  const safeValue = value === null ? 0 : Math.min(100, Math.max(0, value));
  const tone =
    value === null
      ? "unknown"
      : safeValue >= 90
        ? "critical"
        : safeValue >= 75
          ? "warning"
          : "normal";
  return (
    <article
      className={styles.gaugeMetric}
      data-tone={tone}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(safeValue)}
    >
      <span className={styles.gaugeLabel}>{label}</span>
      <div className={styles.gaugeBody}>
        <svg
          className={styles.gaugeDial}
          viewBox="0 0 42 42"
          aria-hidden="true"
        >
          <circle
            className={styles.gaugeTrack}
            cx="21"
            cy="21"
            r="16"
            pathLength="100"
          />
          <circle
            className={styles.gaugeValue}
            cx="21"
            cy="21"
            r="16"
            pathLength="100"
            strokeDasharray={`${safeValue} ${100 - safeValue}`}
          />
          <text className={styles.gaugeNumber} x="21" y="21">
            {value === null ? "--" : Math.round(safeValue)}
          </text>
          <text className={styles.gaugeUnit} x="21" y="27">
            %
          </text>
        </svg>
        <div className={styles.gaugeMeta}>
          <strong>{detail}</strong>
          <small>{subdetail}</small>
        </div>
      </div>
    </article>
  );
}
function PanelTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className={styles.panelTitle}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
function Definition({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-mono={mono}>{value ?? "--"}</dd>
    </div>
  );
}
function StatusMark({ value }: { value: boolean }) {
  return (
    <span className={styles.statusMark} data-value={value}>
      {value ? "YES" : "NO"}
    </span>
  );
}
function HardwareSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.hardwareSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function UsageBar({ label, value }: { label: string; value: number | null }) {
  const safeValue = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className={styles.usageBar}>
      <div>
        <span>{label}</span>
        <strong>
          {value === null ? "--" : `${Math.round(value * 10) / 10}%`}
        </strong>
      </div>
      <span>
        <i style={{ width: `${safeValue}%` }} />
      </span>
    </div>
  );
}
function chartPoints(
  metrics: TrainingEpochMetric[],
  key: "trainCompositeLoss" | "validationCheckpointScore",
) {
  const values = metrics
    .map((row) => row[key])
    .filter((value): value is number => value !== null);
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.0001);
  return metrics
    .map((row, index) => {
      const value = row[key] ?? min;
      const x = 36 + (index / Math.max(metrics.length - 1, 1)) * 864;
      const y = 218 - ((value - min) / range) * 192;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
function verdictLabel(value: TrainingStageDetail["verdict"]) {
  return value === "quarantined"
    ? "隔离：不具正式资格"
    : value === "pending_validation"
      ? "训练完成：等待验证"
      : value === "running"
        ? "训练执行中"
        : value;
}
function formatDate(value: string | null) {
  return formatDetailedTimestamp(value);
}
function formatDetailedTimestamp(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${date.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hour12: false,
      })} +08:00`;
}
function formatSplits(splits: Record<string, number>) {
  return ["train", "validation", "challenge", "regression"]
    .map((key) => splits[key] ?? 0)
    .join(" / ");
}
function formatMib(value: number) {
  return value >= 1024
    ? `${(value / 1024).toFixed(1)} GiB`
    : `${Math.round(value)} MiB`;
}
function formatClock(value: number | null) {
  return value === null
    ? "--"
    : value >= 1000
      ? `${(value / 1000).toFixed(2)} GHz`
      : `${Math.round(value)} MHz`;
}
function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}天 ${hours}小时 ${minutes}分`;
}
function formatInteger(value: number | undefined) {
  return value === undefined
    ? "--"
    : new Intl.NumberFormat("zh-CN").format(value);
}
function formatMetric(value: number | null) {
  return value === null ? "--" : value.toFixed(6);
}
function formatLivePhase(value: string | null) {
  const labels: Record<string, string> = {
    initializing: "初始化",
    training_batch: "训练Batch",
    validating_epoch: "Epoch验证",
    epoch_completed: "Epoch已保存",
    completed: "已完成",
  };
  return value ? (labels[value] ?? value) : "—";
}
