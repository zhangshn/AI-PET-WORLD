// CLI compatibility entry; shared implementation is also consumed by Runtime.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildEarthGeospatialCompleteMapConditions } from "./lib/natural-world-geospatial-generator.mjs";
export { NATURAL_WORLD_PRODUCER_FILES, naturalWorldFactsEnvelope, verifyNaturalWorldFactRelease, createNaturalWorldRandom, replacementPathOriginWithinContract, buildEarthGeospatialCompleteMapConditions, describeMeasuredWaterDerivation, buildVariableWidthCorridorPolygons } from "./lib/natural-world-geospatial-generator.mjs";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildEarthGeospatialCompleteMapConditions();
}
