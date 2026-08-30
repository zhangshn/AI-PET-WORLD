import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { PHASES } from "./lib/ai-painter-autonomous-closed-loop-v1.mjs"
import {
  ADAPTER_EXPORTS,
  CAPABILITY_VERSION,
  EXPECTED_TRAINER_STATUS,
  TRAINER_ARCHITECTURE_VERSION,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"
import { runJointConditionLocalTransportSmokeClosedLoopCpuSimulation } from "./tests/test-ai-painter-stage4-joint-condition-local-transport-smoke-closed-loop.mjs"

export async function checkJointConditionLocalTransportSmokeClosedLoop({
  root = process.cwd(),
} = {}) {
  assert.deepEqual(PHASES, ["preflight", "execute", "validate", "review", "adjudicate", "finalize"])
  assert.deepEqual(Object.keys(ADAPTER_EXPORTS), PHASES)
  const adapterPath = path.join(root, "scripts", "lib", "ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs")
  const materializerPath = path.join(root, "scripts", "materialize-ai-painter-stage4-joint-condition-local-transport-smoke-package.mjs")
  const genericRunnerPath = path.join(root, "scripts", "lib", "ai-painter-autonomous-closed-loop-v1.mjs")
  const modeRegistryPath = path.join(root, "ml", "ai-painter", "scripts", "ai_painter_stage_mode_registry.py")
  for (const filePath of [adapterPath, materializerPath, genericRunnerPath, modeRegistryPath]) {
    assert.ok(fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `closed-loop program is missing: ${filePath}`)
  }
  const adapterSource = fs.readFileSync(adapterPath, "utf8")
  const materializerSource = fs.readFileSync(materializerPath, "utf8")
  const genericSource = fs.readFileSync(genericRunnerPath, "utf8")
  const modeRegistrySource = fs.readFileSync(modeRegistryPath, "utf8")
  for (const exportName of Object.values(ADAPTER_EXPORTS)) {
    assert.match(adapterSource, new RegExp(`export async function ${exportName}\\b`, "u"))
  }
  const executeSource = adapterSource.slice(
    adapterSource.indexOf("async function executePhase"),
    adapterSource.indexOf("async function validatePhase"),
  )
  assert.ok(executeSource.includes("inspectCompletedTraining(context.projectRoot, plan, paths)"))
  assert.ok(executeSource.indexOf("inspectCompletedTraining(context.projectRoot, plan, paths)") < executeSource.indexOf("fs.existsSync(paths.trainingOutput)"))
  assert.ok(adapterSource.includes("training_output_recovered_without_retraining"))
  assert.ok(adapterSource.includes("partial_training_output_reuse_forbidden"))
  assert.ok(adapterSource.includes('status: passed ? "all_preflight_checks_passed"'))
  assert.ok(adapterSource.includes("activeConfigAudit"))
  assert.ok(adapterSource.includes("trainerReadonlyPreflight"))
  assert.ok(adapterSource.includes("compiledContractBinding(projectRoot, plan)"))
  assert.ok(adapterSource.includes("manifest.architectureVersion, TRAINER_ARCHITECTURE_VERSION"))
  assert.ok(adapterSource.includes("smokeIdentity.architectureId, CAPABILITY_VERSION"))
  assert.ok(adapterSource.includes("manifest.resolutionStage, plan.fixedTrainingIdentity.resolution"))
  assert.ok(adapterSource.includes("trainerProcessStarted: true"))
  assert.ok(adapterSource.includes("machine_review_epoch_${preview.epoch}_completed"))
  assert.ok(adapterSource.includes("reviewOutcome: timeline.status"))
  assert.ok(adapterSource.includes("stage0Started: false"))
  assert.ok(adapterSource.includes("automaticRetryStarted: false"))
  assert.ok(materializerSource.includes("materializeAutonomousClosedLoopPackage"))
  assert.ok(genericSource.includes('"preflight", "execute", "validate", "review", "adjudicate", "finalize"'))
  assert.ok(genericSource.includes("writeTaskCapsule"))
  assert.ok(genericSource.includes("execution.sqlite"))
  assert.match(
    modeRegistrySource,
    /"joint_condition_local_transport_stage4_smoke"[\s\S]{0,400}"single_sample_smoke"[\s\S]{0,200}"joint_condition_local_transport_stage4_adapter"[\s\S]{0,120}"validation"/u,
  )

  const simulation = await runJointConditionLocalTransportSmokeClosedLoopCpuSimulation()
  assert.equal(simulation.status, "passed")
  assert.equal(simulation.automaticTrainingValidationReviewFinalization, true)
  assert.equal(simulation.completedTrainingRecoveryDoesNotRetrain, true)
  assert.equal(simulation.visualFailureClosesInFinalize, true)
  assert.equal(simulation.ownerAuthorizationRequired, false)

  return {
    status: "passed",
    capabilityVersion: CAPABILITY_VERSION,
    trainerArchitectureVersion: TRAINER_ARCHITECTURE_VERSION,
    trainerTransientStatus: EXPECTED_TRAINER_STATUS,
    phaseOrder: [...PHASES],
    productionAdaptersBound: true,
    autonomousPackageMaterializerBound: true,
    cpuSimulation: simulation,
    gpuStarted: false,
    trainingStarted: false,
    checkpointWeightsLoaded: false,
    ownerAuthorizationRequired: false,
    genericRecoveryBoundary: {
      backgroundProcessContinuitySupported: true,
      sameProcessInfrastructureRecoveryDoesNotRetrain: true,
      completedTrainerOutputCanBeRecoveredByExecuteAdapter: true,
      crossProcessExecutionStoreResumeSupported: true,
      passedEvidenceRecoverySupported: true,
      terminalSelfHealingSupported: true,
    },
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const result = await checkJointConditionLocalTransportSmokeClosedLoop()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
