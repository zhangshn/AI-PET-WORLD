import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { materializeAutonomousClosedLoopPackage } from "./lib/ai-painter-autonomous-package-materializer-v1.mjs"
import { ADAPTER_EXPORTS, validateJointConditionLocalTransportFullDataScreenExecutionPlan } from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

export const ADAPTER_PATH = "scripts/lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

export function materializeJointConditionLocalTransportFullDataScreenPackage(planPath, { root = process.cwd(), recordedAtUtc = new Date().toISOString() } = {}) {
  const normalized = normalize(planPath); const absolute = resolveInside(root, normalized)
  if (!fs.existsSync(absolute)) throw new Error("execution plan does not exist")
  const plan = validateJointConditionLocalTransportFullDataScreenExecutionPlan(JSON.parse(fs.readFileSync(absolute, "utf8")), { projectRoot: root, requireFiles: true })
  if (fs.existsSync(resolveInside(root, plan.outputRoot))) throw new Error("reserved full-data screen output already exists")
  const programPaths = [...new Set([
    ADAPTER_PATH, "scripts/materialize-ai-painter-stage4-joint-condition-local-transport-full-data-screen-package.mjs",
    "scripts/run-ai-painter-stage4-joint-condition-local-transport-full-data-screen-package.mjs",
    ...plan.commands.preflight.map((row) => row.program.path), plan.commands.activation.program.path, plan.commands.trainer.program.path,
    ...["professionalAestheticProgram", "conditionAlignmentProgram", "previewNormalizationProgram", "lateStabilityProgram"].map((role) => plan.evidenceBindings[role].path),
  ])]
  return materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1", packageIdentity: plan.packageIdentity,
    capabilityVersion: plan.capabilityVersion, ownerAuthorizationRequired: false,
    maxInfrastructureRecoveryAttempts: plan.maxInfrastructureRecoveryAttempts, outputRoot: plan.outputRoot,
    programFiles: Object.fromEntries(programPaths.map((value, index) => [`program-${String(index + 1).padStart(2, "0")}`, value])),
    inputEvidencePaths: [...new Set([normalized, ...Object.values(plan.evidenceBindings).map((row) => row.path)])],
    phaseAdapters: Object.fromEntries(Object.entries(ADAPTER_EXPORTS).map(([phase, exportName]) => [phase, { path: ADAPTER_PATH, exportName }])),
  }, { root, recordedAtUtc })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf("--plan"); if (index < 0) throw new Error("--plan is required")
  process.stdout.write(`${JSON.stringify(materializeJointConditionLocalTransportFullDataScreenPackage(process.argv[index + 1]), null, 2)}\n`)
}
function normalize(value) { if (!value || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value) || value.includes("..")) throw new Error("plan path must be project-relative"); return value.replaceAll("\\", "/") }
function resolveInside(root, relative) { const target = path.resolve(root, relative); if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("path escapes project"); return target }
