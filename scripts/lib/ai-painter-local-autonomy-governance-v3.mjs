import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_GOVERNANCE_CONTRACT_PATH =
  "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json";
export const POLICY_BOUNDARY_ROOT = ".runtime/ai-painter/policy-boundary-reports";

const POLICY_BOUNDARY_CLASSES = new Set([
  "long_term_business_goal_change",
  "worldfacts_authority_change",
  "source_license_or_legal_boundary",
  "safety_limit_change",
  "audit_truthfulness_conflict",
  "unregistered_external_cost",
  "irreversible_destructive_action",
]);

export function readLocalGovernanceContract(root = process.cwd()) {
  const contractPath = path.resolve(root, LOCAL_GOVERNANCE_CONTRACT_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  validateLocalGovernanceContract(contract);
  return { contract, contractPath, contractSha256: sha256File(contractPath) };
}

export function validateLocalGovernanceContract(contract) {
  assert(contract?.schemaVersion === "ai-painter-local-system-operating-responsibility-contract-v3", "local governance schema mismatch");
  assert(contract?.status === "active", "local governance contract is not active");
  assert(contract?.systemOfRecord?.authority === "local_ai_pet_world_program", "local program must remain the system of record");
  assert(contract?.normalAutonomousPath?.ownerInStateMachine === false, "Owner must not be in the normal state machine");
  assert(contract?.normalAutonomousPath?.perTaskOwnerAuthorizationRequired === false, "normal path must not require task authorization");
  assert(contract?.normalAutonomousPath?.perStageOwnerAuthorizationRequired === false, "normal path must not require stage authorization");
  assert(contract?.normalAutonomousPath?.perCapabilityVersionOwnerAuthorizationRequired === false, "normal path must not require capability-version authorization");
  assert(contract?.policyBoundaryPath?.mustFailClosed === true, "policy boundary must fail closed");
  assert(contract?.policyBoundaryPath?.waitForOwnerResponse === false, "policy boundary must not wait for Owner");
  assert(contract?.policyBoundaryPath?.ownerActionRequestGenerated === false, "policy boundary must not create Owner action requests");
  assert(contract?.ownerBoundary?.programMayWaitForOwnerAuthorization === false, "program must not wait for Owner authorization");
  const forbidden = new Set(contract?.forbiddenNormalRuntimeArtifacts ?? []);
  for (const identity of ["waiting_owner_authorization", "waiting_owner_decision", "owner_action_request", "owner_release_decision"]) {
    assert(forbidden.has(identity), `forbidden runtime artifact is not registered: ${identity}`);
  }
  return true;
}

export function normalizePolicyBoundaryReport(input, {
  root = process.cwd(),
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert(input?.schemaVersion === "ai-painter-policy-boundary-report-input-v1", "policy boundary input schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(input.reportId ?? ""), "policy boundary report id is invalid");
  assert(POLICY_BOUNDARY_CLASSES.has(input.boundaryClass), "policy boundary class is invalid");
  assert(typeof input.summaryZh === "string" && input.summaryZh.trim(), "policy boundary summary is missing");
  assert(typeof input.failureCode === "string" && input.failureCode.trim(), "policy boundary failureCode is missing");
  assert(Array.isArray(input.evidencePaths) && input.evidencePaths.length > 0, "policy boundary evidence is missing");
  assert(input.safeAlternative === null || typeof input.safeAlternative === "string", "safeAlternative is invalid");

  const evidence = input.evidencePaths.map((relativePath) => {
    const absolutePath = resolveExistingFileInsideRoot(root, relativePath);
    return {
      path: normalizePath(path.relative(root, absolutePath)),
      sha256: sha256File(absolutePath),
      byteSize: fs.statSync(absolutePath).size,
    };
  });
  const { contractSha256 } = readLocalGovernanceContract(root);
  return {
    schemaVersion: "ai-painter-policy-boundary-report-v1",
    reportId: input.reportId,
    status: "blocked_policy_boundary",
    boundaryClass: input.boundaryClass,
    failureCode: input.failureCode.trim(),
    summaryZh: input.summaryZh.trim(),
    safeAlternative: input.safeAlternative,
    recordedAtUtc,
    generatedBy: "local_ai_pet_world_program",
    governanceContractPath: LOCAL_GOVERNANCE_CONTRACT_PATH,
    governanceContractSha256: contractSha256,
    ownerAuthorizationRequested: false,
    ownerResponseRequired: false,
    evidence,
  };
}

export function persistPolicyBoundaryReport(input, options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const report = normalizePolicyBoundaryReport(input, { root, recordedAtUtc: options.recordedAtUtc });
  const logicalDirectory = `${POLICY_BOUNDARY_ROOT}/${report.reportId}`;
  const finalDirectory = resolveInsideRoot(root, logicalDirectory);
  const parentDirectory = path.dirname(finalDirectory);
  fs.mkdirSync(parentDirectory, { recursive: true });
  assert(!fs.existsSync(finalDirectory), "policy boundary report directory already exists");
  const temporaryDirectory = path.join(parentDirectory, `.tmp-${report.reportId}-${process.pid}`);
  assert(!fs.existsSync(temporaryDirectory), "policy boundary temporary directory already exists");
  fs.mkdirSync(temporaryDirectory, { recursive: false });
  const temporaryReportPath = path.join(temporaryDirectory, "report.json");
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(temporaryReportPath, bytes, { flag: "wx" });
  const reportSha256 = sha256(bytes);

  const ledgerPath = resolveInsideRoot(root, `${POLICY_BOUNDARY_ROOT}/index.sqlite`);
  const db = new DatabaseSync(ledgerPath);
  try {
    db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS policy_boundary_reports (
        report_id TEXT PRIMARY KEY,
        boundary_class TEXT NOT NULL,
        failure_code TEXT NOT NULL,
        logical_path TEXT NOT NULL UNIQUE,
        report_sha256 TEXT NOT NULL UNIQUE,
        recorded_at_utc TEXT NOT NULL,
        owner_response_required INTEGER NOT NULL CHECK(owner_response_required = 0)
      );
    `);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO policy_boundary_reports(
          report_id, boundary_class, failure_code, logical_path,
          report_sha256, recorded_at_utc, owner_response_required
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        report.reportId,
        report.boundaryClass,
        report.failureCode,
        `${logicalDirectory}/report.json`,
        reportSha256,
        report.recordedAtUtc,
      );
      fs.renameSync(temporaryDirectory, finalDirectory);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      if (fs.existsSync(temporaryDirectory)) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } finally {
    db.close();
  }
  return {
    report,
    logicalPath: `${logicalDirectory}/report.json`,
    sha256: reportSha256,
    sqlitePath: `${POLICY_BOUNDARY_ROOT}/index.sqlite`,
  };
}

export function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function resolveExistingFileInsideRoot(root, value) {
  assert(typeof value === "string" && value.trim(), "evidence path is invalid");
  assert(!path.isAbsolute(value) && !/^[a-zA-Z]:[\\/]/.test(value), "evidence path must be project-relative");
  const absolutePath = resolveInsideRoot(root, value);
  assert(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `evidence is missing: ${value}`);
  return absolutePath;
}

function resolveInsideRoot(root, value) {
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, value);
  assert(absolutePath.startsWith(`${resolvedRoot}${path.sep}`), `path escapes project root: ${value}`);
  return absolutePath;
}

function normalizePath(value) { return value.replaceAll("\\", "/"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
