import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const AUTHORIZATION_SCHEMA = "project-owner-write-authorization-v2"
const TRUST_REGISTRY_SCHEMA = "project-owner-trust-registry-v1"
const DEFAULT_TRUST_REGISTRY_PATH = "data/ai-painter/system-governance/project-owner-trust-registry-v1.json"
const DEFAULT_CONSUMPTION_ROOT = ".runtime/project-owner-write-authorization-consumptions"
const AUTHORIZATION_PATH_PREFIXES = [
  ".runtime/ai-painter/owner-action-requests/",
  "data/ai-painter/system-governance/owner-authorizations/",
]

export class OwnerAuthorizationCoreError extends Error {
  constructor(message, code, status = 403) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function verifyOwnerAuthorization(input) {
  const root = path.resolve(input.root ?? process.cwd())
  const authorizationPath = normalizeRelativePath(input.authorizationPath)
  if (!AUTHORIZATION_PATH_PREFIXES.some((prefix) => authorizationPath.startsWith(prefix)) || !authorizationPath.endsWith("/request.json")) {
    throw new OwnerAuthorizationCoreError("Owner授权文件不在允许的证据目录。", "owner_authorization_path_invalid")
  }

  const absoluteAuthorizationPath = path.resolve(root, authorizationPath)
  if (!isWithin(absoluteAuthorizationPath, root)) {
    throw new OwnerAuthorizationCoreError("Owner授权路径越过项目边界。", "owner_authorization_path_escape")
  }

  const bytes = readRequiredFile(absoluteAuthorizationPath, "owner_authorization_missing")
  const actualSha256 = sha256(bytes)
  const providedSha256 = stringValue(input.providedSha256)?.toLowerCase()
  if (!providedSha256 || !/^[a-f0-9]{64}$/.test(providedSha256) || providedSha256 !== actualSha256) {
    throw new OwnerAuthorizationCoreError("Owner授权文件哈希不匹配。", "owner_authorization_hash_mismatch")
  }

  const authorization = parseJson(bytes, "owner_authorization_json_invalid")
  if (authorization.schemaVersion !== AUTHORIZATION_SCHEMA || authorization.status !== "authorized") {
    throw new OwnerAuthorizationCoreError("Owner授权不是受支持的已授权终态。", "owner_authorization_not_active")
  }

  const ownerDecision = recordValue(authorization.ownerDecision)
  const binding = recordValue(authorization.binding)
  const signature = recordValue(authorization.signature)
  const expectation = normalizeExpectation(input.expectation)
  const ownerCommandRef = requiredString(input.ownerCommandRef, "owner_command_ref_missing")
  const scope = requiredString(input.scope, "owner_authorization_scope_missing")

  if (ownerDecision.decision !== "authorized" || ownerDecision.commandRef !== ownerCommandRef || ownerDecision.scope !== scope) {
    throw new OwnerAuthorizationCoreError("Owner决定、命令身份或范围不匹配。", "owner_authorization_identity_mismatch")
  }
  if (!Array.isArray(authorization.authorizedActions) || authorization.authorizedActions.length !== 1 || authorization.authorizedActions[0] !== expectation.action) {
    throw new OwnerAuthorizationCoreError("Owner授权必须只绑定本次写动作。", "owner_authorization_action_mismatch")
  }

  const expectedTargetSha256 = sha256(Buffer.from(canonicalJson(expectation.target)))
  const expectedPayloadSha256 = sha256(Buffer.from(canonicalJson(expectation.payload)))
  if (
    binding.action !== expectation.action
    || binding.method !== expectation.method
    || binding.route !== expectation.route
    || binding.targetSha256 !== expectedTargetSha256
    || binding.payloadSha256 !== expectedPayloadSha256
  ) {
    throw new OwnerAuthorizationCoreError("Owner授权与具体目标或请求载荷不匹配。", "owner_authorization_binding_mismatch")
  }

  const validFromMs = Date.parse(requiredString(authorization.validFromUtc, "owner_authorization_time_invalid"))
  const expiresAtMs = Date.parse(requiredString(authorization.expiresAtUtc, "owner_authorization_time_invalid"))
  const nowMs = input.now instanceof Date ? input.now.getTime() : Date.now()
  if (!Number.isFinite(validFromMs) || !Number.isFinite(expiresAtMs) || validFromMs > nowMs || expiresAtMs <= nowMs || expiresAtMs <= validFromMs) {
    throw new OwnerAuthorizationCoreError("Owner授权不在有效时间窗口内。", "owner_authorization_expired_or_not_yet_valid")
  }

  const registry = loadTrustedRegistry({
    root,
    registryPath: input.trustRegistryPath,
    registrySha256: input.trustRegistrySha256,
  })
  const keyId = requiredString(signature.keyId, "owner_signature_key_missing")
  const key = registry.keys.find((item) => item.keyId === keyId && item.status === "active")
  if (!key || key.algorithm !== "ed25519") {
    throw new OwnerAuthorizationCoreError("Owner签名密钥不受信任。", "owner_signature_key_untrusted")
  }
  if (!allows(key.allowedActions, expectation.action) || !allows(key.allowedScopes, scope)) {
    throw new OwnerAuthorizationCoreError("Owner签名密钥无权签发本动作或范围。", "owner_signature_key_scope_denied")
  }
  if (signature.algorithm !== "ed25519") {
    throw new OwnerAuthorizationCoreError("Owner签名算法无效。", "owner_signature_algorithm_invalid")
  }

  const signatureBytes = decodeBase64(requiredString(signature.valueBase64, "owner_signature_missing"))
  const signedBytes = Buffer.from(canonicalJson(withoutSignature(authorization)), "utf8")
  let signatureValid = false
  try {
    signatureValid = verifySignature(null, signedBytes, createPublicKey(key.publicKeyPem), signatureBytes)
  } catch {
    signatureValid = false
  }
  if (!signatureValid) {
    throw new OwnerAuthorizationCoreError("Owner授权签名验证失败。", "owner_signature_invalid")
  }

  return {
    authorizationId: requiredString(authorization.authorizationId, "owner_authorization_id_missing"),
    authorizationPath,
    authorizationSha256: actualSha256,
    ownerCommandRef,
    scope,
    action: expectation.action,
    method: expectation.method,
    route: expectation.route,
    targetSha256: expectedTargetSha256,
    payloadSha256: expectedPayloadSha256,
    signerKeyId: keyId,
    expiresAtUtc: new Date(expiresAtMs).toISOString(),
  }
}

export function consumeOwnerAuthorization(verified, options = {}) {
  const root = path.resolve(options.root ?? process.cwd())
  const consumptionRoot = path.resolve(root, options.consumptionRoot ?? DEFAULT_CONSUMPTION_ROOT)
  if (!isWithin(consumptionRoot, root)) {
    throw new OwnerAuthorizationCoreError("Owner授权消费目录越过项目边界。", "owner_consumption_path_escape")
  }
  const identity = sha256(Buffer.from(canonicalJson({
    authorizationId: verified.authorizationId,
    action: verified.action,
    method: verified.method,
    route: verified.route,
    targetSha256: verified.targetSha256,
    payloadSha256: verified.payloadSha256,
  })))
  const authorizationRoot = path.join(consumptionRoot, safeSegment(verified.authorizationId))
  const consumptionPath = path.join(authorizationRoot, `${identity}.json`)
  fs.mkdirSync(authorizationRoot, { recursive: true })

  let handle
  try {
    handle = fs.openSync(consumptionPath, "wx")
    fs.writeFileSync(handle, `${JSON.stringify({
      schemaVersion: "project-owner-write-authorization-consumption-v2",
      status: "consumed_before_write_execution",
      consumedAtUtc: new Date().toISOString(),
      pid: process.pid,
      ...verified,
    }, null, 2)}\n`, "utf8")
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new OwnerAuthorizationCoreError("该Owner授权已消费，禁止重复执行。", "owner_authorization_already_consumed", 409)
    }
    throw error
  } finally {
    if (handle !== undefined) fs.closeSync(handle)
  }

