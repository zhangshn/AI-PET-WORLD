import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class LocalTaskRunStoreError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function beginLocalTaskRun({
  storeRoot,
  taskContract,
  authorizationClaim = null,
  simulation = false,
  now = new Date(),
}) {
  validateTaskContract(taskContract);
  if (!simulation) validateAuthorizationClaim(authorizationClaim);

  const absoluteRoot = path.resolve(storeRoot);
  fs.mkdirSync(absoluteRoot, { recursive: true });
  const taskId = `${taskContract.taskTypeId}-${formatIdTime(now)}-${crypto.randomUUID().slice(0, 8)}`;
  const lockPath = path.join(absoluteRoot, "active-task.lock");
  const releaseLock = acquireTaskLock(lockPath, taskId, now);
  const runDir = path.join(absoluteRoot, "runs", taskId);
  const startPath = path.join(runDir, "start.json");
  const statePath = path.join(runDir, "state.json");
  const terminalPath = path.join(runDir, "terminal.json");
  let closed = false;

  try {
    fs.mkdirSync(path.dirname(runDir), { recursive: true });
    fs.mkdirSync(runDir, { recursive: false });
    const startRecord = {
      schemaVersion: "local-ai-task-start-v1",
      taskId,
      taskTypeId: taskContract.taskTypeId,
      status: simulation ? "simulation_started" : "accepted",
      simulation,
      noTrainingStarted: simulation,
      startedAtUtc: now.toISOString(),
      startedAtAsiaShanghai: formatShanghai(now),
      authorization: simulation
        ? { mode: "non_training_simulation", consumed: false }
        : {
            mode: "trusted_owner_signature",
            authorizationId: authorizationClaim.authorizationId,
            signerKeyId: authorizationClaim.signerKeyId,
            consumptionPath: authorizationClaim.consumptionPath,
            consumed: true,
          },
      contractSnapshot: taskContract,
    };
    writeImmutableJsonAtomic(startPath, startRecord);
    writeJsonAtomic(statePath, { ...startRecord, schemaVersion: "local-ai-task-state-v1" });
  } catch (error) {
    releaseLock();
    throw error;
  }

  function close(status, detail, errorCode = null, finishedAt = new Date()) {
    if (closed) throw new LocalTaskRunStoreError("任务终态已经写入。", "task_terminal_already_written");
    const terminal = {
      schemaVersion: "local-ai-task-terminal-v1",
      taskId,
      taskTypeId: taskContract.taskTypeId,
      status,
      simulation,
      noTrainingStarted: simulation,
      finishedAtUtc: finishedAt.toISOString(),
      finishedAtAsiaShanghai: formatShanghai(finishedAt),
      detail,
      errorCode,
      startPath: normalizePath(path.relative(absoluteRoot, startPath)),
    };
    try {
      writeImmutableJsonAtomic(terminalPath, terminal);
      writeJsonAtomic(statePath, { ...terminal, schemaVersion: "local-ai-task-state-v1" });
      writeJsonAtomic(path.join(absoluteRoot, "latest.json"), {
        schemaVersion: "local-ai-task-latest-pointer-v1",
        taskId,
        runPath: normalizePath(path.relative(absoluteRoot, runDir)),
        terminalPath: normalizePath(path.relative(absoluteRoot, terminalPath)),
        status,
        updatedAtUtc: terminal.finishedAtUtc,
        updatedAtAsiaShanghai: terminal.finishedAtAsiaShanghai,
      });
      closed = true;
      return terminal;
    } finally {
      releaseLock();
    }
  }

  return {
    taskId,
    runDir,
    startPath,
    statePath,
    terminalPath,
    complete(detail = "Task completed.", finishedAt) {
      return close("completed", detail, null, finishedAt);
    },
    fail(error, finishedAt) {
      const detail = error instanceof Error ? error.message : String(error);
      const errorCode = error?.code ?? "task_execution_failed";
      return close("failed", detail, errorCode, finishedAt);
    },
  };
}

export function simulateLocalTaskLifecycle({ storeRoot, taskContract, fail = false }) {
  const run = beginLocalTaskRun({ storeRoot, taskContract, simulation: true });
  if (fail) {
    return { run, terminal: run.fail(new LocalTaskRunStoreError("模拟失败关闭。", "simulated_failure")) };
  }
  return { run, terminal: run.complete("无训练状态模拟完成。") };
}

export function writeJsonAtomic(targetPath, value) {
  const target = path.resolve(targetPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  let handle = null;
  try {
    handle = fs.openSync(temporary, "wx");
    fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    fs.renameSync(temporary, target);
  } finally {
    if (handle !== null) fs.closeSync(handle);
    try { fs.unlinkSync(temporary); } catch {}
  }
}

function writeImmutableJsonAtomic(targetPath, value) {
  if (fs.existsSync(targetPath)) {
    throw new LocalTaskRunStoreError("不可变任务记录已经存在。", "immutable_task_record_exists");
  }
  writeJsonAtomic(targetPath, value);
}

function acquireTaskLock(lockPath, taskId, now) {
  let handle = null;
  try {
    handle = fs.openSync(lockPath, "wx");
    fs.writeFileSync(handle, `${JSON.stringify({ schemaVersion: "local-ai-task-lock-v1", taskId, pid: process.pid, acquiredAtUtc: now.toISOString() }, null, 2)}\n`, "utf8");
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
  } catch (error) {
    if (handle !== null) fs.closeSync(handle);
    if (error?.code === "EEXIST") {
      throw new LocalTaskRunStoreError("已有本地AI任务持有互斥锁。", "task_mutex_locked");
    }
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try { fs.unlinkSync(lockPath); } catch {}
  };
}

function validateTaskContract(taskContract) {
  if (!taskContract || typeof taskContract !== "object") {
    throw new LocalTaskRunStoreError("缺少任务合同。", "task_contract_missing");
  }
  if (!/^[a-z0-9][a-z0-9-]{7,127}$/.test(taskContract.taskTypeId ?? "")) {
    throw new LocalTaskRunStoreError("任务类型身份无效。", "task_type_id_invalid");
  }
  if (taskContract.executionCommand !== null) {
    throw new LocalTaskRunStoreError("第一阶段禁止携带任意执行命令。", "arbitrary_command_forbidden");
  }
}

function validateAuthorizationClaim(claim) {
  if (!claim?.authorizationId || !claim?.signerKeyId || !claim?.consumptionPath) {
    throw new LocalTaskRunStoreError("缺少已消费的可信Owner授权。", "trusted_owner_authorization_required");
  }
}

function formatIdTime(value) {
  return value.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function formatShanghai(value) {
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

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}
