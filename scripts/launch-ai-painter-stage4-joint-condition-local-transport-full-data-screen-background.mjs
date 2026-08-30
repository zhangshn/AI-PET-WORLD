import { launchAutonomousClosedLoopBackground } from "./lib/ai-painter-autonomous-background-launcher-v1.mjs"

const args = process.argv.slice(2); const packagePath = value("--package"); const packageSha256 = value("--package-sha256")
if (!packagePath || !packageSha256) throw new Error("--package and --package-sha256 are required")
const result = await launchAutonomousClosedLoopBackground({ root: process.cwd(), packagePath, packageSha256, runnerPath: "scripts/run-ai-painter-stage4-joint-condition-local-transport-full-data-screen-package.mjs" })
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
function value(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null }
