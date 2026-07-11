import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const outputRoot = path.join(root, "data/world-visual-data-dictionary")
const dictionaryVersionId = process.env.WORLD_VISUAL_DICTIONARY_VERSION ?? "mvp-natural-home-v0.3"
const sourcePath = path.join(outputRoot, "source", `${dictionaryVersionId}-source.json`)
const outputPath = path.join(outputRoot, `${dictionaryVersionId}.json`)
const latestPath = path.join(outputRoot, "latest.json")

const source = JSON.parse(await readFile(sourcePath, "utf8"))
assert(source.schemaVersion === "world-visual-data-dictionary-source-v1", "invalid dictionary source schema")
assert(source.dictionaryVersionId === dictionaryVersionId, "dictionary source version mismatch")
assert(Array.isArray(source.entries) && source.entries.length > 0, "dictionary source entries missing")

const entries = source.entries.map((sourceEntry) => {
  const entry = { ...sourceEntry }
  delete entry.content
  delete entry.legacySourcePath
  return entry
})
const hardFailureCodes = Array.from(
  new Set(entries.flatMap((entry) => (entry.hardFailures ?? []).map((failure) => failure.code))),
).sort()
const registeredFailureCodes = source.registeredFailureCodes ?? []
const registeredFailureCodeSet = new Set(registeredFailureCodes.map((item) => item.code))
const unregisteredHardFailureCodes = hardFailureCodes.filter((code) => !registeredFailureCodeSet.has(code))
const categories = countBy(entries, "category")
const missingCategories = source.requiredCategories.filter((category) => !categories[category])
const generatedAt = new Date().toISOString()

const exported = {
  schemaVersion: "world-visual-data-dictionary-export-v1",
  dictionaryVersionId,
  status: source.status,
  generatedAt,
  sourceRoot: projectPath(sourcePath),
  summary: {
    documentCount: 2,
    entryCount: entries.length,
    categories,
    registeredFailureCodeCount: registeredFailureCodes.length,
    hardFailureCodeCount: hardFailureCodes.length,
    unregisteredHardFailureCodeCount: unregisteredHardFailureCodes.length,
    trainingLabelCount: (source.trainingLabels ?? []).length,
    missingCategories,
  },
  requiredCategories: source.requiredCategories,
  entries,
  registeredFailureCodes,
  trainingLabels: source.trainingLabels ?? [],
  hardFailureCodes,
  unregisteredHardFailureCodes,
}

await mkdir(outputRoot, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(exported, null, 2)}\n`, "utf8")
await writeFile(latestPath, `${JSON.stringify({
  schemaVersion: "world-visual-data-dictionary-latest-pointer-v1",
  dictionaryVersionId,
  status: exported.status,
  generatedAt,
  dictionaryPath: projectPath(outputPath),
  sourcePath: projectPath(sourcePath),
  summary: exported.summary,
}, null, 2)}\n`, "utf8")

console.log(`World visual data dictionary exported: ${projectPath(outputPath)}`)
console.log(`source=${projectPath(sourcePath)}`)
console.log(`entries=${entries.length}`)
console.log(`registeredFailureCodes=${registeredFailureCodes.length}`)
console.log(`hardFailureCodes=${hardFailureCodes.length}`)
console.log(`unregisteredHardFailureCodes=${unregisteredHardFailureCodes.length}`)

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/")
}

function countBy(items, key) {
  const result = {}
  for (const item of items) result[item[key]] = (result[item[key]] ?? 0) + 1
  return result
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
