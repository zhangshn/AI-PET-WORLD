import fs from "node:fs"
import path from "node:path"

const output = process.argv[2]
if (!output || path.isAbsolute(output) === false) throw new Error("absolute_output_required")
fs.writeFileSync(output, `${JSON.stringify({ status: "fixture_started", pid: process.pid, at: new Date().toISOString() })}\n`, "utf8")
setTimeout(() => {
  fs.appendFileSync(output, `${JSON.stringify({ status: "fixture_survived_launcher_exit", pid: process.pid, at: new Date().toISOString() })}\n`, "utf8")
}, 4000)