  return path.relative(root, consumptionPath).replaceAll("\\", "/")
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeJson(value))
}

export function authorizationBinding(expectation) {
  const normalized = normalizeExpectation(expectation)
  return {
    action: normalized.action,
    method: normalized.method,
    route: normalized.route,
    targetSha256: sha256(Buffer.from(canonicalJson(normalized.target))),
    payloadSha256: sha256(Buffer.from(canonicalJson(normalized.payload))),
  }
}

function loadTrustedRegistry({ root, registryPath, registrySha256 }) {
  const configuredPath = registryPath ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_PATH ?? DEFAULT_TRUST_REGISTRY_PATH
  const configuredSha256 = stringValue(registrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256)?.toLowerCase()
  if (!configuredSha256 || !/^[a-f0-9]{64}$/.test(configuredSha256)) {
    throw new OwnerAuthorizationCoreError("未配置Owner信任注册表哈希锚点。", "owner_trust_registry_anchor_missing")
  }
  const absolutePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(root, configuredPath)
  const bytes = readRequiredFile(absolutePath, "owner_trust_registry_missing")
  if (sha256(bytes) !== configuredSha256) {
    throw new OwnerAuthorizationCoreError("Owner信任注册表哈希锚点不匹配。", "owner_trust_registry_hash_mismatch")
  }
  const registry = parseJson(bytes, "owner_trust_registry_json_invalid")
  if (registry.schemaVersion !== TRUST_REGISTRY_SCHEMA || registry.status !== "active" || !Array.isArray(registry.keys)) {
    throw new OwnerAuthorizationCoreError("Owner信任注册表无效。", "owner_trust_registry_invalid")
  }
  return registry
}

