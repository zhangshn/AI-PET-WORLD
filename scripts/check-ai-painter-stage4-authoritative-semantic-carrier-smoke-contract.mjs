import assert from "node:assert/strict"
import {
  buildControlledSmokeContract,
  validateControlledSmokeContract,
} from "./lib/ai-painter-stage4-authoritative-semantic-carrier-smoke-v1.mjs"

const evidence = ["candidate", "cpu", "gpu", "config"].map((role, index) => ({
  role,
  path: `.runtime/fixture/${role}.json`,
  sha256: String(index + 1).repeat(64),
}))
const base = buildControlledSmokeContract({ capabilityVersion: "stage4-fixture-capability", evidence })
const positive = []
const negative = []
const pos = (name, fn) => { try { fn(); positive.push({ name, passed: true }) } catch (error) { positive.push({ name, passed: false, error: error.message }) } }
const neg = (name, mutate) => { const value = structuredClone(base); mutate(value); let rejected = false; try { validateControlledSmokeContract(value) } catch { rejected = true } negative.push({ name, passed: rejected }) }

pos("canonical_contract_passes", () => validateControlledSmokeContract(base))
pos("closed_loop_contains_automatic_review", () => assert.ok(base.closedLoop.includes("automatic_machine_review")))
pos("owner_not_in_package_loop", () => assert.equal(base.internalCapability.ownerAuthorizationRequired, false))
pos("fixed_smoke_identity", () => assert.deepEqual(base.executionIdentity.previewEpochs, [1, 5, 10, 20, 30]))
pos("frozen_project_boundary", () => assert.equal(base.frozenBoundaries.lossValuesAndWeightsUnchanged, true))
neg("unknown_architecture_rejected", (v) => { v.architecture = "unknown" })
neg("free_epoch_change_rejected", (v) => { v.executionIdentity.epochCount = 31 })
neg("sample_change_rejected", (v) => { v.executionIdentity.sampleId = "other" })
neg("owner_in_loop_rejected", (v) => { v.internalCapability.ownerAuthorizationRequired = true })
neg("replay_protection_removal_rejected", (v) => { v.internalCapability.persistedReplayProtection = false })
neg("loss_change_boundary_rejected", (v) => { v.frozenBoundaries.lossValuesAndWeightsUnchanged = false })
neg("absolute_evidence_path_rejected", (v) => { v.sourceEvidence[0].path = "C:/external.json" })
neg("fake_hash_rejected", (v) => { v.sourceEvidence[0].sha256 = "x".repeat(64) })
const passed = [...positive, ...negative].every((row) => row.passed)
process.stdout.write(`${JSON.stringify({ schemaVersion: "stage4-authoritative-semantic-carrier-smoke-contract-cpu-report-v1", status: passed ? "passed" : "failed", positive: { passed: positive.filter((r) => r.passed).length, total: positive.length, cases: positive }, negative: { passed: negative.filter((r) => r.passed).length, total: negative.length, cases: negative }, safety: { gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false } }, null, 2)}\n`)
if (!passed) process.exitCode = 1
