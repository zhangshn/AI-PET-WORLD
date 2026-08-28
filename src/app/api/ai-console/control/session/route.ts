import { issueLocalOperatorSession } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const result = issueLocalOperatorSession(request)
  if (!result.ok) {
    return Response.json({
      ok: false,
      schemaVersion: "ai_console_operator_session_v1",
      errorCode: result.errorCode,
    }, { status: result.status, headers: { "Cache-Control": "no-store" } })
  }

  return Response.json({
    ok: true,
    schemaVersion: "ai_console_operator_session_v1",
    actorIdentity: result.session.actorIdentity,
    role: result.session.role,
    csrfToken: result.session.csrfToken,
    expiresAtUtc: result.session.expiresAtUtc,
    allowedCommandTypes: ["verify_primary_registry"],
  }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": result.setCookie,
      "Vary": "Cookie",
    },
  })
}
