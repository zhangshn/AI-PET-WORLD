"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AiPainterTaskCapsule } from "../_lib/current-training-dashboard-types";
import styles from "./page.module.css";

type TaskContract = {
  taskTypeId: string;
  nameZh: string;
  category: string;
  recommendedNow: boolean;
  summaryZh: string;
  modelId: string;
  datasetPackageId: string;
  inputs: string[];
  plannedSteps: string[];
  excludedPermissions: string[];
  resourceEstimateZh: string;
  riskZh: string;
  rollbackPointZh: string;
  requiredAuthorizationKind: string;
  executionCommand: null;
};

type Snapshot = {
  schemaVersion: "local-ai-task-console-snapshot-v1";
  generatedAtUtc: string;
  generatedAtAsiaShanghai: string;
  mode: "task_capsule_and_owner_action_preview";
  launchEnabled: false;
  gate: {
    status: "blocked";
    code: string;
    messageZh: string;
    trustRegistryStatus: string;
    trustedKeyCount: number;
    configuredRegistryHashMatches: boolean;
  };
  catalog: {
    status: string;
    updatedAtAsiaShanghai: string;
    tasks: TaskContract[];
  };
  history: Array<{
    taskId: string;
    status: string;
    updatedAtUtc: string | null;
    terminalPath: string | null;
  }>;
  infrastructure: {
    taskId: true;
    mutex: true;
    atomicStartRecord: true;
    atomicTerminalRecord: true;
    failureClosed: true;
    arbitraryCommandsAllowed: false;
  };
  failureLearning:
    | { status: "not_recorded"; messageZh: string }
    | {
        status: "ready_for_owner_review";
        reportPath: string;
        reportSha256: string;
        analysisId: string;
        createdAtUtc: string;
        createdAtAsiaShanghai: string;
        sourceRunId: string;
        summary: {
          previewCount: number;
          failedPreviewCount: number;
          passedPreviewCount: number;
          finalEpoch: number;
          finalPreviewPassed: boolean;
          finalPassingStreak: number;
          recurrentIssueCount: number;
          conclusionZh: string;
        };
        issueClusters: Array<{
          issueCode: string;
          labelZh: string;
          family: string;
          occurrenceEpochs: number[];
          episodeCount: number;
          presentAtFinal: boolean;
          trend: string;
        }>;
        rootCauseCandidates: Array<{
          id: string;
          confidence: number;
          titleZh: string;
          findingZh: string;
          proposedTarget: string;
        }>;
        repairContract: {
          status: string;
          objectiveZh: string;
          allowedChangeTargets: string[];
          forbiddenChanges: string[];
          configurationPatchProposal: Record<string, unknown>;
          regressionContract: {
            positive: string[];
            negative: string[];
            promotionBoundary: string;
          };
          applicationGate: Record<string, boolean>;
        };
        closure: Record<string, string | boolean>;
        phase2: null | {
          status: string;
          reportPath: string;
          reportSha256: string;
          createdAtUtc: string;
          createdAtAsiaShanghai: string;
          candidatePath: string;
          candidateSha256: string;
          cpuRegressionPath: string;
          cpuRegressionSha256: string;
          measured: Record<string, number>;
          sourceTailGatePassed: boolean;
          positiveTailGatePassed: boolean;
          negativeTailGatePassed: boolean;
          closure: Record<string, string | number | boolean>;
        };
      };
  taskCapsule: AiPainterTaskCapsule;
  ownerActionRequestPreview: {
    schemaVersion: "local-ai-owner-action-request-preview-v1";
    status: "draft_unexecuted";
    generatedFromCapsuleId: string;
    generatedAtUtc: string;
    actionCode: string;
    titleZh: string;
    summaryZh: string;
    ownerDecisionStatus: "not_recorded";
    allowedOwnerChoices: Array<{
      code: string;
      labelZh: string;
      currentlyExecutable: false;
    }>;
    forbiddenActions: string[];
    evidence: AiPainterTaskCapsule["evidence"];
    boundaries: {
      persistedAsAuthorization: false;
      ownerDecisionRecorded: false;
      authorizationConsumptionAllowed: false;
      executionAllowed: false;
      postRequestAllowed: false;
    };
  };
};

