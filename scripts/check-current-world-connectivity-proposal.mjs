import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const LATEST_PATH = path.join(ROOT, ".runtime", "ai-painter", "world-connectivity-proposals", "latest.json")
const failures = []

check(fs.existsSync(LATEST_PATH), "world_connectivity_proposal_latest_missing")
const latest = fs.existsSync(LATEST_PATH) ? readJson(LATEST_PATH) : null
const proposalPath = latest?.proposalPath ? path.resolve(ROOT, latest.proposalPath) : null
check(Boolean(proposalPath && isWithin(path.join(ROOT, ".runtime", "ai-painter", "world-connectivity-proposals"), proposalPath)), "world_connectivity_proposal_path_invalid")
check(Boolean(proposalPath && fs.existsSync(proposalPath)), "world_connectivity_proposal_missing")
const proposal = proposalPath && fs.existsSync(proposalPath) ? readJson(proposalPath) : null

check(proposal?.schemaVersion === "world-connectivity-blueprint-proposal-v1", "world_connectivity_proposal_schema_invalid")
check(proposal?.proposalId === latest?.proposalId, "world_connectivity_proposal_id_mismatch")
check(proposal?.status === "pending_owner_review", "world_connectivity_proposal_status_invalid")
check(proposal?.contractId === "natural-home-large-world-connectivity-v1", "world_connectivity_proposal_contract_invalid")
check(proposal?.authorityBoundary?.worldStateMutated === false, "world_connectivity_proposal_mutated_world")
check(proposal?.authorityBoundary?.formalBlueprintCreated === false, "world_connectivity_proposal_claimed_formal_blueprint")
check(proposal?.authorityBoundary?.formalBlueprintEligible === false, "world_connectivity_proposal_claimed_eligibility")
check(proposal?.authorityBoundary?.visualUsedToInferTopology === false, "world_connectivity_proposal_used_visual_topology")
check(proposal?.authorityBoundary?.rgbGenerated === false, "world_connectivity_proposal_generated_rgb")
check(proposal?.authorityBoundary?.ownerApprovalRecorded === false, "world_connectivity_proposal_claimed_owner_approval")
check(proposal?.currentRegion?.neighborRegionIds?.length === 0, "world_connectivity_proposal_invented_neighbors")
check(proposal?.blockers?.includes("world_connectivity_owner_review_required"), "world_connectivity_owner_review_blocker_missing")
check((proposal?.extractedEvidence?.waterBoundaryContacts?.length ?? 0) > 0, "world_connectivity_water_boundary_evidence_missing")
check((proposal?.extractedEvidence?.pathExtensionCandidates?.length ?? 0) > 0, "world_connectivity_path_extension_candidate_missing")

for (const candidate of proposal?.candidateConnections?.watercourse ?? []) {
  check(candidate.formalEdgePortCreated === false, `world_connectivity_water_port_claimed:${candidate.candidateId}`)
  check(candidate.connectsToRegionId === null, `world_connectivity_water_neighbor_invented:${candidate.candidateId}`)
}
for (const candidate of proposal?.candidateConnections?.path ?? []) {
  check(candidate.formalEdgePortCreated === false, `world_connectivity_path_port_claimed:${candidate.candidateId}`)
  check(candidate.connectsToRegionId === null, `world_connectivity_path_neighbor_invented:${candidate.candidateId}`)
}

if (proposal) {
  const copy = structuredClone(proposal)
  delete copy.proposalSha256
  const actualHash = crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex")
  check(actualHash === proposal.proposalSha256, "world_connectivity_proposal_hash_mismatch")
  check(actualHash === latest?.proposalSha256, "world_connectivity_proposal_latest_hash_mismatch")
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "world_connectivity_proposal_check_passed" : "world_connectivity_proposal_check_failed",
  proposalId: proposal?.proposalId ?? null,
  proposalStatus: proposal?.status ?? null,
  waterBoundaryContactCount: proposal?.extractedEvidence?.waterBoundaryContacts?.length ?? 0,
  pathBoundaryContactCount: proposal?.extractedEvidence?.pathBoundaryContacts?.length ?? 0,
  formalBlueprintCreated: proposal?.authorityBoundary?.formalBlueprintCreated ?? null,
  failures,
}
console[failures.length ? "error" : "log"](JSON.stringify(result, null, 2))
process.exit(failures.length ? 1 : 0)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function isWithin(parent, child) {
  const root = path.resolve(parent)
  const target = path.resolve(child)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function check(condition, failure) {
  if (!condition && !failures.includes(failure)) failures.push(failure)
}
