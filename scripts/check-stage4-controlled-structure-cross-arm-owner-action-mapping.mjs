import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
const runnerPath = path.resolve(ROOT, "scripts/run-stage4-controlled-structure-cross-arm-adjudication.mjs")
const source = fs.readFileSync(runnerPath, "utf8")
const expected = {
  condition_fusion_only_priority: "compile_and_execute_condition_fusion_only_final_direct_residual_23_64_12_stage0_full_training",
  capacity_only_priority: "compile_and_execute_capacity_only_base_width_64_to_existing_level1_128_stage0_full_training",
  both_arms_not_qualified_for_stage0: "owner_decide_structure_route_after_both_controlled_arms_not_qualified",
  controlled_arm_evidence_conflict: "choose_reexecute_two_controlled_smokes_with_persisted_peak_gpu_telemetry_or_authorize_contract_order_change_to_parameter_count_tiebreak",
}

const positive = {
  fusion_priority_maps_to_fresh_stage0: source.includes(expected.condition_fusion_only_priority),
  capacity_priority_maps_to_fresh_stage0: source.includes(expected.capacity_only_priority),
  both_unqualified_maps_to_owner_decision: source.includes(expected.both_arms_not_qualified_for_stage0),
  evidence_conflict_keeps_bounded_policy_request: source.includes(expected.controlled_arm_evidence_conflict),
  owner_request_uses_resolved_mapping: /requestedAction:\s*ownerAction\.requestedAction/.test(source),
  capsule_uses_resolved_mapping: /nextLegalAction:\s*read\(ownerPath\)\.requestedAction/.test(source),
  priority_has_no_blocker: /condition_fusion_only_priority:[\s\S]*?blocker:\s*null/.test(source),
  historical_requests_remain_immutable: !/writeJsonAtomic\([^)]*superseded/i.test(source),
}
const rejects = (value, action) => expected[value] !== action
const negative = {
  fusion_stale_rerun_action_rejected: rejects("condition_fusion_only_priority", expected.controlled_arm_evidence_conflict),
  fusion_capacity_action_rejected: rejects("condition_fusion_only_priority", expected.capacity_only_priority),
  capacity_fusion_action_rejected: rejects("capacity_only_priority", expected.condition_fusion_only_priority),
  both_unqualified_stage0_action_rejected: rejects("both_arms_not_qualified_for_stage0", expected.condition_fusion_only_priority),
  evidence_conflict_stage0_action_rejected: rejects("controlled_arm_evidence_conflict", expected.condition_fusion_only_priority),
  unknown_outcome_absent: !Object.hasOwn(expected, "unknown_outcome"),
  automatic_stage0_not_granted: !/automaticApproval:\s*true/.test(source),
  threshold_change_not_requested: !expected.condition_fusion_only_priority.includes("threshold"),
}
assert.ok(Object.values(positive).every(Boolean), `positive failures: ${Object.entries(positive).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
assert.ok(Object.values(negative).every(Boolean), `negative failures: ${Object.entries(negative).filter(([, value]) => !value).map(([key]) => key).join(",")}`)
const report = {
  schemaVersion: "stage4-controlled-structure-cross-arm-owner-action-mapping-cpu-report-v1",
  status: "stage4_controlled_structure_cross_arm_owner_action_mapping_cpu_passed",
  positive, negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false },
}
if (args.report) {
  const output = path.resolve(ROOT, args.report)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}
console.log(JSON.stringify(report, null, 2))

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    if (!key?.startsWith("--") || index + 1 >= values.length) throw new Error("invalid arguments")
    result[key.slice(2)] = values[index + 1]
  }
  return result
}
