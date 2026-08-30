import fs from "node:fs"
import path from "node:path"
import { validateJointConditionLocalTransportFullDataScreenExecutionPlan } from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

const args = process.argv.slice(2); const planPath = value("--plan")
if (!planPath) throw new Error("--plan is required")
const absolute = path.resolve(process.cwd(), planPath)
const plan = validateJointConditionLocalTransportFullDataScreenExecutionPlan(JSON.parse(fs.readFileSync(absolute, "utf8")), { projectRoot: process.cwd(), requireFiles: true })
const negative = structuredClone(plan); negative.trainingIdentity.lateEpochs = [10, 20, 24]
let rejected = false
try { validateJointConditionLocalTransportFullDataScreenExecutionPlan(negative, { projectRoot: process.cwd(), requireFiles: true }) } catch { rejected = true }
if (!rejected) throw new Error("late epoch mutation was accepted")
process.stdout.write(`${JSON.stringify({ status: "passed", positive: 1, negative: 1, runId: plan.runId, ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false }, null, 2)}\n`)
function value(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null }
