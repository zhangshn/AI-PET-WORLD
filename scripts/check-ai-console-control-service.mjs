import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const projectRoot = process.cwd()
const operatorSessionPath = path.join(projectRoot, "src", "server", "ai-console-control", "operator-session.ts")
const commandServicePath = path.join(projectRoot, "src", "server", "ai-console-control", "control-command-service.ts")
const sessionRoutePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "session", "route.ts")
const commandRoutePath = path.join(projectRoot, "src", "app", "api", "ai-console", "control", "commands", "route.ts")
const controlSurfacePath = path.join(projectRoot, "src", "app", "ai-console", "ai-console-control-surface.tsx")
const receiptDirectory = path.join(projectRoot, ".runtime", "ai-console", "control", "command-receipts")
const registryEvidencePath = "data/ai-console/registry/primary-registry-v1.json"
const registryPath = path.join(projectRoot, ...registryEvidencePath.split("/"))
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"))
const failures = []

const requiredSources = [
  [operatorSessionPath, ["local_console_operator", "SameSite=Strict", "HttpOnly", "x-ai-console-csrf", "timingSafeEqual", "isLoopbackRequest", "verifyLocalControlRead", 'request.headers.get("host")', 'request.headers.get("x-forwarded-host")']],
  [commandServicePath, ["verify_primary_registry", "ai_console_primary_registry_verifier_v1", "expected_registry_revision_conflict", "receiptSha256", 'flag: "wx"', "readAiConsoleRegistryWorkspace", "ai_console_control_receipt_post_write_verification_failed", "isAiConsoleControlCommandReceipt", "ensureAiConsoleControlReceiptEvent", "ensureAiConsoleControlTransaction", "ensureAiConsoleFormalEvidenceRegistration"]],
  [sessionRoutePath, ["issueLocalOperatorSession", "allowedCommandTypes", '"Cache-Control": "no-store"']],
  [commandRoutePath, ["verifyLocalControlRead", "verifyLocalOperatorMutation", "parseVerifyRegistryCommandInput", "executeVerifyPrimaryRegistryCommand", "control_command_identity_invalid", 'integrityStatus: "verified"', "receiptLogicalPath", "transactionStoreStatus", "transactionBinding", "evidenceIndexStatus", "evidenceRegistration"]],
  [controlSurfacePath, ["AiConsoleRegistryVerificationControl", "x-ai-console-csrf", "verify_primary_registry", "EXACT RECEIPT LOOKUP", "lookupReceiptByCommandId", "不扫描回执目录", "尚未登记到V6事务库", "transactionRecordSha256", "不访问训练Run"]],
]

for (const [sourcePath, markers] of requiredSources) {
  if (!fs.existsSync(sourcePath)) {
    failures.push(`missing:${path.relative(projectRoot, sourcePath)}`)
    continue
  }
  const source = fs.readFileSync(sourcePath, "utf8")
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`contract_marker_missing:${path.relative(projectRoot, sourcePath)}:${marker}`)
  }
  if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(source)) {
    failures.push(`legacy_source_coupling:${path.relative(projectRoot, sourcePath)}`)
  }
}

let receiptCount = 0
if (fs.existsSync(receiptDirectory)) {
  const entries = fs.readdirSync(receiptDirectory, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/u.test(entry.name)) {
      failures.push(`unexpected_receipt_entry:${entry.name}`)
      continue
    }
    receiptCount += 1
    const receiptPath = path.join(receiptDirectory, entry.name)
    const rawReceipt = fs.readFileSync(receiptPath, "utf8")
    if (/ai-painter-progress|\/api\/ai-painter|(?:\.runtime|data)[\\/]ai-painter/u.test(rawReceipt)) {
      failures.push(`receipt_legacy_source_coupling:${entry.name}`)
    }

    let receipt
    try {
      receipt = JSON.parse(rawReceipt)
    } catch {
      failures.push(`receipt_invalid_json:${entry.name}`)
      continue
    }
    const expectedCommandId = entry.name.slice(0, -5)
    if (receipt.commandId !== expectedCommandId) failures.push(`receipt_command_identity_mismatch:${entry.name}`)
    const calculatedCommandId = createHash("sha256").update(`${receipt.actorIdentity}\n${receipt.commandType}\n${receipt.idempotencyKeySha256}`, "utf8").digest("hex")
    if (calculatedCommandId !== expectedCommandId) failures.push(`receipt_command_derivation_mismatch:${entry.name}`)
    if (receipt.schemaVersion !== "ai_console_control_command_receipt_v1") failures.push(`receipt_schema_mismatch:${entry.name}`)
    if (receipt.commandType !== "verify_primary_registry") failures.push(`receipt_command_type_mismatch:${entry.name}`)
    if (receipt.targetType !== "primary_registry" || receipt.targetId !== "ai_console_primary_registry") failures.push(`receipt_target_mismatch:${entry.name}`)
    if (receipt.actorIdentity !== "local_console_operator" || receipt.role !== "operator") failures.push(`receipt_actor_mismatch:${entry.name}`)
    if (receipt.executorIdentity !== "ai_console_primary_registry_verifier_v1") failures.push(`receipt_executor_mismatch:${entry.name}`)
    if (!/^[a-f0-9]{64}$/u.test(receipt.idempotencyKeySha256 ?? "")) failures.push(`receipt_idempotency_hash_invalid:${entry.name}`)
    if (!/^[a-f0-9]{64}$/u.test(receipt.receiptSha256 ?? "")) failures.push(`receipt_hash_invalid:${entry.name}`)
    const { receiptSha256, ...unsignedReceipt } = receipt
    const calculatedReceiptSha256 = createHash("sha256").update(JSON.stringify(unsignedReceipt), "utf8").digest("hex")
    if (receiptSha256 !== calculatedReceiptSha256) failures.push(`receipt_sha256_mismatch:${entry.name}`)

    if (receipt.resultTerminalId === "registry_verified") {
      if (receipt.executionStatus !== "succeeded" || receipt.validationStatus !== "accepted") failures.push(`receipt_success_state_invalid:${entry.name}`)
      if (receipt.resultEvidencePath !== registryEvidencePath || receipt.resultEvidenceSha256 !== registry.registrySha256) failures.push(`receipt_success_evidence_invalid:${entry.name}`)
      if (receipt.failureCode !== null) failures.push(`receipt_success_failure_code_present:${entry.name}`)
    } else if (receipt.resultTerminalId === "registry_revision_conflict") {
      if (receipt.executionStatus !== "rejected" || receipt.validationStatus !== "rejected") failures.push(`receipt_conflict_state_invalid:${entry.name}`)
      if (receipt.resultEvidencePath !== null || receipt.resultEvidenceSha256 !== null || receipt.failureCode !== "expected_registry_revision_conflict") failures.push(`receipt_conflict_evidence_invalid:${entry.name}`)
    } else if (receipt.resultTerminalId === "registry_verification_failed") {
      if (receipt.executionStatus !== "failed_closed" || receipt.validationStatus !== "accepted") failures.push(`receipt_failed_closed_state_invalid:${entry.name}`)
      if (receipt.resultEvidencePath !== null || receipt.resultEvidenceSha256 !== null || typeof receipt.failureCode !== "string") failures.push(`receipt_failed_closed_evidence_invalid:${entry.name}`)
    } else {
      failures.push(`receipt_terminal_invalid:${entry.name}`)
    }
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  supportedCommandType: "verify_primary_registry",
  executionBoundary: "new_ai_console_registry_only",
  receiptCount,
  failures,
}, null, 2))
if (failures.length > 0) process.exitCode = 1
