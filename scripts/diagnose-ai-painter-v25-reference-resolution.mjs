// Diagnostic control only: a saved training target is not a generated candidate.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"

const sha = value => crypto.createHash("sha256").update(value).digest("hex")
function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(x => x && ![".", ".."].includes(x)))
  const resolved = path.resolve(root, logical)
  assert.ok(resolved.startsWith(root + path.sep))
  // Project-managed data/runtime junctions are intentional; nested escapes are not.
  const first = logical.split("/")[0]
  const storageRoot = [".runtime", "data"].includes(first)
    ? fs.realpathSync(path.join(root, first)) : root
  const contained = actual => actual === storageRoot || actual.startsWith(storageRoot + path.sep)
  assert.ok(contained(fs.realpathSync(path.dirname(resolved))))
  if (fs.existsSync(resolved)) assert.ok(contained(fs.realpathSync(resolved)))
  return resolved
}
function read(root, binding) {
  assert.deepEqual(Object.keys(binding).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const data = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(data), binding.sha256, `changed input: ${binding.path}`)
  return data
}
const json = (root, binding) => JSON.parse(read(root, binding))
const bind = (root, logical) => ({ path: logical, sha256: sha(fs.readFileSync(inside(root, logical))) })

export async function diagnose(rootPath, input) {
  const root = fs.realpathSync(rootPath)
  assert.equal(root, fs.realpathSync(process.cwd()), "shared auditor uses current project root")
  const report = json(root, input)
  assert.equal(report.schemaVersion, "ai-painter-mvp256-dry-v25-cpu-review-v1")
  assert.equal(report.subject.split, "validation")
  const execution = json(root, report.executionPackage)
  const dataset = json(root, execution.datasetManifest)
  const source = json(root, dataset.sourceIndex)
  const row = source.samples.find(x => x.sampleId === report.subject.sampleId)
  assert.equal(row?.split, "validation")
  assert.deepEqual(row.image, report.subject.referenceRgb)
  const pack = json(root, report.subject.conditionPack)
  assert.equal(pack.worldId, report.subject.worldId)
  assert.equal(pack.tick, report.subject.tick)
  assert.equal(pack.channels.length, 23)
  for (const channel of pack.channels) read(root, { path: channel.path, sha256: channel.sha256 })
  const target = read(root, report.originalRgb)
  read(root, report.subject.referenceRgb)
  const metadata = await sharp(target).metadata()
  assert.deepEqual([metadata.width, metadata.height], [256, 192])
  const directory = path.posix.dirname(input.path)
  const output = `${directory}/reference-resolution-control.json`
  const projectionPath = `${directory}/reference-target-diagnostic-1024.png`
  assert.equal(fs.existsSync(inside(root, output)), false)
  assert.equal(fs.existsSync(inside(root, projectionPath)), false)
  const projection = await sharp(target).resize(1024, 768, { kernel: "nearest" }).png().toBuffer()
  assert.ok(projection.length <= 4 * 1024 * 1024)
  fs.writeFileSync(inside(root, projectionPath), projection, { flag: "wx" })
  const record = { recordId: `${report.runId}-reference-resolution-diagnostic`,
    conditionBinding: { conditionPackPath: report.subject.conditionPack.path,
      worldId: report.subject.worldId, tick: report.subject.tick },
    classification: { monsoonSeason: row.monsoonSeason, regionalLandscapeType: null } }
  const alignment = await auditAiAssistedConditionAlignment({ record,
    imagePath: inside(root, projectionPath), referenceImagePath: inside(root, row.image.path) })
  // Revalidate every source after the audit, not just the path strings.
  read(root, input); read(root, report.originalRgb); read(root, report.subject.referenceRgb)
  read(root, report.subject.conditionPack)
  for (const channel of pack.channels) read(root, { path: channel.path, sha256: channel.sha256 })
  const value = { schemaVersion: "ai-painter-v25-reference-resolution-control-v1",
    status: "diagnostic_only_not_candidate_qualification", runId: report.runId, input,
    target: report.originalRgb, reference: report.subject.referenceRgb,
    conditionPack: report.subject.conditionPack, projection: bind(root, projectionPath),
    program: bind(root, "scripts/diagnose-ai-painter-v25-reference-resolution.mjs"),
    auditor: bind(root, "scripts/lib/ai-assisted-condition-alignment.mjs"), alignment,
    interpretationLimit: "one reviewed validation training-target control; does not establish semantic judge completeness or all-source alignment",
    boundary: { gpuStarted: false, optimizerSteps: 0, weightsModified: false,
      sourceImagesModified: false, thresholdsModified: false, registryWritten: false,
      candidatePublished: false, stage4Advanced: false }, recordedAtUtc: new Date().toISOString() }
  const encoded = Buffer.from(JSON.stringify(value, null, 2) + "\n")
  assert.ok(encoded.length + projection.length <= 8 * 1024 * 1024)
  fs.writeFileSync(inside(root, output), encoded, { flag: "wx" })
  return { report: bind(root, output), alignmentPassed: alignment.passed,
    objectChecks: alignment.objectSemanticAudits.map(x => ({ role: x.channelId,
      passed: x.passed, referenceResponse: x.referenceResponse })), diagnosticOnly: true }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, logical, digest] = process.argv.slice(2)
  assert.equal(mode, "--execute")
  process.stdout.write(JSON.stringify(await diagnose(process.cwd(), { path: logical, sha256: digest })) + "\n")
}
