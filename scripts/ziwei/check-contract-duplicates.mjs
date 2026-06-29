import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

const scanRoots = [
  "src/ai/destiny-core/ziwei-core/birth",
  "src/ai/destiny-core/ziwei-core/natal-foundation",
  "src/ai/destiny-core/ziwei-core/star-catalog",
  "src/ai/destiny-core/ziwei-core/star-placement",
  "src/ai/destiny-core/ziwei-core/full-chart",
  "src/ai/destiny-core/ziwei-core/dynamic-chart",
  "src/ai/destiny-core/ziwei-core/adapters",
  "src/ai/destiny-core/ziwei-core/public-api",
  "src/app/ziwei",
  "src/app/api/ziwei",
  "scripts/ziwei",
]

const contractDir = path.normalize(
  "src/ai/destiny-core/ziwei-core/contracts",
)

const forbiddenNames = new Set([
  "BranchPalace",
  "TimeBranch",
  "HeavenlyStem",
  "SectorName",
  "ElementGate",
  "ZiweiBirthInput",
  "NormalizedZiweiBirthInput",
  "LunarBirthInfo",
  "ZiweiNatalFoundation",
  "ZiweiStarId",
  "ZiweiStarCategory",
  "ZiweiStarDefinition",
  "ZiweiPlacementContext",
  "ZiweiPlacedStar",
  "FullZiweiChart",
  "FullZiweiPalace",
  "FullZiweiDynamicChart",
  "ZiweiPageViewModel",
  "ZiweiApiResponse",
  "ZiweiApiErrorCode",
])

const findings = []

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot))
}

if (findings.length > 0) {
  console.error("Ziwei contract duplicate check failed:")
  for (const finding of findings) {
    console.error(
      `- ${path.relative(root, finding.file)} exports ${finding.name}`,
    )
  }
  process.exit(1)
}

console.log("Ziwei contract duplicate check passed.")

function walk(targetPath) {
  if (!existsSync(targetPath)) return

  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    for (const entry of readdirSync(targetPath)) {
      walk(path.join(targetPath, entry))
    }
    return
  }

  if (!targetPath.endsWith(".ts") && !targetPath.endsWith(".tsx")) {
    return
  }

  const relativePath = path.normalize(path.relative(root, targetPath))
  if (relativePath.startsWith(contractDir)) {
    return
  }

  const text = readFileSync(targetPath, "utf8")
  const exportPattern = /export\s+(?:interface|type|enum)\s+([A-Za-z0-9_]+)/g

  let match = exportPattern.exec(text)
  while (match) {
    const name = match[1]
    if (forbiddenNames.has(name)) {
      findings.push({
        file: targetPath,
        name,
      })
    }
    match = exportPattern.exec(text)
  }
}
