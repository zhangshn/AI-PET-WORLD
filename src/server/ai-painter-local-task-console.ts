import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AiPainterTaskCapsule } from "@/server/ai-painter-current-training-types";
import { readCurrentTrainingDashboard } from "@/server/ai-painter-current-training";

const catalogPath = path.join(
  process.cwd(),
  "data/ai-painter/system-governance/local-ai-task-catalog-v1.json",
);
const trustRegistryPath = path.join(
  process.cwd(),
  "data/ai-painter/system-governance/project-owner-trust-registry-v1.json",
);
const taskRunRoot = path.join(
  process.cwd(),
  ".runtime/ai-painter/local-task-console",
);
const failureLearningPointerPath = path.join(
  process.cwd(),
  ".runtime/ai-painter/local-ai-failure-learning/latest.json",
);
const failureLearningPhase2PointerPath = path.join(
  process.cwd(),
  ".runtime/ai-painter/local-ai-failure-learning-r3-candidates/latest.json",
);

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

type TaskCatalog = {
  schemaVersion: "local-ai-task-catalog-v1";
  status: string;
  updatedAtAsiaShanghai: string;
  moduleId: string;
  executionPolicy: Record<string, boolean>;
  tasks: TaskContract[];
};

export type LocalTaskConsoleSnapshot = {
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
  catalog: TaskCatalog;
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
  failureLearning: FailureLearningSnapshot;
  taskCapsule: AiPainterTaskCapsule;
  ownerActionRequestPreview: OwnerActionRequestPreview;
};

