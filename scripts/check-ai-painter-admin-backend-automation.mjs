import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const failures = []
const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"))
const scripts = packageJson.scripts ?? {}

const legacyRequiredSentenceHex =
  "e5a891e692b3e7a7b4e98d98e688a0e68b8be5a79de5b1bde6aeb0e996bbe388a0e5b4ace8a4b0e5829ee5b990e98a89ee889ce5b9a2e99782e58ba9e5809de5a8bcee8188e5b4a3e98eb4e78ab2e7ae9be99781e68c8ee791a8e9a195e38287e282ace4bd83e5a388e98da4d187e5bcaee99098e5b487e3808ae7bc82e4bd88e591afe695bee996bfe6b698e88bafe7bbbbe282ace5a69ee38288ee87a7e98d98e6b6a2e5b491e5a98ae282ace7bb97e591b4e5bcb6e98a89ee9f91e59a84e99782e582a4e599a3e98a86e5b689e68384e9a194e89789ee95b2e996bae5a09dee98b3e988a7ee8480e6878ce988a73f"
const requiredSentences = [
  "不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。",
  Buffer.from(legacyRequiredSentenceHex, "hex").toString("utf8"),
]
const requiredDocs = [
  "docs/ai-painter-progress/AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md",
  "docs/ai-painter-progress/TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AUTO_REPAIR_PLAN_RUNNER_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AUTO_VISUAL_JUDGE_LEARNING_LOCKED_SPEC_20260709.md",
]
const requiredPackageScripts = [
  "plan:game-map-material-slot-next-repair",
  "check:game-map-material-slot-next-repair-plan",
  "run:game-map-material-slot-next-repair-plan",
  "learn:game-map-auto-visual-judge",
  "check:game-map-auto-visual-judge-learning",
  "judge:game-map-material-quality",
  "build:game-map-approved-material-pack",
  "write:game-map-composite-runtime-frame",
  "check:ai-painter-training-run-archive",
]
const requiredRuntimePaths = [
  ".runtime/ai-painter/training-run-archive/latest.json",
  ".runtime/ai-painter/game-map-material-slot-next-repair-plan/latest.json",
]

function check(condition, message) {
  if (!condition) failures.push(message)
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""
}

function hasRequiredSentence(content) {
  return requiredSentences.some((sentence) => content.includes(sentence))
}

function hasTimestamp(content) {
  return /更新时间|鏇存柊鏃堕棿|Updated At|updatedAt/i.test(content)
}

function main() {
  for (const doc of requiredDocs) {
    const absolute = path.resolve(doc)
    check(fs.existsSync(absolute), `locked document missing: ${doc}`)
    const content = readFileIfExists(absolute)
    check(hasRequiredSentence(content), `locked document missing owner-control sentence: ${doc}`)
    check(hasTimestamp(content), `locked document missing timestamp: ${doc}`)
  }

  for (const scriptName of requiredPackageScripts) {
    check(typeof scripts[scriptName] === "string" && scripts[scriptName].length > 0, `package script missing: ${scriptName}`)
  }

  for (const runtimePath of requiredRuntimePaths) {
    check(fs.existsSync(path.resolve(runtimePath)), `runtime evidence missing: ${runtimePath}`)
  }

  const runnerPath = path.resolve("scripts/run-game-map-material-slot-next-repair-plan.mjs")
  const runner = readFileIfExists(runnerPath)
  check(fs.existsSync(runnerPath), "repair-plan automatic runner missing")
  check(runner.includes("createdByProgram: true"), "repair runner must mark createdByProgram=true")
  check(runner.includes("manualEdited: false"), "repair runner must mark manualEdited=false")
  check(runner.includes("codexGenerated: false"), "repair runner must mark codexGenerated=false")
  check(runner.includes("allowedNpmScripts"), "repair runner must use a command allowlist")
  check(runner.includes("spawnSync"), "repair runner must execute through program automation")

  const naturalHomePage = readFileIfExists(path.resolve("src/app/ai-painter-progress/natural-home/page.tsx"))
  check(
    naturalHomePage.includes("/api/ai-painter/training-data-image"),
    "natural-home page must display auto-saved training images through the read-only image API",
  )
  check(
    naturalHomePage.includes("game-map-runtime-compositor"),
    "natural-home page must include runtime compositor image evidence",
  )

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: "ai_painter_admin_backend_automation_check_failed",
          failures,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "ai_painter_admin_backend_automation_check_passed",
        checkedPackageScripts: requiredPackageScripts,
        checkedRuntimePaths: requiredRuntimePaths,
        cwd,
      },
      null,
      2,
    ),
  )
}

main()
