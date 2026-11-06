import { BASELINE_IDENTITY, BASELINE_SELECTION, baselineDigest, baselineSha256 } from "./natural-world-baseline-proof.mjs"
import { COMPAT_ROOT, COMPAT_SCHEMA, verifyNaturalWorldBaselineCompatibility } from "./natural-world-baseline-compatibility.mjs"
import { naturalWorldFactsEnvelope } from "../build-earth-geospatial-complete-map-conditions.mjs"

// Only the selected first-world creation proof can use historical producer bytes.
// World data, source rasters, task sidecars and the current Store are read live.
export function readCompatibleFirstWorldInput({ request, record, read }) {
  if (request.identity.worldId !== BASELINE_IDENTITY.worldId) return null
  const bindings = new Map()
  function capture(path, limit) {
    const bytes = read(path, limit), digest = baselineSha256(bytes)
    if (bindings.has(path) && bindings.get(path) !== digest) throw Error("first-world input changed during read:" + path)
    bindings.set(path, digest)
    return bytes
  }
  const selection = JSON.parse(capture(BASELINE_SELECTION, 65536))
  if (selection.schemaVersion !== COMPAT_SCHEMA) return null
  const proof = verifyNaturalWorldBaselineCompatibility({ selection, read: capture })
  if (baselineDigest(proof.identity) !== baselineDigest(request.identity) ||
      proof.store.path !== request.runtimeSave.path || proof.store.sha256 !== request.runtimeSave.sha256 ||
      proof.store.tick !== request.tick || proof.store.stateVersion !== request.stateVersion ||
      proof.store.worldFactsPayloadSha256 !== request.factHash) throw Error("first-world compatibility identity differs")
  function bound(binding, limit) {
    const bytes = capture(binding.path, limit)
    if (bindings.get(binding.path) !== binding.sha256) throw Error("first-world historical binding differs:" + binding.path)
    return bytes
  }
  function stored(role) {
    const matches = record.sourceBindings.filter(b => b.role === role)
    if (matches.length !== 1) throw Error("first-world historical role differs:" + role)
    return { path: matches[0].uri, sha256: matches[0].fileSha256 }
  }
  const release = JSON.parse(bound(request.sourceFactRelease, 2 ** 21))
  const proposal = JSON.parse(bound(release.generatedFactsBinding, 2 ** 21))
  const producers = new Map(release.producerBindings.map(b => [b.path, b.sha256]))
  const historicalReads = JSON.parse(bound(stored("input_read_receipts"), 2 ** 21))
  if (!Array.isArray(historicalReads) || historicalReads.length > 1024) throw Error("first-world receipt limit")
  for (const receipt of historicalReads) {
    let logical = receipt.path
    if (producers.has(logical)) {
      if (producers.get(logical) !== receipt.fileSha256) throw Error("first-world producer receipt differs:" + logical)
      logical = COMPAT_ROOT + "prior-source-by-sha/" + receipt.fileSha256 + ".txt"
    }
    if (!bindings.has(logical)) bound({path: logical, sha256: receipt.fileSha256}, 128 * 1024 * 1024)
    if (bindings.get(logical) !== receipt.fileSha256) throw Error("first-world source receipt differs:" + logical)
  }
  const director = JSON.parse(bound(stored("world_director"), 2 ** 21))
  const visualFacts = JSON.parse(bound(stored("visual_fact_manifest"), 2 ** 21))
  const manifest = JSON.parse(bound(request.taskManifest, 2 ** 21)), task = JSON.parse(bound(request.taskPackage, 2 ** 21))
  const { taskSha256, ...payload } = task
  if (manifest.taskPath !== request.taskPackage.path || manifest.taskSha256 !== taskSha256 ||
      taskSha256 !== baselineSha256(Buffer.from(JSON.stringify(payload))) ||
      manifest.directorSha256 !== baselineSha256(Buffer.from(JSON.stringify(director))) ||
      baselineDigest(director) !== baselineDigest(task.directorPlan) ||
      [visualFacts, task, manifest, director].some(item => item.worldId !== record.worldId ||
        item.regionId !== record.regionId || item.factHash !== request.factHash || item.tick !== record.tick ||
        item.sourceFactReleaseIdentity !== release.sourceFactReleaseIdentity)) throw Error("first-world historical task differs")
  const inputReads = [...bindings].map(([path, fileSha256]) => ({path, fileSha256}))
  return {release, proposal, factsEnvelope: naturalWorldFactsEnvelope(proposal), inputReads,
    selectionBinding: {path: BASELINE_SELECTION, sha256: bindings.get(BASELINE_SELECTION)}}
}
