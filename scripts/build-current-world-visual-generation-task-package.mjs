// CLI compatibility entry; shared implementation is also consumed by Runtime.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildLegacyWorldVisualGenerationTaskPackage } from "./lib/natural-world-visual-task.mjs";
export { buildInitialNaturalWorldVisualTask, buildLegacyWorldVisualGenerationTaskPackage } from "./lib/natural-world-visual-task.mjs";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildLegacyWorldVisualGenerationTaskPackage();
}
