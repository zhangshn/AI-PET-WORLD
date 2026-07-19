import fs from "node:fs"
import path from "node:path"

export function readConditionalRgbGenerationRequests(requestRoot) {
  if (!fs.existsSync(requestRoot)) return []

  return fs.readdirSync(requestRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(requestRoot, entry.name, "request.json"))
    .filter((requestPath) => fs.existsSync(requestPath))
    .flatMap((requestPath) => {
      try {
        return [{
          ...JSON.parse(fs.readFileSync(requestPath, "utf8")),
          requestPath,
        }]
      } catch {
        return []
      }
    })
}

export function evaluateConditionalRgbGenerationSequence({
  sourceRecordId,
  conditionLabel,
  generationContractVersion,
  taskId = null,
  conditionPackId = null,
  conditionPackSha256 = null,
  outputRecordBase,
  libraryRecords,
  generationRequests,
  ownerAuthorizedRetry = false,
  retryReason = null,
}) {
  if (!conditionLabel?.trim()) throw new Error("conditionLabel is required for conditional RGB sequence identity")
  if (!generationContractVersion?.trim()) throw new Error("generationContractVersion is required for conditional RGB sequence identity")

  const requests = generationRequests
    .filter((request) => (
      request.sourceRecordId === sourceRecordId
      && request.conditionLabel === conditionLabel
      && request.generationContractVersion === generationContractVersion
      && matchesOptionalIdentity(request.taskPackageId, taskId)
      && matchesOptionalIdentity(request.conditionPackId, conditionPackId)
      && matchesOptionalIdentity(request.conditionPackSha256, conditionPackSha256)
    ))
    .sort((left, right) => timestampOf(left).localeCompare(timestampOf(right)))
  const outputIds = new Set(requests.map((request) => request.outputRecordId).filter(Boolean))
  const records = libraryRecords
    .filter((record) => (
      outputIds.has(record.recordId)
      || (
        record.recordId?.startsWith(`${outputRecordBase}-v`)
        && matchesRecordConditionIdentity(record, { taskId, conditionPackId, conditionPackSha256 })
      )
    ))
    .sort((left, right) => timestampOf(left).localeCompare(timestampOf(right)))
  const pendingOwnerRecords = records.filter((record) => record.reviews?.ownerReviewStatus === "pending_review")
  const ownerApprovedRecords = records.filter((record) => record.reviews?.ownerReviewStatus === "owner_approved")
  const latestRequest = requests.at(-1) ?? null

  if (pendingOwnerRecords.length > 0) {
    return blocked(
      "conditional_rgb_generation_blocked_pending_owner_review",
      "The same condition already has an image waiting for project-owner review.",
      requests,
      records,
      pendingOwnerRecords.map((record) => record.recordId),
      conditionLabel,
      generationContractVersion,
    )
  }

  if (ownerApprovedRecords.length > 0) {
    return blocked(
      "conditional_rgb_generation_blocked_condition_already_owner_approved",
      "The condition already has an owner-approved RGB pair and must advance instead of generating another version.",
      requests,
      records,
      ownerApprovedRecords.map((record) => record.recordId),
      conditionLabel,
      generationContractVersion,
    )
  }

  if (latestRequest?.status === "ready_for_openai_assisted_generation") {
    return blocked(
      "conditional_rgb_generation_blocked_existing_active_request",
      "The same condition already has an active or retryable generation request.",
      requests,
      records,
      [latestRequest.outputRecordId].filter(Boolean),
      conditionLabel,
      generationContractVersion,
    )
  }

  if (requests.length > 0 || records.length > 0) {
    if (!ownerAuthorizedRetry) {
      return blocked(
        "conditional_rgb_generation_blocked_repeat_requires_owner_authorization",
        "The same condition has generation history. A new version requires explicit project-owner retry authorization.",
        requests,
        records,
        records.map((record) => record.recordId),
        conditionLabel,
        generationContractVersion,
      )
    }
    if (!retryReason?.trim()) {
      return blocked(
        "conditional_rgb_generation_blocked_retry_reason_missing",
        "Owner-authorized retry requires a non-empty retry reason.",
        requests,
        records,
        records.map((record) => record.recordId),
        conditionLabel,
        generationContractVersion,
      )
    }
  }

  return {
    allowed: true,
    code: "conditional_rgb_generation_sequence_allowed",
    sourceRecordId,
    conditionLabel,
    generationContractVersion,
    taskId,
    conditionPackId,
    conditionPackSha256,
    priorRequestCount: requests.length,
    priorRecordCount: records.length,
    ownerAuthorizedRetry,
    retryReason: retryReason?.trim() || null,
  }
}

function matchesRecordConditionIdentity(record, identity) {
  const binding = record.conditionBinding ?? {}
  return matchesOptionalIdentity(binding.taskId, identity.taskId)
    && matchesOptionalIdentity(binding.conditionPackId, identity.conditionPackId)
    && matchesOptionalIdentity(binding.conditionPackSha256, identity.conditionPackSha256)
}

function matchesOptionalIdentity(actual, expected) {
  return !expected || actual === expected
}

function blocked(code, message, requests, records, blockingRecordIds, conditionLabel, generationContractVersion) {
  return {
    allowed: false,
    code,
    message,
    conditionLabel,
    generationContractVersion,
    priorRequestCount: requests.length,
    priorRecordCount: records.length,
    blockingRecordIds,
    latestRequestId: requests.at(-1)?.requestId ?? null,
    latestOutputRecordId: requests.at(-1)?.outputRecordId ?? null,
  }
}

function timestampOf(value) {
  return value.updatedAtUtc ?? value.createdAtUtc ?? ""
}
