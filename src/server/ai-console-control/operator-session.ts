import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const sessionCookieName = "ai_console_operator_session"
const sessionLifetimeSeconds = 30 * 60
const sessionSigningSecret = loadSessionSigningSecret()

type OperatorSessionPayload = {
  schemaVersion: "ai_console_operator_session_v1"
  actorIdentity: "local_console_operator"
  role: "operator"
  csrfToken: string
  issuedAtUtc: string
  expiresAtUtc: string
}

export type VerifiedOperatorSession = Pick<OperatorSessionPayload, "actorIdentity" | "role" | "csrfToken" | "expiresAtUtc">

export type OperatorSessionVerification =
  | { ok: true; session: VerifiedOperatorSession }
  | { ok: false; status: 401 | 403; errorCode: string }

export function verifyLocalControlRead(request: Request): { ok: true } | { ok: false; status: 403; errorCode: string } {
  return isLoopbackRequest(request)
    ? { ok: true }
    : { ok: false, status: 403, errorCode: "local_control_loopback_required" }
}

export function issueLocalOperatorSession(request: Request):
  | { ok: true; session: VerifiedOperatorSession; setCookie: string }
  | { ok: false; status: 403; errorCode: string } {
  if (!isLoopbackRequest(request)) {
    return { ok: false, status: 403, errorCode: "local_operator_session_loopback_required" }
  }

  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.valueOf() + sessionLifetimeSeconds * 1000)
  const payload: OperatorSessionPayload = {
    schemaVersion: "ai_console_operator_session_v1",
    actorIdentity: "local_console_operator",
    role: "operator",
    csrfToken: randomBytes(24).toString("base64url"),
    issuedAtUtc: issuedAt.toISOString(),
    expiresAtUtc: expiresAt.toISOString(),
  }
  const signedToken = signSessionPayload(payload)
  return {
    ok: true,
    session: payload,
    setCookie: `${sessionCookieName}=${signedToken}; HttpOnly; SameSite=Strict; Path=/api/ai-console/control; Max-Age=${sessionLifetimeSeconds}`,
  }
}

export function verifyLocalOperatorMutation(request: Request): OperatorSessionVerification {
  if (!isLoopbackRequest(request)) {
    return { ok: false, status: 403, errorCode: "local_control_loopback_required" }
  }
  const origin = request.headers.get("origin")
  if (!origin || !isLoopbackUrl(origin) || new URL(origin).host !== new URL(request.url).host) {
    return { ok: false, status: 403, errorCode: "local_control_same_origin_required" }
  }

  const token = readCookie(request.headers.get("cookie"), sessionCookieName)
  if (!token) return { ok: false, status: 401, errorCode: "local_operator_session_required" }
  const payload = verifySignedSessionPayload(token)
  if (!payload) return { ok: false, status: 401, errorCode: "local_operator_session_invalid" }
  if (Date.parse(payload.expiresAtUtc) <= Date.now()) {
    return { ok: false, status: 401, errorCode: "local_operator_session_expired" }
  }

  const csrfToken = request.headers.get("x-ai-console-csrf")
  if (!csrfToken || !safeStringEqual(csrfToken, payload.csrfToken)) {
    return { ok: false, status: 403, errorCode: "local_operator_csrf_invalid" }
  }
  return { ok: true, session: payload }
}

function signSessionPayload(payload: OperatorSessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", sessionSigningSecret).update(encodedPayload, "utf8").digest("base64url")
  return `${encodedPayload}.${signature}`
}

function verifySignedSessionPayload(token: string): OperatorSessionPayload | null {
  const [encodedPayload, providedSignature, extra] = token.split(".")
  if (!encodedPayload || !providedSignature || extra) return null
  const expectedSignature = createHmac("sha256", sessionSigningSecret).update(encodedPayload, "utf8").digest("base64url")
  if (!safeStringEqual(providedSignature, expectedSignature)) return null

  try {
    const value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<OperatorSessionPayload>
    if (value.schemaVersion !== "ai_console_operator_session_v1") return null
    if (value.actorIdentity !== "local_console_operator" || value.role !== "operator") return null
    if (typeof value.csrfToken !== "string" || value.csrfToken.length < 24) return null
    if (typeof value.issuedAtUtc !== "string" || typeof value.expiresAtUtc !== "string") return null
    if (Number.isNaN(Date.parse(value.issuedAtUtc)) || Number.isNaN(Date.parse(value.expiresAtUtc))) return null
    return value as OperatorSessionPayload
  } catch {
    return null
  }
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=")
    if (separatorIndex < 0) continue
    if (pair.slice(0, separatorIndex).trim() === name) {
      return pair.slice(separatorIndex + 1).trim()
    }
  }
  return null
}

function isLoopbackRequest(request: Request): boolean {
  if (!isLoopbackUrl(request.url)) return false
  const host = request.headers.get("host")
  if (!host || !isLoopbackAuthority(host)) return false
  const forwardedHost = request.headers.get("x-forwarded-host")
  return !forwardedHost || forwardedHost.split(",").every((value) => isLoopbackAuthority(value.trim()))
}

function isLoopbackAuthority(value: string): boolean {
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/iu.test(value)) return false
  return isLoopbackUrl(`http://${value}`)
}

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  } catch {
    return false
  }
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function loadSessionSigningSecret(): Buffer {
  const configured = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim()
  if (configured) {
    const secret = Buffer.from(configured, "utf8")
    if (secret.length < 32) {
      throw new Error("AI_PET_WORLD_OPERATOR_SESSION_SECRET must contain at least 32 bytes")
    }
    return secret
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_PET_WORLD_OPERATOR_SESSION_SECRET is required in production")
  }
  // Development/test fallback is deliberately process-local. Production
  // deployments must provide a stable secret so detached workers can verify
  // the same session after a restart.
  return randomBytes(32)
}
