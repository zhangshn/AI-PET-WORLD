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
    allowedCommandTypes: [
      "verify_primary_registry",
      "create_registered_task", "set_queued_task_priority", "cancel_unstarted_task",
      "register_capability_candidate", "record_capability_qualification", "register_qualified_capability_release",
      "activate_qualified_release", "register_runtime_frame_candidate", "publish_reviewed_runtime_frame",
      "consume_registered_runtime_frame", "pause_frame_publish", "resume_frame_publish", "rollback_runtime_frame", "freeze_visual_updates",
      "register_model_structure", "register_training_plan",
      "register_review_contract", "register_machine_review_observation",
    ],
  }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": result.setCookie,
      "Vary": "Cookie",
    },
  })
}
