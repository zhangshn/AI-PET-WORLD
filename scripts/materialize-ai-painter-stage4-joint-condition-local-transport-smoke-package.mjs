import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs"
import {
  ADAPTER_EXPORTS,
  validateJointConditionLocalTransportSmokeExecutionPlan,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"

export const JOINT_TRANSPORT_SMOKE_ADAPTER_PATH =
  "scripts/lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"

export function materializeJointConditionLocalTransportSmokePackage(planPath, {
  root = process.cwd(), recordedAtUtc = new Date().toISOString(),
} = {}) {
  const normalizedPlanPath = normalizeProjectPath(planPath, "planPath")
  const absolutePlanPath = resolveInside(root, normalizedPlanPath)
  assert(fs.existsSync(absolutePlanPath) && fs.statSync(absolutePlanPath).isFile(), "execution plan does not exist")
  const plan = validateJointConditionLocalTransportSmokeExecutionPlan(
    JSON.parse(fs.readFileSync(absolutePlanPath, "utf8")),
    { projectRoot: root, requireFiles: true },
  )
  assert(!fs.existsSync(resolveInside(root, plan.outputRoot)), "reserved Smoke output root already exists")

  const commandPrograms = [
    ...plan.commands.preflight.map((command) => command.program.path),
    plan.commands.activation.program.path,
    plan.commands.trainer.program.path,
  ]
  const reviewPrograms = [
    plan.evidenceBindings.professionalAestheticProgram.path,
    plan.evidenceBindings.conditionAlignmentProgram.path,
    plan.evidenceBindings.previewNormalizationProgram.path,
    plan.evidenceBindings.lateStabilityProgram.path,
  ]
  const programPaths = [...new Set([
    JOINT_TRANSPORT_SMOKE_ADAPTER_PATH,
    "scripts/materialize-ai-painter-stage4-joint-condition-local-transport-smoke-package.mjs",
    ...commandPrograms,
    ...reviewPrograms,
  ])]
  const programFiles = Object.fromEntries(programPaths.map((programPath, index) => [
    `program-${String(index + 1).padStart(2, "0")}`, programPath,
  ]))
  const inputEvidencePaths = [...new Set([
    normalizedPlanPath,
    ...Object.values(plan.evidenceBindings).map((binding) => binding.path),
  ])]
  const candidate = {
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity: plan.packageIdentity,
    capabilityVersion: plan.capabilityVersion,
    ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: plan.maxInfrastructureRecoveryAttempts,
    outputRoot: plan.outputRoot,
    programFiles,
    inputEvidencePaths,
    phaseAdapters: Object.fromEntries(Object.entries(ADAPTER_EXPORTS).map(([phase, exportName]) => [
      phase, { path: JOINT_TRANSPORT_SMOKE_ADAPTER_PATH, exportName },
    ])),
  }
  return materializeAutonomousClosedLoopPackage(candidate, { root, recordedAtUtc })
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  const args = process.argv.slice(2)
  const planPath = valueOf(args, "--plan")
  if (!planPath) throw new Error("--plan is required")
  const result = materializeJointConditionLocalTransportSmokePackage(planPath)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

function valueOf(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function normalizeProjectPath(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} is required`)
  assert(!path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/u.test(value), `${label} must be project-relative`)
  const normalized = value.replaceAll("\\", "/")
  assert(!normalized.split("/").includes(".."), `${label} cannot contain parent traversal`)
  return normalized
}

function resolveInside(root, relativePath) {
  const projectRoot = path.resolve(root)
  const absolute = path.resolve(projectRoot, relativePath)
  assert(absolute.startsWith(`${projectRoot}${path.sep}`), `path escapes project root: ${relativePath}`)
  return absolute
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

