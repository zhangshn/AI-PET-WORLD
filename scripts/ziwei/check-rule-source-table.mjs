import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const placementRoot = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-placement",
)
const ruleDocPath = path.join(
  root,
  "docs",
  "ziwei",
  "ALGORITHM_CONTRACTS.md",
)

function fail(message) {
  console.error(`Ziwei rule source table check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(ruleDocPath)) {
  fail("ALGORITHM_CONTRACTS.md is missing")
}

const ruleDoc = readFileSync(ruleDocPath, "utf8")
const placementRuleIds = new Set()

walk(placementRoot, (filePath) => {
  if (!filePath.endsWith(".ts")) {
    return
  }

  const text = readFileSync(filePath, "utf8")

  for (const match of text.matchAll(/placementRuleId:\s*"([^"]+)"/g)) {
    placementRuleIds.add(match[1])
  }
})

const missingRuleIds = Array.from(placementRuleIds)
  .sort()
  .filter((ruleId) => !ruleDoc.includes(`\`${ruleId}\``))

if (missingRuleIds.length > 0) {
  fail(`missing rule ids in ALGORITHM_CONTRACTS.md: ${missingRuleIds.join(", ")}`)
}

if (!ruleDoc.includes("待校准")) {
  fail("ALGORITHM_CONTRACTS.md must keep an explicit pending calibration section")
}

console.log(
  `Ziwei rule source table check passed for ${placementRuleIds.size} rule id(s).`,
)

function walk(dirPath, visit) {
  readdirSync(dirPath).forEach((entry) => {
    const entryPath = path.join(dirPath, entry)
    const stat = statSync(entryPath)

    if (stat.isDirectory()) {
      walk(entryPath, visit)
      return
    }

    visit(entryPath)
  })
}