function normalizeExpectation(expectation) {
  const source = recordValue(expectation)
  return {
    action: requiredString(source.action, "owner_expected_action_missing"),
    method: requiredString(source.method, "owner_expected_method_missing").toUpperCase(),
    route: requiredString(source.route, "owner_expected_route_missing"),
    target: source.target ?? null,
    payload: source.payload ?? null,
  }
}

function normalizeJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalizeJson(value[key])]))
  }
  throw new OwnerAuthorizationCoreError("授权绑定数据不是可规范化JSON。", "owner_authorization_binding_not_json", 400)
}

function withoutSignature(authorization) {
  return Object.fromEntries(Object.entries(authorization).filter(([key]) => key !== "signature"))
}

function readRequiredFile(file, code) {
  try {
    return fs.readFileSync(file)
  } catch {
    throw new OwnerAuthorizationCoreError("授权所需文件不存在。", code)
  }
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new OwnerAuthorizationCoreError("授权所需JSON无效。", code)
  }
}

function requiredString(value, code) {
  const result = stringValue(value)
  if (!result) throw new OwnerAuthorizationCoreError("Owner授权字段缺失。", code)
  return result
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function normalizeRelativePath(value) {
  const normalized = requiredString(value, "owner_authorization_path_missing").replaceAll("\\", "/")
  if (path.isAbsolute(normalized) || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new OwnerAuthorizationCoreError("Owner授权路径无效。", "owner_authorization_path_invalid")
  }
  return normalized
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function allows(values, expected) {
  return Array.isArray(values) && (values.includes("*") || values.includes(expected))
}

function decodeBase64(value) {
  const bytes = Buffer.from(value, "base64")
  if (bytes.length !== 64 || bytes.toString("base64").replaceAll("=", "") !== value.replaceAll("=", "")) {
    throw new OwnerAuthorizationCoreError("Owner签名编码无效。", "owner_signature_encoding_invalid")
  }
  return bytes
}

function safeSegment(value) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(value)) {
    throw new OwnerAuthorizationCoreError("Owner授权ID不能用于消费记录。", "owner_authorization_id_invalid")
  }
  return value
}
