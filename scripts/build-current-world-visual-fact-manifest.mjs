// CLI compatibility entry; shared implementation is also consumed by Runtime.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildLegacyWorldVisualFactManifest } from "./lib/natural-world-visual-manifest.mjs";
export { buildWorldVisualFactManifestFromNaturalFacts, buildLegacyWorldVisualFactManifest } from "./lib/natural-world-visual-manifest.mjs";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildLegacyWorldVisualFactManifest();
}
