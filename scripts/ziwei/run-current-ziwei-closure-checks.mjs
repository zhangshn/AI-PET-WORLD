import { spawnSync } from "node:child_process"

const checks = [
  ["node", ["scripts/ziwei/check-hard-rule-source-drift.mjs"]],
  ["node", ["scripts/ziwei/check-content-knowledge-repository.mjs"]],
  ["node", ["scripts/ziwei/check-main-star-palace-combinations.mjs"]],
  ["node", ["scripts/ziwei/check-non-main-star-palace-combinations.mjs"]],
  ["node", ["scripts/ziwei/check-periodic-star-palace-combinations.mjs"]],
  ["node", ["scripts/ziwei/check-star-pair-combinations.mjs"]],
  ["node", ["scripts/ziwei/check-pattern-dictionary-details.mjs"]],
  ["node", ["scripts/ziwei/check-current-evidence-chain.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-master-blueprint.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-reading-readiness.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-gap-review.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-content-supplement.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-synthesis-depth.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-transformation-branch-depth.mjs"]],
  ["node", ["scripts/ziwei/check-data-dictionary-explanation-reference-method.mjs"]],
  ["node", ["scripts/ziwei/check-star-dictionary-sample-review.mjs"]],
  ["node", ["scripts/ziwei/check-star-palace-readability-review.mjs"]],
  ["node", ["scripts/ziwei/check-pattern-readability-review.mjs"]],
  ["node", ["scripts/ziwei/check-current-chart-paragraph-sample-review.mjs"]],
  ["node", ["scripts/ziwei/check-current-chart-regression-review.mjs"]],
  ["node", ["scripts/ziwei/check-current-chart-output-closure-gate.mjs"]],
  ["node", ["scripts/ziwei/check-p24-p34-closure.mjs"]],
  ["node", ["scripts/ziwei/check-p35-data-intake.mjs"]]
]

function fail(message) {
  console.error(`[run-current-ziwei-closure-checks] ${message}`)
  process.exit(1)
}

for (const [command, args] of checks) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  })

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`)
  }
}

console.log("[run-current-ziwei-closure-checks] ok")
