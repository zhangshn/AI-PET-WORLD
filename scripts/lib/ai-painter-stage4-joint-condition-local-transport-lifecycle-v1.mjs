import fs from "node:fs"
import path from "node:path"

export const JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK =
  "adjudicate_joint_condition_local_transport_full_data_screen_failure_boundary"

export const JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND =
  "adjudicate:ai-painter-stage4-joint-condition-local-transport-full-data-screen-failure-boundary"

export const FORMAL_STAGE_VALIDATION_COMPLETED = "formal_stage_validation_completed"

const QUALIFIED_STATUS = "full_data_screen_qualified"

export function createExclusiveLeafUnderFixedParent({
  projectRoot,
  parentRelative,
  leafIdentity,
}) {
  requireIdentity(projectRoot, "project_root_invalid")
  requireIdentity(parentRelative, "fixed_parent_namespace_invalid")
  requireIdentity(leafIdentity, "leaf_identity_invalid")
  requireValue(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(leafIdentity), "leaf_identity_escapes_parent")

  const normalizedParent = parentRelative.replaceAll("\\", "/")
  requireValue(!normalizedParent.startsWith("/") && !/^[A-Za-z]:\//u.test(normalizedParent), "fixed_parent_namespace_absolute")
  const parentParts = normalizedParent.split("/")
  requireValue(!parentParts.includes("..") && !parentParts.includes("."), "fixed_parent_namespace_boundary_invalid")

  const absoluteRoot = path.resolve(projectRoot)
  const parent = path.resolve(absoluteRoot, ...parentParts)
  requireValue(parent.startsWith(`${absoluteRoot}${path.sep}`), "fixed_parent_namespace_escapes_project")
  fs.mkdirSync(parent, { recursive: true })

  const leaf = path.resolve(parent, leafIdentity)
  requireValue(path.dirname(leaf) === parent, "leaf_identity_escapes_parent")
  fs.mkdirSync(leaf, { recursive: false })
  return leaf
}

export function routeJointConditionFullDataScreenTerminal({
  status,
  sourcePackageIdentity,
  sourceRunId,
  sourceOutputRoot,
}) {
  requireIdentity(status, "full_data_screen_status_invalid")
  requireIdentity(sourcePackageIdentity, "full_data_screen_package_identity_invalid")
  requireIdentity(sourceRunId, "full_data_screen_run_identity_invalid")
  requireProjectRelativeOutput(sourceOutputRoot)
  requireValue(
    sourceOutputRoot.split("/").at(-1) === sourceRunId,
    "full_data_screen_output_run_identity_mismatch",
  )

  const qualified = status === QUALIFIED_STATUS
  return Object.freeze({
    taskId: JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK,
    taskKind: qualified
      ? "cpu_readonly_full_data_screen_qualification_adjudication"
      : "cpu_readonly_failure_boundary_adjudication",
    taskGoal: qualified
      ? "Adjudicate the verified joint-condition full-data screen qualification evidence before any formal Stage transition."
      : "Adjudicate the joint-condition full-data screen visual failure boundary and classify whether a new capability candidate is required without restarting training.",
    priority: 1,
    lifecycleStage: FORMAL_STAGE_VALIDATION_COMPLETED,
    executionState: "package_materialized",
    activity: "adjudication_ready",
    queueStatus: "ready",
    nextMachineAction: JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND,
    sourceTerminalStatus: status,
    sourcePackageIdentity,
    sourceRunId,
    sourceOutputRoot,
    automaticRetryStarted: false,
    trainingRestartAllowed: false,
  })
}

function requireProjectRelativeOutput(value) {
  requireIdentity(value, "full_data_screen_output_root_invalid")
  const candidate = value.replaceAll("\\", "/")
  requireValue(!candidate.startsWith("/") && !/^[A-Za-z]:\//u.test(candidate), "full_data_screen_output_root_absolute")
  const parts = candidate.split("/")
  requireValue(!parts.includes("..") && !parts.includes("."), "full_data_screen_output_root_boundary_invalid")
  requireValue(
    candidate.startsWith(".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/"),
    "full_data_screen_output_namespace_invalid",
  )
}

function requireIdentity(value, code) {
  requireValue(typeof value === "string" && value.length > 0, code)
}

function requireValue(condition, code) {
  if (!condition) throw new Error(code)
}