export function LocalTaskConsole() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/ai-painter/task-console", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`任务操作台接口返回 ${response.status}`);
        const next = (await response.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(next);
          setSelectedTaskId(
            (current) =>
              current ||
              next.catalog.tasks.find((task) => task.recommendedNow)?.taskTypeId ||
              next.catalog.tasks[0]?.taskTypeId ||
              "",
          );
          setError("");
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "读取任务操作台失败");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTask = useMemo(
    () =>
      snapshot?.catalog.tasks.find(
        (task) => task.taskTypeId === selectedTaskId,
      ) ?? null,
    [selectedTaskId, snapshot],
  );

  if (!snapshot) {
    return (
      <section className={styles.loading}>
        <strong>{error || "正在读取本地任务合同…"}</strong>
      </section>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLinks}>
            <Link href="/ai-painter-progress">← 返回训练主控台</Link>
            <Link href="/ai-painter-progress/current-training">查看只读训练监控台 →</Link>
          </div>
          <p className={styles.kicker}>LOCAL SELF-DEVELOPED AI / TASK CONSOLE</p>
          <h1>本地AI任务操作台</h1>
          <p>选择任务并审阅本地程序生成的证据、根因候选和修复合同；未获独立授权不会应用配置或启动训练。</p>
        </div>
        <div className={styles.modeBadge} data-status={snapshot.gate.status}>
          <span>当前模式</span>
          <strong>本地失败学习已运行 · 真实启动阻断</strong>
          <small>{formatTimestamp(snapshot.generatedAtAsiaShanghai)}</small>
        </div>
      </header>

      <section className={styles.gatePanel} data-testid="task-console-owner-gate">
        <div className={styles.gateIcon}>!</div>
        <div>
          <span>OWNER AUTHORIZATION GATE</span>
          <h2>{snapshot.gate.messageZh}</h2>
          <p>
            状态码：{snapshot.gate.code} · 已登记公钥 {snapshot.gate.trustedKeyCount} 个 · 注册表哈希
            {snapshot.gate.configuredRegistryHashMatches ? "已匹配" : "未配置或不匹配"}
          </p>
        </div>
      </section>

      <section className={styles.taskCapsulePanel} data-testid="local-task-capsule-summary">
        <header>
          <div>
            <span>AI PAINTER LOCAL TASK CAPSULE</span>
            <h2>{snapshot.taskCapsule.module.nameZh}</h2>
          </div>
          <strong>{snapshot.taskCapsule.fixedOverallProgress.completedStages}/{snapshot.taskCapsule.fixedOverallProgress.totalStages} · {snapshot.taskCapsule.fixedOverallProgress.percent}%</strong>
        </header>
        <div className={styles.taskCapsuleGrid}>
          <StatusItem label="当前阶段" value={`${snapshot.taskCapsule.currentStage.number}/${snapshot.taskCapsule.currentStage.total} · ${snapshot.taskCapsule.currentStage.labelZh}`} />
          <StatusItem label="候选终态" value={snapshot.taskCapsule.candidateTerminal.status} danger />
          <StatusItem label="最新阻断" value={snapshot.taskCapsule.latestBlocker.code} danger />
          <StatusItem label="证据完整性" value={snapshot.taskCapsule.integrity.status} danger={snapshot.taskCapsule.integrity.status !== "verified"} />
        </div>
        <p>{snapshot.taskCapsule.latestBlocker.summaryZh}</p>
        <div className={styles.taskCapsuleLists}>
          <ListPanel title="当前禁止动作" items={snapshot.taskCapsule.forbiddenActions} danger />
          <details className={styles.machineContract}>
            <summary>查看任务胶囊证据路径与SHA-256（{snapshot.taskCapsule.evidence.length}项）</summary>
            <pre>{JSON.stringify(snapshot.taskCapsule.evidence, null, 2)}</pre>
          </details>
        </div>
      </section>

      <section className={styles.ownerPreviewPanel} data-testid="local-owner-action-request-preview">
        <header>
          <div>
            <span>OWNER ACTION REQUEST PREVIEW</span>
            <h2>{snapshot.ownerActionRequestPreview.titleZh}</h2>
          </div>
          <strong>{snapshot.ownerActionRequestPreview.status}</strong>
        </header>
        <p>{snapshot.ownerActionRequestPreview.summaryZh}</p>
        <div className={styles.ownerChoiceGrid}>
          {snapshot.ownerActionRequestPreview.allowedOwnerChoices.map((choice) => (
            <div key={choice.code}>
              <span>仅供Owner选择</span>
              <strong>{choice.labelZh}</strong>
              <code>{choice.code}</code>
            </div>
          ))}
        </div>
        <div className={styles.previewBoundaries} data-testid="local-owner-action-request-boundaries">
          <strong>未批准 / 未消费 / 未执行</strong>
          <span>未保存为授权 · 未记录Owner决策 · 不允许消费授权 · 不允许执行 · 不允许POST</span>
        </div>
      </section>

      <section className={styles.consoleGrid}>
        <aside className={styles.taskRail}>
          <header>
            <span>TASK CATALOG</span>
            <h2>选择任务内容</h2>
          </header>
          <label className={styles.selector}>
            <span>任务类型</span>
            <select
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              data-testid="local-task-selector"
            >
              {snapshot.catalog.tasks.map((task) => (
                <option key={task.taskTypeId} value={task.taskTypeId}>
                  {task.recommendedNow ? "当前建议 · " : ""}{task.nameZh}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.taskCards}>
            {snapshot.catalog.tasks.map((task) => (
              <button
                type="button"
                key={task.taskTypeId}
                onClick={() => setSelectedTaskId(task.taskTypeId)}
                data-active={task.taskTypeId === selectedTaskId}
              >
                <span>{task.category}</span>
                <strong>{task.nameZh}</strong>
                <small>{task.recommendedNow ? "当前计划建议" : "后续独立授权"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.contractPanel} data-testid="local-task-contract-preview">
          {selectedTask ? (
            <>
              <header className={styles.contractHeader}>
                <div>
                  <span>SELECTED TASK CONTRACT</span>
                  <h2>{selectedTask.nameZh}</h2>
                  <code>{selectedTask.taskTypeId}</code>
                </div>
                <button
                  type="button"
                  disabled={!snapshot.launchEnabled}
                  aria-describedby="launch-block-reason"
                  data-testid="local-task-launch-button"
                >
                  真实启动未开放
                </button>
              </header>
              <p className={styles.summary}>{selectedTask.summaryZh}</p>
              <p id="launch-block-reason" className={styles.blockReason}>
                本按钮不会发出POST请求。Owner密钥和独立任务授权未就绪时，操作台必须失败关闭。
              </p>

              <dl className={styles.identityGrid}>
                <Definition label="模型" value={selectedTask.modelId} />
                <Definition label="数据包" value={selectedTask.datasetPackageId} />
                <Definition label="授权类别" value={selectedTask.requiredAuthorizationKind} />
                <Definition label="执行命令" value="无 · 禁止任意命令" />
              </dl>

              {selectedTask.taskTypeId === "v7-next-bounded-repair-design" ? (
                <FailureLearningPanel analysis={snapshot.failureLearning} />
              ) : null}

              <div className={styles.detailGrid}>
                <ListPanel title="输入与证据" items={selectedTask.inputs} />
                <ListPanel title="计划步骤" items={selectedTask.plannedSteps} ordered />
                <ListPanel title="明确排除" items={selectedTask.excludedPermissions} danger />
                <section className={styles.readinessPanel}>
                  <span>RESOURCE / RISK / ROLLBACK</span>
                  <h3>执行前说明</h3>
                  <p><b>资源：</b>{selectedTask.resourceEstimateZh}</p>
                  <p><b>风险：</b>{selectedTask.riskZh}</p>
                  <p><b>回退点：</b>{selectedTask.rollbackPointZh}</p>
                </section>
              </div>
            </>
          ) : null}
        </section>
      </section>

      <section className={styles.footerStrip}>
        <StatusItem label="任务ID" value="已实现" />
        <StatusItem label="互斥锁" value="已实现" />
        <StatusItem label="原子启动记录" value="已实现" />
        <StatusItem label="原子终态记录" value="已实现" />
        <StatusItem label="失败关闭" value="已实现" />
        <StatusItem
          label="失败学习闭环"
          value={snapshot.failureLearning.status === "ready_for_owner_review"
            ? snapshot.failureLearning.phase2 ? "R3候选CPU已验证" : "合同已生成"
            : "尚未记录"}
          danger={snapshot.failureLearning.status !== "ready_for_owner_review"}
        />
      </section>
    </div>
  );
}

function FailureLearningPanel({ analysis }: { analysis: Snapshot["failureLearning"] }) {
  if (analysis.status === "not_recorded") {
    return <section className={styles.failureLearningEmpty}>{analysis.messageZh}</section>;
  }
  return (
    <section className={styles.failureLearningPanel} data-testid="local-ai-failure-learning-panel">
      <header className={styles.failureLearningHeader}>
        <div>
          <span>LOCAL FAILURE LEARNING LOOP</span>
          <h3>本地失败学习与修复合同</h3>
          <code>{analysis.analysisId}</code>
        </div>
        <div className={styles.reviewBadge}>{analysis.phase2 ? "R3候选已隔离 · 未训练" : "等待 Owner 审核"}</div>
      </header>
      <p className={styles.failureConclusion}>{analysis.summary.conclusionZh}</p>
      <div className={styles.failureMetrics}>
        <Metric label="预览" value={`${analysis.summary.previewCount}`} />
        <Metric label="机器拒绝" value={`${analysis.summary.failedPreviewCount}`} danger />
        <Metric label="机器通过" value={`${analysis.summary.passedPreviewCount}`} />
        <Metric label="终态Epoch" value={`${analysis.summary.finalEpoch}`} />
        <Metric label="末段连续通过" value={`${analysis.summary.finalPassingStreak}/3`} danger={analysis.summary.finalPassingStreak < 3} />
        <Metric label="复发问题" value={`${analysis.summary.recurrentIssueCount}`} danger={analysis.summary.recurrentIssueCount > 0} />
      </div>
      <div className={styles.failureColumns}>
        <section>
          <h4>问题时间轨迹</h4>
          <div className={styles.issueList}>
            {analysis.issueClusters.map((cluster) => (
              <article key={cluster.issueCode}>
                <strong>{cluster.labelZh}</strong>
                <small>{cluster.issueCode}</small>
                <p>Epoch：{cluster.occurrenceEpochs.join("、")} · {trendLabel(cluster.trend)}{cluster.episodeCount > 1 ? ` · ${cluster.episodeCount}段复发` : ""}</p>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h4>根因候选与置信度</h4>
          <div className={styles.causeList}>
            {analysis.rootCauseCandidates.map((candidate) => (
              <article key={candidate.id}>
                <div><strong>{candidate.titleZh}</strong><b>{Math.round(candidate.confidence * 100)}%</b></div>
                <p>{candidate.findingZh}</p>
                <small>修复目标：{candidate.proposedTarget}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className={styles.repairContractGrid}>
        <ListPanel title="允许修改的目标" items={analysis.repairContract.allowedChangeTargets} />
        <ListPanel title="禁止修改" items={analysis.repairContract.forbiddenChanges} danger />
        <ListPanel title="正向回归" items={analysis.repairContract.regressionContract.positive} ordered />
        <ListPanel title="反向回归" items={analysis.repairContract.regressionContract.negative} ordered />
      </div>
      <details className={styles.machineContract}>
        <summary>查看机器可读训练配置修复提案</summary>
        <pre>{JSON.stringify(analysis.repairContract.configurationPatchProposal, null, 2)}</pre>
      </details>
      {analysis.phase2 ? (
        <section className={styles.phase2Terminal} data-testid="local-ai-r3-candidate-terminal">
          <div>
            <span>PHASE 2 TERMINAL</span>
            <h4>R3 隔离候选已完成 CPU 正反回归</h4>
            <p>配置未激活、权重未修改、GPU训练未启动；真实 R2 轨迹仍未满足末段连续 3 次通过。</p>
          </div>
          <div className={styles.phase2Grid}>
            <Metric label="CPU回归" value="通过" />
            <Metric label="R2末段门禁" value={analysis.phase2.sourceTailGatePassed ? "通过" : "失败关闭"} danger={!analysis.phase2.sourceTailGatePassed} />
            <Metric label="正向门禁样例" value={analysis.phase2.positiveTailGatePassed ? "通过" : "失败"} danger={!analysis.phase2.positiveTailGatePassed} />
            <Metric label="反向门禁样例" value={!analysis.phase2.negativeTailGatePassed ? "正确拒绝" : "错误通过"} danger={analysis.phase2.negativeTailGatePassed} />
          </div>
          <details className={styles.machineContract}>
            <summary>查看 R3 候选与 CPU 回归证据</summary>
            <pre>{JSON.stringify({
              status: analysis.phase2.status,
              candidatePath: analysis.phase2.candidatePath,
              candidateSha256: analysis.phase2.candidateSha256,
              cpuRegressionPath: analysis.phase2.cpuRegressionPath,
              cpuRegressionSha256: analysis.phase2.cpuRegressionSha256,
              measured: analysis.phase2.measured,
              closure: analysis.phase2.closure,
            }, null, 2)}</pre>
          </details>
          <footer className={styles.evidenceFooter}>
            <span>终态时间：{formatTimestamp(analysis.phase2.createdAtAsiaShanghai)}</span>
            <span>终态报告：{analysis.phase2.reportPath}</span>
            <span>终态SHA-256：{analysis.phase2.reportSha256}</span>
          </footer>
        </section>
      ) : null}
      <footer className={styles.evidenceFooter}>
        <span>生成时间：{formatTimestamp(analysis.createdAtAsiaShanghai)}</span>
        <span>报告：{analysis.reportPath}</span>
        <span>SHA-256：{analysis.reportSha256}</span>
      </footer>
    </section>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div data-danger={danger}><span>{label}</span><strong>{value}</strong></div>;
}

function trendLabel(value: string) {
  const labels: Record<string, string> = {
    persistent_at_final: "终态仍存在",
    recurred_then_resolved: "复发后终态收敛",
    learned_then_resolved: "逐步学习后收敛",
    emerged_then_resolved: "中途出现后收敛",
  };
  return labels[value] ?? value;
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ListPanel({
  title,
  items,
  ordered = false,
  danger = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  danger?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <section className={styles.listPanel} data-danger={danger}>
      <span>{danger ? "EXCLUDED" : ordered ? "PLAN" : "INPUTS"}</span>
      <h3>{title}</h3>
      <Tag>{items.map((item) => <li key={item}>{item}</li>)}</Tag>
    </section>
  );
}

function StatusItem({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div data-danger={danger}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(timestamp)
    : value;
}
