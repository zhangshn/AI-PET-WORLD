import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  normalizePolicyBoundaryReport,
  persistPolicyBoundaryReport,
  readLocalGovernanceContract,
  validateLocalGovernanceContract,
} from "./lib/ai-painter-local-autonomy-governance-v3.mjs";

const ROOT = process.cwd();
let positive = 0;
let negative = 0;
const temporaryRoots = [];

try {
  const current = readLocalGovernanceContract(ROOT);
  pass(() => validateLocalGovernanceContract(current.contract));
  pass(() => assert.equal(current.contract.normalAutonomousPath.ownerInStateMachine, false));
  pass(() => assert.equal(current.contract.policyBoundaryPath.waitForOwnerResponse, false));

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-policy-boundary-"));
  temporaryRoots.push(fixtureRoot);
  copyFile(ROOT, fixtureRoot, "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json");
  writeFile(fixtureRoot, "evidence/input.json", "{\"ok\":true}\n");
  const input = {
    schemaVersion: "ai-painter-policy-boundary-report-input-v1",
    reportId: "policy-boundary-report-001",
    boundaryClass: "long_term_business_goal_change",
    failureCode: "business_goal_change_outside_current_contract",
    summaryZh: "检测到长期业务目标变化，当前执行已经失败关闭。",
    safeAlternative: null,
    evidencePaths: ["evidence/input.json"],
  };
  const normalized = normalizePolicyBoundaryReport(input, {
    root: fixtureRoot,
    recordedAtUtc: "2026-08-24T08:00:00.000Z",
  });
  pass(() => assert.equal(normalized.status, "blocked_policy_boundary"));
  pass(() => assert.equal(normalized.ownerAuthorizationRequested, false));
  pass(() => assert.equal(normalized.ownerResponseRequired, false));
  pass(() => assert.equal(normalized.evidence.length, 1));

  const persisted = persistPolicyBoundaryReport(input, {
    root: fixtureRoot,
    recordedAtUtc: "2026-08-24T08:00:00.000Z",
  });
  pass(() => assert(fs.existsSync(path.join(fixtureRoot, persisted.logicalPath))));
  pass(() => assert(/^[a-f0-9]{64}$/.test(persisted.sha256)));
  const db = new DatabaseSync(path.join(fixtureRoot, persisted.sqlitePath), { readOnly: true });
  const row = db.prepare("SELECT * FROM policy_boundary_reports WHERE report_id = ?").get(input.reportId);
  db.close();
  pass(() => assert.equal(row.owner_response_required, 0));
  reject(() => persistPolicyBoundaryReport(input, { root: fixtureRoot }), "duplicate policy boundary report must be rejected");
  reject(() => normalizePolicyBoundaryReport({ ...input, boundaryClass: "owner_approval_required" }, { root: fixtureRoot }), "Owner approval boundary must be rejected");
  reject(() => normalizePolicyBoundaryReport({ ...input, evidencePaths: ["../outside.json"] }, { root: fixtureRoot }), "path traversal must be rejected");
  reject(() => validateLocalGovernanceContract({
    ...current.contract,
    normalAutonomousPath: { ...current.contract.normalAutonomousPath, ownerInStateMachine: true },
  }), "Owner in normal state machine must be rejected");
  reject(() => validateLocalGovernanceContract({
    ...current.contract,
    policyBoundaryPath: { ...current.contract.policyBoundaryPath, waitForOwnerResponse: true },
  }), "Owner response wait must be rejected");

  console.log(JSON.stringify({
    ok: true,
    status: "ai_painter_local_autonomy_governance_v3_passed",
    positiveChecks: positive,
    negativeChecks: negative,
    ownerActionRequestsCreated: false,
    policyBoundaryReportsPersisted: true,
    sqliteIndexed: true,
  }, null, 2));
} finally {
  for (const temporaryRoot of temporaryRoots) fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function copyFile(sourceRoot, targetRoot, relativePath) {
  const source = path.join(sourceRoot, ...relativePath.split("/"));
  const target = path.join(targetRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function writeFile(root, relativePath, contents) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, { flag: "wx" });
}

function pass(fn) { fn(); positive += 1; }
function reject(fn, message) { assert.throws(fn, undefined, message); negative += 1; }