type OwnerActionRequestPreview = {
  schemaVersion: "local-ai-owner-action-request-preview-v1";
  status: "draft_unexecuted";
  generatedFromCapsuleId: string;
  generatedAtUtc: string;
  actionCode: string;
  titleZh: string;
  summaryZh: string;
  ownerDecisionStatus: "not_recorded";
  allowedOwnerChoices: Array<{
    code:
      | "request_new_readonly_failure_analysis"
      | "request_new_bounded_candidate_design"
      | "pause_stage4";
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

type FailureLearningSummary = {
  previewCount: number;
  failedPreviewCount: number;
  passedPreviewCount: number;
  finalEpoch: number;
  finalPreviewPassed: boolean;
  finalPassingStreak: number;
  recurrentIssueCount: number;
  conclusionZh: string;
};

type FailureLearningSnapshot =
  | { status: "not_recorded"; messageZh: string }
  | {
      status: "ready_for_owner_review";
      reportPath: string;
      reportSha256: string;
      analysisId: string;
      createdAtUtc: string;
      createdAtAsiaShanghai: string;
      sourceRunId: string;
      summary: FailureLearningSummary;
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

export async function readLocalTaskConsoleSnapshot(): Promise<LocalTaskConsoleSnapshot> {
  const catalog = readJson<TaskCatalog>(catalogPath);
  const { taskCapsule } = await readCurrentTrainingDashboard();
  const trustRegistry = readJson<{ status?: string; keys?: unknown[] }>(trustRegistryPath);
  const registrySha256 = sha256File(trustRegistryPath);
  const configuredRegistrySha256 = process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256?.trim().toLowerCase() ?? "";
  const configuredRegistryHashMatches = Boolean(
    configuredRegistrySha256 && configuredRegistrySha256 === registrySha256,
  );
  const trustedKeyCount = Array.isArray(trustRegistry.keys)
    ? trustRegistry.keys.length
    : 0;
  const now = new Date();

  return {
    schemaVersion: "local-ai-task-console-snapshot-v1",
    generatedAtUtc: now.toISOString(),
    generatedAtAsiaShanghai: formatShanghai(now),
    mode: "task_capsule_and_owner_action_preview",
    launchEnabled: false,
    gate: {
      status: "blocked",
      code:
        trustRegistry.status === "owner_key_provisioning_required" ||
        trustedKeyCount === 0 ||
        !configuredRegistryHashMatches
          ? "owner_key_provisioning_required"
          : "phase1_real_launch_not_authorized",
      messageZh:
        trustRegistry.status === "owner_key_provisioning_required" ||
        trustedKeyCount === 0 ||
        !configuredRegistryHashMatches
          ? "Owner密钥尚未初始化；操作台只允许预览任务合同，真实启动保持失败关闭。"
          : "Owner密钥已就绪，但第一阶段没有获得真实任务启动授权。",
      trustRegistryStatus: trustRegistry.status ?? "missing",
      trustedKeyCount,
      configuredRegistryHashMatches,
    },
    catalog,
    history: readTaskHistory(),
    infrastructure: {
      taskId: true,
      mutex: true,
      atomicStartRecord: true,
      atomicTerminalRecord: true,
      failureClosed: true,
      arbitraryCommandsAllowed: false,
    },
    failureLearning: readFailureLearning(),
    taskCapsule,
    ownerActionRequestPreview: buildOwnerActionRequestPreview(taskCapsule, now),
  };
}

function buildOwnerActionRequestPreview(
  taskCapsule: AiPainterTaskCapsule,
  generatedAt: Date,
): OwnerActionRequestPreview {
  return {
    schemaVersion: "local-ai-owner-action-request-preview-v1",
    status: "draft_unexecuted",
    generatedFromCapsuleId: taskCapsule.capsuleId,
    generatedAtUtc: generatedAt.toISOString(),
    actionCode: taskCapsule.nextAllowedAction.code,
    titleZh: taskCapsule.nextAllowedAction.labelZh,
    summaryZh:
      "当前候选已失败关闭。该预览仅帮助Owner选择新的只读失败分析、有界候选设计或暂停Stage4；当前不存在可执行的训练授权。",
    ownerDecisionStatus: "not_recorded",
    allowedOwnerChoices: [
      {
        code: "request_new_readonly_failure_analysis",
        labelZh: "请求新的只读失败分析",
        currentlyExecutable: false,
      },
      {
        code: "request_new_bounded_candidate_design",
        labelZh: "请求新的有界候选设计",
        currentlyExecutable: false,
      },
      {
        code: "pause_stage4",
        labelZh: "暂停Stage4并保留现有证据",
        currentlyExecutable: false,
      },
    ],
    forbiddenActions: [...taskCapsule.forbiddenActions],
    evidence: taskCapsule.evidence.map((item) => ({ ...item })),
    boundaries: {
      persistedAsAuthorization: false,
      ownerDecisionRecorded: false,
      authorizationConsumptionAllowed: false,
      executionAllowed: false,
      postRequestAllowed: false,
    },
  };
}

function readFailureLearning(): FailureLearningSnapshot {
  if (!fs.existsSync(failureLearningPointerPath)) {
    return {
      status: "not_recorded",
      messageZh: "本地失败学习程序尚未生成有界修复合同。",
    };
  }
  const pointer = readJson<{ runPath?: string }>(failureLearningPointerPath);
  if (!pointer.runPath) throw new Error("local_failure_learning_latest_pointer_missing_run_path");
  const reportPath = path.resolve(process.cwd(), pointer.runPath);
  const report = readJson<{
    analysisId: string;
    createdAtUtc: string;
    createdAtAsiaShanghai: string;
    sourceRunId: string;
    summary: FailureLearningSummary;
    issueClusters: Extract<FailureLearningSnapshot, { status: "ready_for_owner_review" }>["issueClusters"];
    rootCauseCandidates: Extract<FailureLearningSnapshot, { status: "ready_for_owner_review" }>["rootCauseCandidates"];
    repairContract: Extract<FailureLearningSnapshot, { status: "ready_for_owner_review" }>["repairContract"];
    closure: Record<string, string | boolean>;
  }>(reportPath);
  return {
    status: "ready_for_owner_review",
    reportPath: projectPath(reportPath),
    reportSha256: sha256File(reportPath),
    analysisId: report.analysisId,
    createdAtUtc: report.createdAtUtc,
    createdAtAsiaShanghai: report.createdAtAsiaShanghai,
    sourceRunId: report.sourceRunId,
    summary: report.summary,
    issueClusters: report.issueClusters,
    rootCauseCandidates: report.rootCauseCandidates,
    repairContract: report.repairContract,
    closure: report.closure,
    phase2: readFailureLearningPhase2(),
  };
}

function readFailureLearningPhase2(): Extract<FailureLearningSnapshot, { status: "ready_for_owner_review" }>["phase2"] {
  if (!fs.existsSync(failureLearningPhase2PointerPath)) return null;
  const pointer = readJson<{ runPath?: string }>(failureLearningPhase2PointerPath);
  if (!pointer.runPath) throw new Error("local_failure_learning_phase2_latest_pointer_missing_run_path");
  const reportPath = path.resolve(process.cwd(), pointer.runPath);
  const report = readJson<{
    status: string;
    createdAtUtc: string;
    createdAtAsiaShanghai: string;
    candidate: { path: string; sha256: string };
    cpuRegression: { path: string; sha256: string; measured: Record<string, number> };
    tailStabilityRegression: {
      sourceR2Evidence: { passed: boolean };
      positiveSynthetic: { passed: boolean };
      negativeSynthetic: { passed: boolean };
    };
    closure: Record<string, string | number | boolean>;
  }>(reportPath);
  return {
    status: report.status,
    reportPath: projectPath(reportPath),
    reportSha256: sha256File(reportPath),
    createdAtUtc: report.createdAtUtc,
    createdAtAsiaShanghai: report.createdAtAsiaShanghai,
    candidatePath: report.candidate.path,
    candidateSha256: report.candidate.sha256,
    cpuRegressionPath: report.cpuRegression.path,
    cpuRegressionSha256: report.cpuRegression.sha256,
    measured: report.cpuRegression.measured,
    sourceTailGatePassed: report.tailStabilityRegression.sourceR2Evidence.passed,
    positiveTailGatePassed: report.tailStabilityRegression.positiveSynthetic.passed,
    negativeTailGatePassed: report.tailStabilityRegression.negativeSynthetic.passed,
    closure: report.closure,
  };
}

function readTaskHistory() {
  const runsRoot = path.join(taskRunRoot, "runs");
  if (!fs.existsSync(runsRoot)) return [];
  return fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const terminalPath = path.join(runsRoot, entry.name, "terminal.json");
      const statePath = path.join(runsRoot, entry.name, "state.json");
      try {
        const state = readJson<Record<string, unknown>>(
          fs.existsSync(terminalPath) ? terminalPath : statePath,
        );
        return [{
          taskId: entry.name,
          status: typeof state.status === "string" ? state.status : "unknown",
          updatedAtUtc:
            typeof state.finishedAtUtc === "string"
              ? state.finishedAtUtc
              : typeof state.startedAtUtc === "string"
                ? state.startedAtUtc
                : null,
          terminalPath: fs.existsSync(terminalPath)
            ? projectPath(terminalPath)
            : null,
        }];
      } catch {
        return [];
      }
    })
    .sort((left, right) => (right.updatedAtUtc ?? "").localeCompare(left.updatedAtUtc ?? ""))
    .slice(0, 20);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function sha256File(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function projectPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function formatShanghai(value: Date) {
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value).replace(" ", "T")}+08:00`;
}
