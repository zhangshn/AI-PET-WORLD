import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const TARGETS = [
  "src",
  "scripts",
]
const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
  ".json",
  ".md",
  ".py",
])

const FORBIDDEN_TOKENS = [
  "\uFFFD",
  "\u003F\u003F\u003F",
  "\u6D93",
  "\u7459",
  "\u8930",
  "\u7EDB",
  "\u934F",
  "\u95C8",
  "\u6DC7",
  "\u951B",
  "\u9422",
  "\u9365",
  "\u6D63",
  "\u7ECB",
  "\u9483",
]

const findings = []

for (const target of TARGETS) {
  walk(path.join(ROOT, target))
}

if (findings.length > 0) {
  console.error("Source encoding check failed. Possible mojibake found:")
  for (const finding of findings) {
    console.error(
      `- ${path.relative(ROOT, finding.file)}:${finding.line}: ${finding.text}`
    )
  }
  process.exit(1)
}

console.log("Source encoding check passed.")

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) return
  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      walk(path.join(targetPath, entry))
    }
    return
  }

  if (!EXTENSIONS.has(path.extname(targetPath))) return
  const text = fs.readFileSync(targetPath, "utf8")
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (FORBIDDEN_TOKENS.some((token) => line.includes(token))) {
      findings.push({
        file: targetPath,
        line: index + 1,
        text: line.trim(),
      })
    }
  }
}
