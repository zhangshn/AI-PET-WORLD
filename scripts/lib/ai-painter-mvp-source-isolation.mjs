import assert from "node:assert/strict";

export const CONTRACT_SCHEMA = "ai-painter-mvp-source-isolation-classification-contract-v1";

function exactKeys(value, keys, message) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), message);
}

export function validateSourceIsolationContract(contract) {
  assert.equal(contract.schemaVersion, CONTRACT_SCHEMA, "source isolation contract schema mismatch");
  assert.equal(contract.status, "active_normative_machine_contract", "source isolation contract inactive");
  assert.equal(contract.policyVersion, "AI-PAINTER-DATA-PROVENANCE-1.7", "source isolation policy mismatch");
  assert.equal(contract.unknownDisposition, "indeterminate_due_to_missing_evidence", "unsafe unknown disposition");
  exactKeys(contract.publicCovariateRequirements, ["licensedSourceBound", "preprocessingFrozenBeforeSplit",
    "deterministicProgramBound", "sampleRgbRead", "sampleSupervisionTargetRead",
    "sampleRepairOrEvaluationFeedbackRead", "sampleSpecificGeometryContextRead",
    "positiveAreaPrimaryWindowOverlap"], "public covariate requirements changed");
  return contract;
}

export function classifySourceRelation(contract, relation) {
  validateSourceIsolationContract(contract);
  assert.ok(relation && typeof relation.kind === "string", "source relation kind missing");
  const classes = contract.relationClasses;
  if (classes.must_link.includes(relation.kind)) return {status: "must_link", crossSplitAllowed: false};
  if (classes.cross_split_block.includes(relation.kind)) return {status: "cross_split_block", crossSplitAllowed: false};
  if (classes.not_automatic_dependency.includes(relation.kind))
    return {status: "not_automatic_dependency", crossSplitAllowed: false};
  if (classes.conditionally_independent_public_covariate.includes(relation.kind)) {
    const evidence = relation.evidence;
    if (!evidence || typeof evidence !== "object")
      return {status: contract.unknownDisposition, crossSplitAllowed: false};
    for (const [key, expected] of Object.entries(contract.publicCovariateRequirements)) {
      if (evidence[key] !== expected)
        return {status: contract.unknownDisposition, crossSplitAllowed: false, failedRequirement: key};
    }
    // These fields are caller claims. The actual source bytes, preprocessing
    // program and chronology have not been authenticated by this pure function.
    return {status: contract.unknownDisposition, crossSplitAllowed: false,
      failedRequirement: "authenticated_source_and_program_receipts"};
  }
  return {status: contract.unknownDisposition, crossSplitAllowed: false};
}
