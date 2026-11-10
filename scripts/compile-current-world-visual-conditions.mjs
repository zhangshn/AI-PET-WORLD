// CLI compatibility entry; shared implementation is also consumed by Runtime.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileCurrentWorldVisualConditions } from "./lib/natural-world-condition-compiler.mjs";
export { verifyNaturalWorldConditionPackage, compileCurrentWorldVisualConditions } from "./lib/natural-world-condition-compiler.mjs";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await compileCurrentWorldVisualConditions();
}
