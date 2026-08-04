export function selectAuthoritativeTrainingEvidence(candidates, activeTask) {
  const eligible = candidates
    .filter((candidate) => candidate && candidate.valid !== false)
    .filter((candidate) => taskIdentityMatches(candidate.taskIdentity ?? {}, activeTask ?? {}))
    .map((candidate) => ({
      ...candidate,
      occurredAtMs: parseEvidenceTime(candidate.occurredAtUtc),
      terminalPriority: Number.isFinite(candidate.terminalPriority) ? candidate.terminalPriority : 0,
      identitySpecificity: Object.values(candidate.taskIdentity ?? {}).filter(Boolean).length,
    }))
    .sort((left, right) => (
      right.occurredAtMs - left.occurredAtMs
      || right.terminalPriority - left.terminalPriority
      || right.identitySpecificity - left.identitySpecificity
      || String(left.code).localeCompare(String(right.code))
    ))

  if (!eligible.length) throw new Error("training_status_projection_has_no_eligible_evidence")

  const selected = eligible[0]
  return {
    code: selected.code,
    label: selected.label,
    summary: selected.summary,
    currentStep: selected.currentStep ?? null,
    source: selected.source,
    occurredAtUtc: selected.occurredAtUtc ?? null,
    terminalPriority: selected.terminalPriority,
    taskIdentity: normalizeTaskIdentity(selected.taskIdentity),
  }
}

function taskIdentityMatches(candidate, active) {
  const authoritativeKeys = ["modelId", "datasetPackageId", "checkpointSha256", "trainingChainId"]
  const requiredCurrentKeys = ["modelId", "datasetPackageId"].filter((key) => active[key])
  if (requiredCurrentKeys.some((key) => !candidate[key] || candidate[key] !== active[key])) return false

  let matchingIdentityFieldCount = 0
  for (const key of authoritativeKeys) {
    if (candidate[key] && active[key] && candidate[key] !== active[key]) return false
    if (candidate[key] && active[key] && candidate[key] === active[key]) matchingIdentityFieldCount += 1
  }
  return matchingIdentityFieldCount > 0
}

function normalizeTaskIdentity(value = {}) {
  return {
    modelId: value.modelId ?? null,
    datasetPackageId: value.datasetPackageId ?? null,
    checkpointSha256: value.checkpointSha256 ?? null,
    trainingChainId: value.trainingChainId ?? null,
  }
}

function parseEvidenceTime(value) {
  const parsed = Date.parse(value ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}
