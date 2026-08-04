export type LocalTaskContract = {
  taskTypeId: string;
  executionCommand: null;
  [key: string]: unknown;
};

export type LocalTaskAuthorizationClaim = {
  authorizationId: string;
  signerKeyId: string;
  consumptionPath: string;
};

export class LocalTaskRunStoreError extends Error {
  readonly code: string;
}

export function beginLocalTaskRun(input: {
  storeRoot: string;
  taskContract: LocalTaskContract;
  authorizationClaim?: LocalTaskAuthorizationClaim | null;
  simulation?: boolean;
  now?: Date;
}): {
  taskId: string;
  runDir: string;
  startPath: string;
  statePath: string;
  terminalPath: string;
  complete(detail?: string, finishedAt?: Date): Record<string, unknown>;
  fail(error: unknown, finishedAt?: Date): Record<string, unknown>;
};

export function simulateLocalTaskLifecycle(input: {
  storeRoot: string;
  taskContract: LocalTaskContract;
  fail?: boolean;
}): { run: { taskId: string; runDir: string }; terminal: Record<string, unknown> };

export function writeJsonAtomic(targetPath: string, value: unknown): void;
