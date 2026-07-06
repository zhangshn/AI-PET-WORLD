import { spawnSync } from "node:child_process"

const result = spawnSync("node", ["scripts/ziwei/run-current-ziwei-closure-checks.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "inherit"
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log("[check-final-delivery-closure] current ziwei closure ok")
