/** One bounded natural-world creation call. Uses the original Runtime Store. */
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { assertRuntimePath } from "./runtime-path-security"
import { readNaturalWorldRuntimeSaveRecord, writeNaturalWorldRuntimeSaveRecord } from "./world-runtime-store-adapter"
import { sealNaturalWorldRuntimeRecord } from "./world-runtime-record-validation"
import type { NaturalWorldIdentity, NaturalWorldRuntimeRecordInput, NaturalWorldJsonObject } from "./world-runtime-schema"
import { buildEarthGeospatialCompleteMapConditions, naturalWorldFactsEnvelope, NATURAL_WORLD_PRODUCER_FILES } from "../../../scripts/build-earth-geospatial-complete-map-conditions.mjs"
import { naturalWorldDigest, validateNaturalWorldCreationInput } from "../../../scripts/lib/real-earth-region-governance.mjs"
import { buildWorldVisualFactManifestFromNaturalFacts } from "../../../scripts/build-current-world-visual-fact-manifest.mjs"
import { buildInitialNaturalWorldVisualTask } from "../../../scripts/build-current-world-visual-generation-task-package.mjs"
import { compileCurrentWorldVisualConditions, verifyNaturalWorldConditionPackage } from "../../../scripts/compile-current-world-visual-conditions.mjs"

export type NaturalWorldCreationInput = NaturalWorldIdentity & {
  schemaVersion: "natural-world-bootstrap-input-v1"
  createdAtUtc: string
}
type FileBinding = { path: string; sha256: string }
type NaturalProposal = {
  schemaVersion: "natural-world-generated-facts-v1"
  identity: NaturalWorldIdentity
  sourceInputReads: { path: string; fileSha256: string; bytes: number }[]
  sourcePackage: unknown
  sourcePackageIdentity: string
  environment: NaturalWorldJsonObject
  randomState: NaturalWorldRuntimeRecordInput["randomState"]
  ruleVersion: string
}
// The JS function also supports legacy CLI modes. Narrow its natural-mode
// boundary here; the producer and final 097 seal both validate real values.
const generateNatural = buildEarthGeospatialCompleteMapConditions as unknown as
  (options: { naturalWorldInput: NaturalWorldCreationInput }) => Promise<NaturalProposal>
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

