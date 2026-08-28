import fs from "node:fs";
import path from "node:path";
import {
  runAutonomousClosedLoop,
  sha256File,
} from "./lib/ai-painter-autonomous-closed-loop-v1.mjs";

const args = process.argv.slice(2);
const packagePath = valueOf("--package");
const expectedSha256 = valueOf("--package-sha256");
if (!packagePath || !expectedSha256) throw new Error("--package and --package-sha256 are required");
if (path.isAbsolute(packagePath) || /^[A-Za-z]:[\\/]/.test(packagePath) || packagePath.includes("..")) throw new Error("package path must be project-relative");
const absolutePackagePath = path.resolve(process.cwd(), packagePath);
if (!absolutePackagePath.startsWith(`${path.resolve(process.cwd())}${path.sep}`)) throw new Error("package path escapes project root");
if (!fs.existsSync(absolutePackagePath)) throw new Error("package file does not exist");
const actualSha256 = sha256File(absolutePackagePath);
if (actualSha256 !== expectedSha256) throw new Error("package SHA-256 mismatch");
const spec = JSON.parse(fs.readFileSync(absolutePackagePath, "utf8"));
const state = await runAutonomousClosedLoop({ root: process.cwd(), spec, packageSha256: actualSha256 });
process.stdout.write(`${JSON.stringify({ status: state.state, packageIdentity: state.packageIdentity, ownerResponseRequired: false }, null, 2)}\n`);

function valueOf(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
