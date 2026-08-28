import { readAiConsoleFormalEvidenceArtifact } from "@/server/ai-console-control/formal-evidence-index"
import { verifyLocalControlRead } from "@/server/ai-console-control/operator-session"

export const dynamic = "force-dynamic"

const safeEvidenceIdentity = /^[a-f0-9]{64}$/u
const maximumTextPreviewBytes = 64 * 1024

export async function GET(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const localRead = verifyLocalControlRead(request)
  if (!localRead.ok) return evidenceError(localRead.errorCode, localRead.status)
  const { evidenceId } = await context.params
  if (!safeEvidenceIdentity.test(evidenceId)) return evidenceError("formal_evidence_identity_invalid", 400)

  const artifact = await readAiConsoleFormalEvidenceArtifact(evidenceId)
  if (artifact.status === "not_found") return evidenceError(artifact.reasonCode, 404)
  if (artifact.status === "not_connected") return evidenceError(artifact.reasonCode, 503)
  if (artifact.status === "unknown_or_stale") return evidenceError(artifact.reasonCode, 409)

  const textPreviewEligible = artifact.record.mediaType === "application/json" || artifact.record.mediaType === "application/x-ndjson"
  const previewBytes = textPreviewEligible
    ? artifact.contentBytes.subarray(0, maximumTextPreviewBytes)
    : new Uint8Array()
  const previewTruncated = textPreviewEligible && artifact.contentBytes.byteLength > previewBytes.byteLength

  return Response.json({
    ok: true,
    schemaVersion: "ai_console_formal_evidence_artifact_detail_v1",
    integrityStatus: "verified",
    lookupMode: "exact_evidence_identity",
    record: artifact.record,
    contentInspection: {
      inspectionMode: textPreviewEligible ? "verified_utf8_preview" : "binary_metadata_only",
      previewText: textPreviewEligible ? new TextDecoder("utf-8", { fatal: false }).decode(previewBytes) : null,
      previewByteLength: previewBytes.byteLength,
      previewTruncated,
      contentByteLength: artifact.record.contentByteLength,
      contentSha256: artifact.record.contentSha256,
    },
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}

function evidenceError(errorCode: string, status: number) {
  return Response.json({
    ok: false,
    schemaVersion: "ai_console_formal_evidence_artifact_detail_v1",
    errorCode,
  }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
