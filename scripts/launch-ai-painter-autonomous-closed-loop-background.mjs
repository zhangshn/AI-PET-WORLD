import { launchAutonomousClosedLoopBackground } from "./lib/ai-painter-autonomous-background-launcher-v1.mjs";

const args = process.argv.slice(2);
const packagePath = valueOf("--package");
const packageSha256 = valueOf("--package-sha256");
if (!packagePath || !packageSha256) throw new Error("--package and --package-sha256 are required");
const receipt = await launchAutonomousClosedLoopBackground({ root: process.cwd(), packagePath, packageSha256 });
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
function valueOf(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