export async function createInitialNaturalWorld(input: NaturalWorldCreationInput, options: { outputRoot: string; mode?: "private_candidate" | "configured_store" }) {
  validateNaturalWorldCreationInput(input)
  const fixed = structuredClone(input)
  const root = process.cwd(), outputRoot = path.resolve(options.outputRoot)
  const mode = options.mode ?? "private_candidate"
  await assertRuntimePath(outputRoot, path.join(root, ".runtime"))
  if (mode !== "private_candidate" && mode !== "configured_store") throw new Error("unknown natural bootstrap execution mode")
  // Candidate calls are isolated. A later local-program integration can use
  // configured_store; the original facade alone chooses its trusted adapter.
  if (mode === "private_candidate" && (process.env.NODE_ENV !== "production" || !process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT ||
    path.resolve(process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT) !== path.join(outputRoot, "runtime-store"))) {
    throw new Error("natural bootstrap requires its explicit private configured Runtime Store")
  }
  fs.mkdirSync(outputRoot) // Exclusive attempt; never overwrite/retry an old result.
  const artifacts: { role: string; path: string; sha256: string; bytes: number }[] = []
  let storeOutcome: Awaited<ReturnType<typeof writeNaturalWorldRuntimeSaveRecord>> | null = null
  let inputReads: { path: string; fileSha256: string; bytes: number }[] = []
  const relative = (p: string) => path.relative(root, p).replace(/\\/g, "/")
  const save = (name: string, value: unknown, role: string): FileBinding => {
    const p = path.join(outputRoot, name), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    fs.writeFileSync(p, bytes, { flag: "wx" })
    const binding = { path: relative(p), sha256: digest(bytes) }
    artifacts.push({ ...binding, bytes: bytes.length, role })
    return binding
  }
  try {
    const proposal = await generateNatural({ naturalWorldInput: fixed })
    if (!proposal || proposal.schemaVersion !== "natural-world-generated-facts-v1") throw new Error("natural producer returned an invalid schema")
    inputReads.push(...proposal.sourceInputReads)
    const sourcePackageBinding = save("natural-source-package.json", proposal.sourcePackage, "natural_source_package")
    const generatedFactsBinding = save("natural-generated-facts.json", proposal, "natural_generated_facts")
    const facts = naturalWorldFactsEnvelope(proposal) as NaturalWorldRuntimeRecordInput["worldFacts"]
    const factHash = naturalWorldDigest(facts)
    const producerBindings = NATURAL_WORLD_PRODUCER_FILES.map((p: string) => {
      const bytes = fs.readFileSync(path.resolve(root, p)), sha256 = digest(bytes)
      inputReads.push({ path: p, fileSha256: sha256, bytes: bytes.length })
      return { path: p, sha256 }
    })
    const releasePayload = { schemaVersion: "natural-world-source-fact-release-v1", scope: "natural_world_runtime_v1",
      creationInput: fixed, worldId: fixed.worldId, regionId: fixed.regionId, ownerId: fixed.ownerId, tick: 0, factHash,
      sourcePackageIdentity: proposal.sourcePackageIdentity, sourcePackageBinding, generatedFactsBinding, producerBindings }
    const sourceFactReleaseBinding = save("natural-source-fact-release.json", { ...releasePayload,
      sourceFactReleaseIdentity: `natural-source-facts-${naturalWorldDigest(releasePayload)}` }, "natural_source_fact_release")
    const builtFacts = await buildWorldVisualFactManifestFromNaturalFacts({ sourceFactReleaseBinding })
    inputReads.push(...builtFacts.inputReads)
    const visualFactManifestBinding = save("natural-visual-facts.json", builtFacts.manifest, "visual_fact_manifest")
    const directorPath = relative(path.join(outputRoot, "natural-director.json"))
    const taskPath = relative(path.join(outputRoot, "natural-task.json"))
    const builtTask = await buildInitialNaturalWorldVisualTask({ sourceFactReleaseBinding, visualFactManifestBinding, directorPath, taskPath })
    inputReads.push(...builtTask.inputReads)
    save("natural-director.json", builtTask.director, "world_director")
    save("natural-task.json", builtTask.task, "visual_generation_task")
    const taskManifestBinding = save("natural-task-manifest.json", builtTask.manifest, "visual_task_manifest")
    const conditions = await compileCurrentWorldVisualConditions({ taskManifestPath: taskManifestBinding.path, quiet: true })
    inputReads.push(...conditions.inputReads)
    const conditionManifestBinding = { path: conditions.manifestPath, sha256: conditions.manifestFileSha256 }
    const typedConditions = await verifyNaturalWorldConditionPackage({ manifestBinding: conditionManifestBinding,
      expected: { worldId: fixed.worldId, regionId: fixed.regionId, tick: 0, factHash,
        sourceFactReleaseIdentity: `natural-source-facts-${naturalWorldDigest(releasePayload)}` } })
    inputReads.push(...typedConditions.inputReads)
    artifacts.push(...typedConditions.channelBindings.map(c => ({ role: `condition_channel_${c.id}`, path: c.path, sha256: c.sha256, bytes: c.bytes })))
    for (const [role, p] of [["condition_manifest", conditions.manifestPath], ["condition_package", conditions.conditionPackPath]]) {
      const absolute = path.resolve(root, p), bytes = fs.readFileSync(absolute)
      inputReads.push({ path: relative(absolute), fileSha256: digest(bytes), bytes: bytes.length })
      artifacts.push({ role, path: relative(absolute), sha256: digest(bytes), bytes: bytes.length })
    }
    save("input-read-receipts.json", inputReads, "input_read_receipts")
    const candidate: NaturalWorldRuntimeRecordInput = {
      ...fixed, version: "natural-world-runtime-save-v1", tick: 0, stateVersion: 0, savedAt: fixed.createdAtUtc,
      worldFacts: facts,
      worldState: { schemaVersion: "natural-world-state-snapshot-v1", worldId: fixed.worldId, regionId: fixed.regionId, tick: 0,
        payload: { environment: { ...proposal.environment, resourceInitialization: "no_resource_instances_created", runtimeEvents: "none_created" },
          objects: facts.payload.objectFootprints, resources: [] } },
      ruleVersion: proposal.ruleVersion, eventCursor: 0, randomState: proposal.randomState,
      sourceBindings: artifacts.map(a => ({ role: a.role, uri: a.path, fileSha256: a.sha256 })),
    }
    // Input schema metadata is not part of the strict stored-record schema.
    delete (candidate as Partial<NaturalWorldCreationInput>).schemaVersion
    delete (candidate as Partial<NaturalWorldCreationInput>).createdAtUtc
    const sealed = sealNaturalWorldRuntimeRecord(candidate)
    if (sealed.worldFactsPayloadSha256 !== factHash) throw new Error("natural task and store factHash mismatch")
    const written = await writeNaturalWorldRuntimeSaveRecord({ record: candidate, expectedTick: -1, expectedStateVersion: -1, expectedFileSha256: null })
    storeOutcome = written
    if (!written.ok) throw new Error(`natural store create failed:${JSON.stringify(written)}`)
    const restored = await readNaturalWorldRuntimeSaveRecord({ ownerId: fixed.ownerId, worldId: fixed.worldId,
      expectedTick: 0, expectedStateVersion: 0, expectedPlayerId: fixed.playerId, expectedFileSha256: written.fileSha256 })
    if (restored.status !== "found" || naturalWorldDigest(restored.record) !== naturalWorldDigest(sealed)) throw new Error("natural immediate store restore mismatch")
    const result = { schemaVersion: "natural-world-bootstrap-result-v1", status: "unpublished_natural_world_candidate_saved",
      executionMode: mode,
      identity: proposal.identity, factHash, sourceFactReleaseBinding, sourcePackageBinding, generatedFactsBinding,
      taskManifestBinding, conditionManifestPath: conditions.manifestPath, conditionPackPath: conditions.conditionPackPath,
      conditionManifestBinding,
      stored: written, sourceInputReadCount: inputReads.length, artifacts: [...artifacts],
      outputBoundary: { modelExecuted: false, rgbCreated: false, frameCreated: false, currentRegistryModified: false, worldEntryEligible: false } }
    const resultBinding = save("bootstrap-result.json", result, "bootstrap_result")
    return { ...result, resultBinding }
  } catch (error) {
    const detail = error as Error & { inputReads?: typeof inputReads }
    inputReads = [...inputReads, ...(detail.inputReads ?? [])]
    save("bootstrap-failure.json", { schemaVersion: "natural-world-bootstrap-failure-v1", message: detail.message,
      stack: detail.stack, identity: fixed, inputReads, artifacts, storeOutcome,
      naturalSaveAlreadyCommitted: storeOutcome?.ok === true, automaticRetry: false }, "failure")
    throw error
  }
}
